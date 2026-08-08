'use client';

import { useMemo } from 'react';
import styles from './tracker.module.css';

/**
 * Self-owned historical cocoa price line — a lightweight SVG line chart drawn
 * from the `history` array in commodities.json (grown daily by the action). No
 * chart library, no runtime dependency. Theme colours come from CSS variables.
 */
export default function HistoryChart({
  history,
}: {
  history: { date: string; cocoaEurPerMt: number }[];
}) {
  const pts = useMemo(
    () => history.filter((h) => Number.isFinite(h.cocoaEurPerMt)),
    [history]
  );

  if (pts.length === 0) {
    return (
      <p className={styles.muted}>
        No owned history yet — it grows one point per day once the action runs.
      </p>
    );
  }
  if (pts.length === 1) {
    return (
      <p className={styles.muted}>
        Owned history: 1 point so far ({pts[0].date}: €{pts[0].cocoaEurPerMt}/MT). The
        line appears once we have a few days.
      </p>
    );
  }

  const W = 640;
  const H = 160;
  const P = 28; // padding
  const values = pts.map((p) => p.cocoaEurPerMt);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const x = (i: number) => P + (i / (pts.length - 1)) * (W - 2 * P);
  const y = (v: number) => P + (1 - (v - min) / range) * (H - 2 * P);

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.cocoaEurPerMt).toFixed(1)}`).join(' ');
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z`;

  const first = pts[0];
  const last = pts[pts.length - 1];

  return (
    <div className={styles.histWrap}>
      <div className={styles.histHead}>
        <span className={styles.histTitle}>Our own daily cocoa history (€/MT)</span>
        <span className={styles.histMeta}>
          {pts.length} pts · {first.date} → {last.date}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={styles.histSvg}
        role="img"
        aria-label={`Cocoa price history from ${first.date} to ${last.date}, ${first.cocoaEurPerMt} to ${last.cocoaEurPerMt} euro per tonne`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="histFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#histFill)" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(pts.length - 1)} cy={y(last.cocoaEurPerMt)} r="3.5" fill="var(--accent)" />
      </svg>
      <div className={styles.histAxis}>
        <span>€{min.toLocaleString('en-US')}</span>
        <span>€{max.toLocaleString('en-US')}</span>
      </div>
    </div>
  );
}
