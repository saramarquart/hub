/**
 * Types + loader for the Commodity Tracker's committed data snapshot.
 *
 * The snapshot lives at /public/data/commodities.json and is refreshed daily by
 * .github/workflows/commodity-prices.yml. The page fetches the committed file at
 * runtime (static-export safe — no server), so this must degrade gracefully when
 * the file is missing, old, or partially stale.
 */

export type MetricUnit = 'per_tonne' | 'rate';

export interface Metric {
  label: string;
  value: number | null;
  currency: string | null;
  unit: MetricUnit;
  source: string;
  exchange: string | null;
  fetchedAt: string;
  asOf: string | null;
  stale: boolean;
}

export interface CommodityData {
  schema: number;
  generatedAt: string;
  note: string;
  metrics: {
    cocoaNY: Metric;
    cocoaLondon: Metric;
    whiteSugar: Metric;
    palmKernelOil: Metric;
    eurUsd: Metric;
    eurGbp: Metric;
  };
  derived: { cocoaEurPerMt: number | null };
  history: { date: string; cocoaEurPerMt: number }[];
}

/**
 * Fetch the committed snapshot. Uses a root-relative path (the hub is served
 * from a custom domain, basePath ''), so it resolves at runtime on Pages.
 * Returns null on any failure so the page can render its "no data" state.
 */
export async function loadCommodities(): Promise<CommodityData | null> {
  try {
    const res = await fetch('/data/commodities.json', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as CommodityData;
  } catch {
    return null;
  }
}
