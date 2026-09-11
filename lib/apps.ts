export interface AppTile {
  /**
   * Stable identity, referenced by rows in the database (see lib/db/schema.ts).
   *
   * It is NOT the display name. A name is copy — "paf_coa" becomes "Certificates"
   * the day somebody decides it reads better — and a visibility rule keyed on
   * copy silently detaches itself the moment the copy changes, re-publishing a
   * restricted tile to the whole company with no error anywhere. Once an id is
   * in the database it does not change; rename the `name` instead.
   */
  id: string;
  /** Display name of the app. */
  name: string;
  /** One-line description shown beneath the name. */
  description: string;
  /** Absolute URL the tile links to. */
  href: string;
  /** Path (under /public) to the app's real icon, rendered as an <img>. */
  icon: string;
  /** Grouping: apps Planet A builds/runs vs. third-party SaaS. */
  category: 'internal' | 'external';
  /** Invert the icon in dark mode (for dark/monochrome logos that vanish on a dark bg). */
  invertOnDark?: boolean;
}

/**
 * The apps shown on the hub. Single source of truth for what an app IS — add,
 * remove, or reorder an app by editing this array (one line per app) and
 * nothing else.
 *
 * WHO SEES a tile is a separate question and does not live here: it is in
 * Postgres, because it changes per person and per week and a deploy is the
 * wrong unit for that. See lib/visibility.ts. Every tile in this array is
 * visible to everyone unless the database says otherwise.
 */
export const apps: AppTile[] = [
  // Internal — apps Planet A builds & runs.
  { id: 'qoaroma', name: 'QOaroma', description: 'R&D aroma & formulation analytics.', href: 'https://analytics.planet-a-foods.com', icon: '/icons/qoaroma.png', category: 'internal' },
  { id: 'paf_note', name: 'paf_note', description: 'Company wiki, notes, spaces, sprints & OKRs.', href: 'https://note.planet-a-foods.com', icon: '/icons/paf-note.svg', category: 'internal' },
  { id: 'paf_feedback', name: 'paf_feedback', description: 'Team feedback & HR workflows.', href: 'https://feedback.planet-a-foods.com', icon: '/icons/paf-feedback.svg', category: 'internal' },
  { id: 'paf_commodity', name: 'paf_commodity', description: 'Daily cocoa & FX prices + COGS calculator.', href: 'https://commodity.planet-a-foods.com', icon: '/icons/paf-commodity.svg', category: 'internal' },
  { id: 'paf_coa', name: 'paf_coa', description: 'Certificate-of-Analysis intake & customer send.', href: 'https://coa.planet-a-foods.com', icon: '/icons/paf-coa.svg', category: 'internal' },
  { id: 'paf_freight', name: 'paf_freight', description: 'Freight catchment & cheapest-origin comparison.', href: 'https://freight.planet-a-foods.com', icon: '/icons/paf-freight.svg', category: 'internal' },
  // External — third-party SaaS.
  { id: 'personio', name: 'Personio', description: 'HR, people & payroll.', href: 'https://planetafoods.app.personio.com/', icon: '/icons/personio.png', category: 'external', invertOnDark: true },
  { id: 'spendesk', name: 'Spendesk', description: 'Company spend & expense management.', href: 'https://app.spendesk.com/', icon: '/icons/spendesk.png', category: 'external' },
  { id: 'qwiki', name: 'Qwiki', description: 'Interactive process management system.', href: 'https://forplaneta.qwikinow.de', icon: '/icons/qwiki.png', category: 'external' },
];
