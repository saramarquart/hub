/**
 * fetch-commodities.mjs — daily commodity price snapshot for the Commodity Tracker.
 *
 * Run by .github/workflows/commodity-prices.yml (cron daily + manual dispatch).
 * Pulls a small set of public, keyless endpoints and writes
 * public/data/commodities.json, which the static page fetches at runtime.
 *
 * Design goals:
 *   - No API keys / no secrets. Only public Yahoo Finance query endpoints.
 *   - Graceful fallback: if a source fails, keep the LAST committed value and
 *     mark it `stale: true`. Never crash — a failed fetch must not break the
 *     daily commit or the site build.
 *   - Own our history: append today's cocoa (EUR/MT) to a `history` array so we
 *     have a growing, self-owned price series independent of any third-party
 *     chart embed. Seeded with today's value on first run.
 *
 * Notes on sources:
 *   - Cocoa terminal price: ICE New York cocoa, Yahoo `CC=F` (USD/tonne). Works.
 *   - ICE London cocoa: no reliable free/keyless Yahoo symbol found at build
 *     time; left as `n/a — add source` (operator can wire a source later).
 *     (ICCO publishes a daily price = avg of nearest London+NY futures — an
 *     acceptable alternative if a clean keyless fetch is found.)
 *   - White sugar (ICE `SW=F` / `RC=F`): delisted on Yahoo; left null. The
 *     calculator defaults sugar to €580/MT and labels it an assumption.
 *   - FX: EUR/USD (`EURUSD=X`) and EUR/GBP (`EURGBP=X`) to convert to EUR.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = `${__dirname}/../public/data/commodities.json`;

const YF_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const UA = 'Mozilla/5.0 (compatible; paf-hub-commodity-bot/1.0)';

/** Fetch a Yahoo Finance chart quote. Returns { price, currency, time } or null. */
async function fetchYahoo(symbol) {
  const url = `${YF_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const meta = result?.meta;
    if (!meta || typeof meta.regularMarketPrice !== 'number') {
      throw new Error('no regularMarketPrice in response');
    }
    return {
      price: meta.regularMarketPrice,
      currency: meta.currency ?? null,
      time: meta.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now(),
      exchange: meta.fullExchangeName ?? null,
    };
  } catch (err) {
    console.warn(`[fetch-commodities] ${symbol} failed: ${err.message}`);
    return null;
  }
}

/** Read the last committed JSON so we can fall back on any failed source. */
async function readPrevious() {
  try {
    const raw = await readFile(OUT_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Build one metric entry. If `fetched` is null (source failed), reuse the
 * previous value (if any) and mark it stale. If there is no previous value
 * either, emit a null placeholder marked stale.
 */
function metric({ label, fetched, prevEntry, unit, source }) {
  if (fetched) {
    return {
      label,
      value: fetched.price,
      currency: fetched.currency,
      unit,
      source,
      exchange: fetched.exchange ?? null,
      fetchedAt: new Date().toISOString(),
      asOf: new Date(fetched.time).toISOString(),
      stale: false,
    };
  }
  if (prevEntry) {
    return { ...prevEntry, stale: true };
  }
  return {
    label,
    value: null,
    currency: null,
    unit,
    source,
    exchange: null,
    fetchedAt: new Date().toISOString(),
    asOf: null,
    stale: true,
  };
}

async function main() {
  const prev = await readPrevious();
  const prevMetrics = prev?.metrics ?? {};

  const [cocoaNY, eurUsd, eurGbp] = await Promise.all([
    fetchYahoo('CC=F'),
    fetchYahoo('EURUSD=X'),
    fetchYahoo('EURGBP=X'),
  ]);

  const metrics = {
    cocoaNY: metric({
      label: 'ICE New York cocoa',
      fetched: cocoaNY,
      prevEntry: prevMetrics.cocoaNY,
      unit: 'per_tonne',
      source: 'Yahoo Finance (CC=F, ICE US)',
    }),
    // No reliable free/keyless London cocoa symbol found — explicit placeholder.
    cocoaLondon: prevMetrics.cocoaLondon ?? {
      label: 'ICE London cocoa',
      value: null,
      currency: 'GBP',
      unit: 'per_tonne',
      source: 'n/a — add source',
      exchange: null,
      fetchedAt: new Date().toISOString(),
      asOf: null,
      stale: true,
    },
    // White sugar: no working free Yahoo symbol (SW=F / RC=F delisted). Null →
    // calculator defaults it and labels the default an assumption.
    whiteSugar: prevMetrics.whiteSugar ?? {
      label: 'ICE white sugar',
      value: null,
      currency: 'USD',
      unit: 'per_tonne',
      source: 'n/a — add source',
      exchange: null,
      fetchedAt: new Date().toISOString(),
      asOf: null,
      stale: true,
    },
    // Palm kernel oil: no live free/keyless source found. Yahoo CPO=F (CME crude
    // palm oil) exists but its quote is frozen (stale) and thinly traded; Bursa
    // Malaysia FCPO needs a paid/keyed feed. Left null → the CBS price in the
    // calculator uses an editable palm-kernel-oil default × multiplier instead.
    palmKernelOil: prevMetrics.palmKernelOil ?? {
      label: 'Palm kernel oil',
      value: null,
      currency: 'USD',
      unit: 'per_tonne',
      source: 'n/a — add source',
      exchange: null,
      fetchedAt: new Date().toISOString(),
      asOf: null,
      stale: true,
    },
    eurUsd: metric({
      label: 'EUR/USD',
      fetched: eurUsd,
      prevEntry: prevMetrics.eurUsd,
      unit: 'rate',
      source: 'Yahoo Finance (EURUSD=X)',
    }),
    eurGbp: metric({
      label: 'EUR/GBP',
      fetched: eurGbp,
      prevEntry: prevMetrics.eurGbp,
      unit: 'rate',
      source: 'Yahoo Finance (EURGBP=X)',
    }),
  };

  // Derive cocoa (NY) in EUR/MT for our self-owned history series.
  let cocoaEurPerMt = null;
  if (metrics.cocoaNY.value != null && metrics.eurUsd.value) {
    // CC=F is USD/tonne; EUR = USD / (EUR/USD).
    cocoaEurPerMt = Math.round(metrics.cocoaNY.value / metrics.eurUsd.value);
  }

  // Append to history (one point per UTC day; replace same-day re-runs).
  const today = new Date().toISOString().slice(0, 10);
  const prevHistory = Array.isArray(prev?.history) ? prev.history : [];
  const history = prevHistory.filter((h) => h.date !== today);
  if (cocoaEurPerMt != null) {
    history.push({ date: today, cocoaEurPerMt });
  } else if (prevHistory.length) {
    // Source failed today — carry the series forward untouched (keep prev rows).
    history.length = 0;
    history.push(...prevHistory);
  }
  history.sort((a, b) => (a.date < b.date ? -1 : 1));
  // Keep the series bounded (~2 years of daily points).
  const trimmed = history.slice(-750);

  const payload = {
    schema: 1,
    generatedAt: new Date().toISOString(),
    note: 'Daily snapshot (not intraday). Prices from public keyless endpoints; some values are assumptions — see labels.',
    metrics,
    derived: { cocoaEurPerMt },
    history: trimmed,
  };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(
    `[fetch-commodities] wrote ${OUT_PATH} — cocoaNY=${metrics.cocoaNY.value} ${metrics.cocoaNY.currency}, ` +
      `EUR/USD=${metrics.eurUsd.value}, cocoa=€${cocoaEurPerMt}/MT, history=${trimmed.length} pts`
  );
}

main().catch((err) => {
  // Last-resort guard: log but exit 0 so a transient failure never breaks the
  // scheduled commit or the site build. The page tolerates a missing/old file.
  console.error('[fetch-commodities] unexpected error:', err);
  process.exit(0);
});
