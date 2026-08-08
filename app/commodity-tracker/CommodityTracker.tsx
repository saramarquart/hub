'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { loadCommodities, type CommodityData } from '@/lib/commodities';
import styles from './tracker.module.css';
import TradingViewChart from './TradingViewChart';
import HistoryChart from './HistoryChart';

/* ─────────────────────────────────────────────────────────────────────────────
   Small helpers
   ──────────────────────────────────────────────────────────────────────────── */

/** Parse a user-typed number; returns null for blank/invalid (never throws). */
function num(v: string): number | null {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Format a number as an integer € amount. */
function eur(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return '€' + Math.round(n).toLocaleString('en-US');
}

/** Format €/kg with two decimals. */
function eurKg(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return '€' + n.toFixed(2);
}

/** Human "as of" date from an ISO string. */
function asOf(iso: string | null | undefined): string {
  if (!iso) return 'n/a';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'n/a';
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

/* ─────────────────────────────────────────────────────────────────────────────
   HCCO daily split prices — persisted manual-entry overrides (localStorage)
   ──────────────────────────────────────────────────────────────────────────── */

interface HccoPrices {
  beans: string;
  mass: string;
  butter: string;
  powder: string;
  date: string; // "as of" date the user copies from the newsletter
}

const HCCO_KEY = 'paf-commodity-hcco';
const emptyHcco: HccoPrices = { beans: '', mass: '', butter: '', powder: '', date: '' };

function loadHcco(): HccoPrices {
  if (typeof window === 'undefined') return emptyHcco;
  try {
    const raw = localStorage.getItem(HCCO_KEY);
    if (!raw) return emptyHcco;
    const p = JSON.parse(raw) as Partial<HccoPrices>;
    return { ...emptyHcco, ...p };
  } catch {
    return emptyHcco;
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   Sales Quotes — chocolate/compound prices sales "heard" (localStorage)
   ──────────────────────────────────────────────────────────────────────────── */

/** Days after which a quote is flagged stale; days after which it auto-archives. */
const QUOTE_EXPIRE_DAYS = 7;
const QUOTE_ARCHIVE_DAYS = 30;

const SALES_QUOTES_KEY = 'paf_commodity_sales_quotes_v1';

const QUOTE_PRODUCTS = ['Milk Chocolate', 'Semi-Sweet', 'Compound'] as const;
type QuoteProduct = (typeof QUOTE_PRODUCTS)[number];

type QuoteUnit = '€/MT' | '€/kg';

interface SalesQuote {
  id: string;
  product: QuoteProduct;
  /** Price as entered, in the entered unit. */
  price: number;
  unit: QuoteUnit;
  note: string;
  /** ISO timestamp stamped at add time. */
  loggedAt: string;
}

function loadSalesQuotes(): SalesQuote[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SALES_QUOTES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Defensive: keep only well-formed rows.
    return parsed.filter(
      (q): q is SalesQuote =>
        q &&
        typeof q.id === 'string' &&
        (QUOTE_PRODUCTS as readonly string[]).includes(q.product) &&
        typeof q.price === 'number' &&
        Number.isFinite(q.price) &&
        (q.unit === '€/MT' || q.unit === '€/kg') &&
        typeof q.loggedAt === 'string'
    ).map((q) => ({ ...q, note: typeof q.note === 'string' ? q.note : '' }));
  } catch {
    return [];
  }
}

/** Normalize a quote's price into both €/MT and €/kg (1 MT = 1000 kg). */
function quotePrices(q: SalesQuote): { perMt: number; perKg: number } {
  if (q.unit === '€/kg') return { perMt: q.price * 1000, perKg: q.price };
  return { perMt: q.price, perKg: q.price / 1000 };
}

/** Whole days elapsed since an ISO timestamp (client-side, floored, non-negative). */
function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  const ms = Date.now() - then;
  return Math.max(0, Math.floor(ms / 86_400_000));
}

/** Human "3d ago" style age. */
function ageLabel(iso: string): string {
  const d = daysSince(iso);
  if (d <= 0) return 'today';
  if (d === 1) return '1d ago';
  return `${d}d ago`;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Cost Crunch model — recipe types
   ──────────────────────────────────────────────────────────────────────────── */

interface Ingredient {
  key: string;
  label: string;
  /** Percentage of the recipe (editable, string-backed). */
  pct: string;
  /** €/MT price; string-backed. When `derived` is set this is read-only-ish. */
  price: string;
  /** If set, price is derived live from another value; the field is informative. */
  derivedFrom?: 'mass' | 'butter' | 'powder' | 'sugar' | 'cbs' | null;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Component
   ──────────────────────────────────────────────────────────────────────────── */

export default function CommodityTracker() {
  const [data, setData] = useState<CommodityData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadCommodities().then((d) => {
      setData(d);
      setLoaded(true);
    });
  }, []);

  /* ── Live FX + cocoa terminal, converted to EUR ────────────────────────── */
  const eurUsd = data?.metrics.eurUsd.value ?? null;
  const cocoaUsdMt = data?.metrics.cocoaNY.value ?? null;
  // Terminal cocoa in EUR/MT (from committed derived value, else compute live).
  const terminalEurMt =
    data?.derived.cocoaEurPerMt ??
    (cocoaUsdMt != null && eurUsd ? cocoaUsdMt / eurUsd : null);

  /* ── Editable derivation ratios (from terminal €/MT) ───────────────────── */
  const [liquorFactor, setLiquorFactor] = useState('1.25');
  const [butterRatio, setButterRatio] = useState('2.4');
  const [powderRatio, setPowderRatio] = useState('0.6');

  /* ── CBS derivation: palmKernelOil × cbsMultiplier ─────────────────────── */
  const [palmKernelOil, setPalmKernelOil] = useState('865'); // €/MT default (assumption)
  const [cbsMultiplier, setCbsMultiplier] = useState('1.85');

  /* ── Shared editable prices (defaults; some seeded from live where possible) */
  const [sugarPrice, setSugarPrice] = useState('580'); // €/MT default (white sugar)
  const [smpPrice, setSmpPrice] = useState('2800'); // skim milk powder
  const [lecithinPrice, setLecithinPrice] = useState('1800');
  const [processing1, setProcessing1] = useState('200');
  const [processing2, setProcessing2] = useState('200');

  /* ── HCCO manual-entry overrides ───────────────────────────────────────── */
  const [hcco, setHcco] = useState<HccoPrices>(emptyHcco);
  useEffect(() => setHcco(loadHcco()), []);
  const setHccoField = (field: keyof HccoPrices, value: string) => {
    setHcco((prev) => {
      const next = { ...prev, [field]: value };
      try {
        localStorage.setItem(HCCO_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const clearHcco = () => {
    setHcco(emptyHcco);
    try {
      localStorage.removeItem(HCCO_KEY);
    } catch {
      /* ignore */
    }
  };

  /* ── Sales Quotes — sales-heard prices, persisted (localStorage) ────────── */
  const [quotes, setQuotes] = useState<SalesQuote[]>([]);
  useEffect(() => setQuotes(loadSalesQuotes()), []);

  const [qProduct, setQProduct] = useState<QuoteProduct>('Milk Chocolate');
  const [qPrice, setQPrice] = useState('');
  const [qUnit, setQUnit] = useState<QuoteUnit>('€/MT');
  const [qNote, setQNote] = useState('');
  const [showArchive, setShowArchive] = useState(false);

  function persistQuotes(next: SalesQuote[]) {
    setQuotes(next);
    try {
      localStorage.setItem(SALES_QUOTES_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }

  function addQuote() {
    const price = num(qPrice);
    if (price == null || price <= 0) return; // don't add a broken quote
    const quote: SalesQuote = {
      id:
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      product: qProduct,
      price,
      unit: qUnit,
      note: qNote.trim(),
      loggedAt: new Date().toISOString(),
    };
    persistQuotes([quote, ...quotes]);
    // Clear the form (keep product + unit for fast repeat entry).
    setQPrice('');
    setQNote('');
  }

  function deleteQuote(id: string) {
    persistQuotes(quotes.filter((q) => q.id !== id));
  }

  /* Split into active (<30d, newest first) and archived (≥30d). */
  const sortedQuotes = useMemo(
    () => [...quotes].sort((a, b) => b.loggedAt.localeCompare(a.loggedAt)),
    [quotes]
  );
  const activeQuotes = sortedQuotes.filter((q) => daysSince(q.loggedAt) < QUOTE_ARCHIVE_DAYS);
  const archivedQuotes = sortedQuotes.filter((q) => daysSince(q.loggedAt) >= QUOTE_ARCHIVE_DAYS);

  /* Latest active quote per product for the lean summary line. */
  const latestByProduct = useMemo(() => {
    const map = new Map<QuoteProduct, SalesQuote>();
    for (const q of activeQuotes) {
      if (!map.has(q.product)) map.set(q.product, q); // activeQuotes already newest-first
    }
    return QUOTE_PRODUCTS.map((p) => map.get(p)).filter((q): q is SalesQuote => q != null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotes]);

  /* ── Derived cocoa input prices (HCCO override → else derived ratio) ────── */
  const t = terminalEurMt;
  const derivedMass = t != null ? t * (num(liquorFactor) ?? 0) : null;
  const derivedButter = t != null ? t * (num(butterRatio) ?? 0) : null;
  const derivedPowder = t != null ? t * (num(powderRatio) ?? 0) : null;

  const massPrice = num(hcco.mass) ?? derivedMass;
  const butterPrice = num(hcco.butter) ?? derivedButter;
  const powderPrice = num(hcco.powder) ?? derivedPowder;
  const massIsReal = num(hcco.mass) != null;
  const butterIsReal = num(hcco.butter) != null;
  const powderIsReal = num(hcco.powder) != null;

  const cbsPrice = (num(palmKernelOil) ?? 0) * (num(cbsMultiplier) ?? 0);

  /* ── Recipe 1: Real 30% milk chocolate ─────────────────────────────────── */
  const [r1, setR1] = useState<Ingredient[]>([
    { key: 'sugar', label: 'Sugar', pct: '51', price: '580', derivedFrom: 'sugar' },
    { key: 'smp', label: 'Skim milk powder', pct: '18', price: '2800' },
    { key: 'lecithin', label: 'Lecithin', pct: '0.5', price: '1800' },
    { key: 'mass', label: 'Cocoa mass', pct: '12', price: '', derivedFrom: 'mass' },
    { key: 'butter', label: 'Cocoa butter', pct: '18', price: '', derivedFrom: 'butter' },
    { key: 'other', label: 'Other / flavor', pct: '0.5', price: '0' },
  ]);

  /* ── Recipe 2: Compound (indication) ───────────────────────────────────── */
  const [r2, setR2] = useState<Ingredient[]>([
    { key: 'powder', label: 'Cocoa powder', pct: '10', price: '', derivedFrom: 'powder' },
    { key: 'cbs', label: 'CBS (PKS)', pct: '30', price: '', derivedFrom: 'cbs' },
    { key: 'sugar', label: 'Sugar', pct: '48', price: '580', derivedFrom: 'sugar' },
    { key: 'smp', label: 'Skim milk powder', pct: '11', price: '2800' },
    { key: 'lecithin', label: 'Lecithin', pct: '0.5', price: '1800' },
    { key: 'other', label: 'Other / flavor', pct: '0.5', price: '0' },
  ]);

  /**
   * Resolve the effective €/MT for an ingredient. Derived ingredients pull from
   * the live/derived values above; shared prices (sugar/smp/lecithin) pull from
   * the shared editable state; plain ingredients use their own price field.
   */
  function effectivePrice(ing: Ingredient): number | null {
    switch (ing.derivedFrom) {
      case 'mass':
        return massPrice;
      case 'butter':
        return butterPrice;
      case 'powder':
        return powderPrice;
      case 'sugar':
        return num(sugarPrice);
      case 'cbs':
        return cbsPrice;
      default:
        return num(ing.price);
    }
  }

  /** Compute one recipe: per-ingredient cost + totals. */
  function computeRecipe(rows: Ingredient[], processing: string) {
    const lines = rows.map((ing) => {
      const pct = num(ing.pct) ?? 0;
      const price = effectivePrice(ing);
      // Cost per 1 MT of finished product = price(€/MT) × (pct/100).
      const cost = price != null ? price * (pct / 100) : null;
      return { ing, pct, price, cost };
    });
    const pctSum = lines.reduce((s, l) => s + l.pct, 0);
    const ingredientsCost = lines.reduce((s, l) => s + (l.cost ?? 0), 0);
    const proc = num(processing) ?? 0;
    const totalMt = ingredientsCost + proc;
    return { lines, pctSum, ingredientsCost, proc, totalMt, totalKg: totalMt / 1000 };
  }

  const rc1 = useMemo(
    () => computeRecipe(r1, processing1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [r1, processing1, sugarPrice, massPrice, butterPrice, powderPrice, cbsPrice]
  );
  const rc2 = useMemo(
    () => computeRecipe(r2, processing2),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [r2, processing2, sugarPrice, massPrice, butterPrice, powderPrice, cbsPrice]
  );

  /* ── Row editors ───────────────────────────────────────────────────────── */
  function editRow(
    setter: React.Dispatch<React.SetStateAction<Ingredient[]>>,
    idx: number,
    field: 'pct' | 'price',
    value: string
  ) {
    setter((rows) => rows.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  /* ── Live prices panel data ────────────────────────────────────────────── */
  const metrics = data?.metrics;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link href="/" className={styles.back}>
            &larr; Workspace
          </Link>
          <div className={styles.brandRow}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.brandMark}
              src="/icons/paf-commodity.svg"
              alt=""
              width={44}
              height={44}
            />
            <h1 className={styles.title}>paf_commodity</h1>
          </div>
          <p className={styles.tagline}>
            Daily cocoa &amp; FX for chocolate inputs, a live cocoa chart, and the{' '}
            <strong>Cost Crunch</strong> COGS calculator.
          </p>
        </header>

        {/* ── Live prices panel ────────────────────────────────────────────── */}
        <section className={styles.card} aria-labelledby="prices-h">
          <div className={styles.cardHead}>
            <h2 id="prices-h" className={styles.cardTitle}>
              Live prices
            </h2>
            <span className={styles.badge}>daily, not intraday</span>
          </div>

          {!loaded && <p className={styles.muted}>Loading latest snapshot…</p>}
          {loaded && !data && (
            <p className={styles.warn}>
              No price snapshot found yet. The daily action commits{' '}
              <code>public/data/commodities.json</code> — trigger it once (Actions →
              “Daily commodity prices” → Run workflow).
            </p>
          )}

          {data && metrics && (
            <>
              <div className={styles.priceGrid}>
                <PriceCell
                  label="ICE New York cocoa"
                  raw={metrics.cocoaNY}
                  eurMt={
                    metrics.cocoaNY.value != null && eurUsd
                      ? metrics.cocoaNY.value / eurUsd
                      : null
                  }
                />
                <PriceCell
                  label="ICE London cocoa"
                  raw={metrics.cocoaLondon}
                  eurMt={null}
                />
                <PriceCell label="White sugar" raw={metrics.whiteSugar} eurMt={null} />
                <div className={styles.fxCell}>
                  <span className={styles.priceLabel}>FX (live)</span>
                  <span className={styles.fxRow}>
                    EUR/USD <b>{metrics.eurUsd.value ?? '—'}</b>
                    {metrics.eurUsd.stale && <em className={styles.stale}> stale</em>}
                  </span>
                  <span className={styles.fxRow}>
                    EUR/GBP <b>{metrics.eurGbp.value ?? '—'}</b>
                    {metrics.eurGbp.stale && <em className={styles.stale}> stale</em>}
                  </span>
                  <span className={styles.src}>Yahoo Finance · {asOf(metrics.eurUsd.asOf)}</span>
                </div>
              </div>
              <p className={styles.note}>
                Snapshot generated {asOf(data.generatedAt)}. Cocoa converted to EUR via
                live EUR/USD. London cocoa &amp; white sugar have no free keyless feed yet
                (labelled “add source”) — the calculator defaults them.
              </p>
            </>
          )}
        </section>

        {/* ── Live cocoa chart (TradingView) ───────────────────────────────── */}
        <section className={styles.card} aria-labelledby="chart-h">
          <div className={styles.cardHead}>
            <h2 id="chart-h" className={styles.cardTitle}>
              Live cocoa chart
            </h2>
            <span className={styles.badgeSubtle}>TradingView · ICE US cocoa</span>
          </div>
          <TradingViewChart />
          <p className={styles.note}>
            Embedded live chart (no API key). Below: our own daily history, grown from
            each snapshot the action commits.
          </p>
          <HistoryChart history={data?.history ?? []} />
        </section>

        {/* ── HCCO daily split prices ──────────────────────────────────────── */}
        <section className={styles.card} aria-labelledby="hcco-h">
          <div className={styles.cardHead}>
            <h2 id="hcco-h" className={styles.cardTitle}>
              HCCO daily split prices
            </h2>
            <button type="button" className={styles.clearBtn} onClick={clearHcco}>
              Clear
            </button>
          </div>
          <p className={styles.note}>
            Read the four €/MT split prices off the daily HCCO PDF (report@hcco.de,{' '}
            “täglicher Marktbericht”, Mon–Fri) and enter them here. Any value{' '}
            <strong>overrides</strong> the derived-from-terminal estimate in the Cost
            Crunch below. Saved on this device (localStorage). Leave blank to use the
            derived ratio.
          </p>
          <div className={styles.hccoGrid}>
            {(
              [
                ['beans', 'Cocoa beans'],
                ['mass', 'Cocoa mass'],
                ['butter', 'Cocoa butter'],
                ['powder', 'Cocoa powder'],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className={styles.field}>
                <span className={styles.fieldLabel}>{label} €/MT</span>
                <input
                  className={styles.input}
                  inputMode="decimal"
                  placeholder="derived"
                  value={hcco[field]}
                  onChange={(e) => setHccoField(field, e.target.value)}
                />
              </label>
            ))}
            <label className={styles.field}>
              <span className={styles.fieldLabel}>As of (date)</span>
              <input
                className={styles.input}
                type="date"
                value={hcco.date}
                onChange={(e) => setHccoField('date', e.target.value)}
              />
            </label>
          </div>
        </section>

        {/* ── Cost Crunch ──────────────────────────────────────────────────── */}
        <section className={styles.card} aria-labelledby="cc-h">
          <div className={styles.cardHead}>
            <h2 id="cc-h" className={styles.cardTitle}>
              Cost Crunch — COGS calculator
            </h2>
          </div>
          <p className={styles.note}>
            Cocoa mass/butter/powder don’t trade on the exchange, so they’re{' '}
            <strong>derived</strong> from the live terminal price via editable ratios —
            unless you entered an HCCO price above (real price wins). All prices and %
            are editable and recompute instantly. These are estimates, not a paid feed.
          </p>

          {/* Derivation controls */}
          <div className={styles.derivBox}>
            <div className={styles.derivHead}>
              Derivation from terminal cocoa{' '}
              <b>{terminalEurMt != null ? eur(terminalEurMt) + '/MT' : '— (no live price)'}</b>
            </div>
            <div className={styles.derivGrid}>
              <MiniField label="Mass = terminal ×" value={liquorFactor} onChange={setLiquorFactor} />
              <MiniField
                label="Butter = terminal ×"
                value={butterRatio}
                onChange={setButterRatio}
                hint="butter ratios historically high 2024–25"
              />
              <MiniField label="Powder = terminal ×" value={powderRatio} onChange={setPowderRatio} />
            </div>
            <div className={styles.derivResults}>
              <span>
                Mass {massIsReal && <em className={styles.realTag}>HCCO</em>}:{' '}
                <b>{eur(massPrice)}/MT</b>
              </span>
              <span>
                Butter {butterIsReal && <em className={styles.realTag}>HCCO</em>}:{' '}
                <b>{eur(butterPrice)}/MT</b>
              </span>
              <span>
                Powder {powderIsReal && <em className={styles.realTag}>HCCO</em>}:{' '}
                <b>{eur(powderPrice)}/MT</b>
              </span>
            </div>
          </div>

          {/* CBS derivation */}
          <div className={styles.derivBox}>
            <div className={styles.derivHead}>
              CBS (PKS) = palm kernel oil × multiplier → <b>{eur(cbsPrice)}/MT</b>
            </div>
            <div className={styles.derivGrid}>
              <MiniField
                label="Palm kernel oil €/MT"
                value={palmKernelOil}
                onChange={setPalmKernelOil}
                hint="no free live feed — assumption"
              />
              <MiniField
                label="CBS multiplier ×"
                value={cbsMultiplier}
                onChange={setCbsMultiplier}
                hint="PKS runs ~1.7–2.0× PKO"
              />
            </div>
          </div>

          {/* Shared prices */}
          <div className={styles.sharedBox}>
            <MiniField label="Sugar €/MT" value={sugarPrice} onChange={setSugarPrice} hint="default 580 (assumption)" />
            <MiniField label="Skim milk powder €/MT" value={smpPrice} onChange={setSmpPrice} hint="EEX SMP futures = possible live source" />
            <MiniField label="Lecithin €/MT" value={lecithinPrice} onChange={setLecithinPrice} />
          </div>

          {/* Two recipes side by side */}
          <div className={styles.recipeGrid}>
            <RecipeCard
              title="Real — 30% milk chocolate"
              rows={r1}
              result={rc1}
              processing={processing1}
              onProcessing={setProcessing1}
              onEdit={(i, f, v) => editRow(setR1, i, f, v)}
              sugarPrice={sugarPrice}
              smpPrice={smpPrice}
              lecithinPrice={lecithinPrice}
              massPrice={massPrice}
              butterPrice={butterPrice}
              powderPrice={powderPrice}
              cbsPrice={cbsPrice}
            />
            <RecipeCard
              title="Compound (indication)"
              rows={r2}
              result={rc2}
              processing={processing2}
              onProcessing={setProcessing2}
              onEdit={(i, f, v) => editRow(setR2, i, f, v)}
              sugarPrice={sugarPrice}
              smpPrice={smpPrice}
              lecithinPrice={lecithinPrice}
              massPrice={massPrice}
              butterPrice={butterPrice}
              powderPrice={powderPrice}
              cbsPrice={cbsPrice}
            />
          </div>

          <p className={styles.noteSmall}>
            All figures are editable estimates: ratios and non-exchange prices are
            assumptions, not a paid feed. Cocoa terminal &amp; FX are live daily
            snapshots. Recipe % need not sum to exactly 100 — a warning shows if they’re
            off.
          </p>
        </section>

        {/* ── Sales Quotes ─────────────────────────────────────────────────── */}
        <section className={styles.card} aria-labelledby="sq-h">
          <div className={styles.cardHead}>
            <h2 id="sq-h" className={styles.cardTitle}>
              Sales Quotes
            </h2>
            <span className={styles.badgeSubtle}>chocolate/compound prices sales heard</span>
          </div>
          <p className={styles.note}>
            Log a price sales <strong>heard</strong> in the market to build a running
            overview. Every quote shows both €/MT and €/kg. Flagged{' '}
            <em>expired</em> after {QUOTE_EXPIRE_DAYS} days and auto-archived after{' '}
            {QUOTE_ARCHIVE_DAYS}. Saved on this device (localStorage).
          </p>

          {/* Compact entry row */}
          <div className={styles.quoteForm}>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Product</span>
              <select
                className={styles.input}
                value={qProduct}
                onChange={(e) => setQProduct(e.target.value as QuoteProduct)}
              >
                {QUOTE_PRODUCTS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Price</span>
              <input
                className={styles.input}
                inputMode="decimal"
                placeholder="e.g. 8500"
                value={qPrice}
                onChange={(e) => setQPrice(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addQuote();
                }}
              />
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Unit</span>
              <select
                className={styles.input}
                value={qUnit}
                onChange={(e) => setQUnit(e.target.value as QuoteUnit)}
              >
                <option value="€/MT">€/MT</option>
                <option value="€/kg">€/kg</option>
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.fieldLabel}>Note / source (optional)</span>
              <input
                className={styles.input}
                placeholder="who / where heard"
                value={qNote}
                onChange={(e) => setQNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') addQuote();
                }}
              />
            </label>
            <button type="button" className={styles.addBtn} onClick={addQuote}>
              Add
            </button>
          </div>

          {/* Per-product summary (latest active quote each) */}
          {latestByProduct.length > 0 && (
            <div className={styles.quoteSummary}>
              {latestByProduct.map((q) => {
                const p = quotePrices(q);
                return (
                  <span key={q.product} className={styles.quoteSummaryItem}>
                    {q.product}: <b>{eur(p.perMt)}/MT</b> · {eurKg(p.perKg)}/kg{' '}
                    <em className={styles.quoteAge}>{ageLabel(q.loggedAt)}</em>
                  </span>
                );
              })}
            </div>
          )}

          {/* Active quotes list */}
          {activeQuotes.length === 0 ? (
            <p className={styles.muted} style={{ marginTop: 14 }}>
              No quotes yet — add one above.
            </p>
          ) : (
            <table className={styles.quoteTable}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th className={styles.numCol}>€/MT</th>
                  <th className={styles.numCol}>€/kg</th>
                  <th>Logged</th>
                  <th>Note</th>
                  <th aria-label="delete" />
                </tr>
              </thead>
              <tbody>
                {activeQuotes.map((q) => {
                  const p = quotePrices(q);
                  const expired = daysSince(q.loggedAt) >= QUOTE_EXPIRE_DAYS;
                  return (
                    <tr key={q.id}>
                      <td>
                        {q.product}
                        {expired && (
                          <span className={styles.expiredBadge} title="older than 7 days">
                            expired quote
                          </span>
                        )}
                      </td>
                      <td className={styles.numCol}>{eur(p.perMt)}</td>
                      <td className={styles.numCol}>{eurKg(p.perKg)}</td>
                      <td className={styles.quoteWhen}>
                        {asOf(q.loggedAt)} <span className={styles.quoteAge}>· {ageLabel(q.loggedAt)}</span>
                      </td>
                      <td className={styles.quoteNote}>{q.note || '—'}</td>
                      <td className={styles.numCol}>
                        <button
                          type="button"
                          className={styles.rowDelete}
                          onClick={() => deleteQuote(q.id)}
                          aria-label={`Delete ${q.product} quote`}
                          title="Delete"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Archive (auto-archived after 30d; retained, collapsed) */}
          {archivedQuotes.length > 0 && (
            <div className={styles.archiveWrap}>
              <button
                type="button"
                className={styles.archiveToggle}
                onClick={() => setShowArchive((v) => !v)}
                aria-expanded={showArchive}
              >
                {showArchive ? 'Hide' : 'Show'} archived ({archivedQuotes.length})
              </button>
              {showArchive && (
                <table className={styles.quoteTable}>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th className={styles.numCol}>€/MT</th>
                      <th className={styles.numCol}>€/kg</th>
                      <th>Logged</th>
                      <th>Note</th>
                      <th aria-label="delete" />
                    </tr>
                  </thead>
                  <tbody>
                    {archivedQuotes.map((q) => {
                      const p = quotePrices(q);
                      return (
                        <tr key={q.id} className={styles.archivedRow}>
                          <td>{q.product}</td>
                          <td className={styles.numCol}>{eur(p.perMt)}</td>
                          <td className={styles.numCol}>{eurKg(p.perKg)}</td>
                          <td className={styles.quoteWhen}>{asOf(q.loggedAt)}</td>
                          <td className={styles.quoteNote}>{q.note || '—'}</td>
                          <td className={styles.numCol}>
                            <button
                              type="button"
                              className={styles.rowDelete}
                              onClick={() => deleteQuote(q.id)}
                              aria-label={`Delete archived ${q.product} quote`}
                              title="Delete"
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>

        <footer className={styles.footer}>Planet A Foods · internal</footer>
      </div>
    </main>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Sub-components
   ──────────────────────────────────────────────────────────────────────────── */

function PriceCell({
  label,
  raw,
  eurMt,
}: {
  label: string;
  raw: { value: number | null; currency: string | null; source: string; asOf: string | null; stale: boolean };
  eurMt: number | null;
}) {
  const available = raw.value != null;
  return (
    <div className={styles.priceCell}>
      <span className={styles.priceLabel}>{label}</span>
      {available ? (
        <>
          <span className={styles.priceMain}>
            {raw.value?.toLocaleString('en-US')} {raw.currency}/MT
          </span>
          {eurMt != null && (
            <span className={styles.priceEur}>
              {eur(eurMt)}/MT · {eurKg(eurMt / 1000)}/kg
            </span>
          )}
          {raw.stale && <span className={styles.stale}>stale — last known</span>}
        </>
      ) : (
        <span className={styles.na}>n/a — add source</span>
      )}
      <span className={styles.src}>
        {raw.source} · {asOf(raw.asOf)}
      </span>
    </div>
  );
}

function MiniField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <label className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <input
        className={styles.input}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className={styles.hint}>{hint}</span>}
    </label>
  );
}

interface RecipeResult {
  lines: { ing: Ingredient; pct: number; price: number | null; cost: number | null }[];
  pctSum: number;
  ingredientsCost: number;
  proc: number;
  totalMt: number;
  totalKg: number;
}

function RecipeCard({
  title,
  rows,
  result,
  processing,
  onProcessing,
  onEdit,
  sugarPrice,
  smpPrice,
  lecithinPrice,
  massPrice,
  butterPrice,
  powderPrice,
  cbsPrice,
}: {
  title: string;
  rows: Ingredient[];
  result: RecipeResult;
  processing: string;
  onProcessing: (v: string) => void;
  onEdit: (idx: number, field: 'pct' | 'price', value: string) => void;
  sugarPrice: string;
  smpPrice: string;
  lecithinPrice: string;
  massPrice: number | null;
  butterPrice: number | null;
  powderPrice: number | null;
  cbsPrice: number;
}) {
  // Which rows use a shared/derived price (price field disabled, shown for info).
  function displayPrice(ing: Ingredient): { text: string; locked: boolean } {
    switch (ing.derivedFrom) {
      case 'mass':
        return { text: massPrice != null ? String(Math.round(massPrice)) : '—', locked: true };
      case 'butter':
        return { text: butterPrice != null ? String(Math.round(butterPrice)) : '—', locked: true };
      case 'powder':
        return { text: powderPrice != null ? String(Math.round(powderPrice)) : '—', locked: true };
      case 'cbs':
        return { text: String(Math.round(cbsPrice)), locked: true };
      case 'sugar':
        return { text: sugarPrice, locked: true };
      default:
        return { text: ing.price, locked: false };
    }
  }

  const pctOff = Math.abs(result.pctSum - 100) > 0.01;

  return (
    <div className={styles.recipe}>
      <h3 className={styles.recipeTitle}>{title}</h3>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Ingredient</th>
            <th className={styles.numCol}>%</th>
            <th className={styles.numCol}>€/MT</th>
            <th className={styles.numCol}>Cost €/MT</th>
          </tr>
        </thead>
        <tbody>
          {result.lines.map((l, i) => {
            const dp = displayPrice(l.ing);
            return (
              <tr key={l.ing.key}>
                <td>
                  {l.ing.label}
                  {dp.locked && <span className={styles.derivedMark} title="derived / shared price">·</span>}
                </td>
                <td className={styles.numCol}>
                  <input
                    className={styles.cellInput}
                    inputMode="decimal"
                    value={l.ing.pct}
                    onChange={(e) => onEdit(i, 'pct', e.target.value)}
                    aria-label={`${l.ing.label} percent`}
                  />
                </td>
                <td className={styles.numCol}>
                  {dp.locked ? (
                    <span className={styles.lockedPrice}>{dp.text}</span>
                  ) : (
                    <input
                      className={styles.cellInput}
                      inputMode="decimal"
                      value={l.ing.price}
                      onChange={(e) => onEdit(i, 'price', e.target.value)}
                      aria-label={`${l.ing.label} price`}
                    />
                  )}
                </td>
                <td className={styles.numCol}>{eur(l.cost)}</td>
              </tr>
            );
          })}
          <tr className={styles.procRow}>
            <td>Processing</td>
            <td className={styles.numCol}>—</td>
            <td className={styles.numCol}>
              <input
                className={styles.cellInput}
                inputMode="decimal"
                value={processing}
                onChange={(e) => onProcessing(e.target.value)}
                aria-label="Processing cost"
              />
            </td>
            <td className={styles.numCol}>{eur(result.proc)}</td>
          </tr>
        </tbody>
      </table>

      <div className={styles.recipeFoot}>
        <div className={pctOff ? styles.pctWarn : styles.pctOk}>
          Σ {result.pctSum.toFixed(1)}%{pctOff ? ' — not 100%' : ''}
        </div>
        <div className={styles.cogs}>
          <span className={styles.cogsMt}>{eur(result.totalMt)}/MT</span>
          <span className={styles.cogsKg}>{eurKg(result.totalKg)}/kg</span>
        </div>
      </div>
    </div>
  );
}
