/**
 * Who an app is for. Drives where it appears on the hub: after the hero
 * (`featured`), the team groups, then Company, then People & Culture (see `groups`).
 */
export type AppGroup =
  | 'rnd-procurement'
  | 'operations-quality'
  | 'sales-finance'
  | 'company'
  | 'people-culture';

export interface AppTile {
  /** Display name of the app. */
  name: string;
  /** One-line description shown beneath the name. */
  description: string;
  /** Absolute URL the tile links to. */
  href: string;
  /** Path (under /public) to the app's real icon, rendered as an <img>. */
  icon: string;
  /** Apps Planet A builds/runs vs. third-party SaaS. External apps get a ↗ marker. */
  category: 'internal' | 'external';
  /** Who uses it: the section and row the app appears in. */
  group: AppGroup;
  /** Invert the icon in dark mode (for dark/monochrome logos that vanish on a dark bg). */
  invertOnDark?: boolean;
  /** The hero tile at the very top (paf_note, the daily workspace). Never repeated in "Your apps". */
  featured?: boolean;
  /** Extra words quick search (⌘K) should match, e.g. 'wiki' for paf_note. Lowercase. */
  keywords?: string[];
  /**
   * Date windows when the app is highlighted: the tile gets a small badge with
   * `note`, and the app is added to "Your apps". `from`/`to` are inclusive
   * dates (YYYY-MM-DD) in the viewer's local time, checked in the browser, so
   * no redeploy is needed when a window opens or closes.
   */
  highlight?: Highlight[];
}

export interface Highlight {
  /** First day, inclusive, as 'YYYY-MM-DD'. */
  from: string;
  /** Last day, inclusive, as 'YYYY-MM-DD'. */
  to: string;
  /** Short badge text, e.g. 'Feedback round open'. */
  note: string;
}

/** The groups, in display order. The first three are rows under "Teams"; Company ("Company tools" on the hub, minus the featured hero) and People & Culture are sections of their own. */
export const groups: { key: AppGroup; label: string }[] = [
  { key: 'rnd-procurement', label: 'R&D & Procurement' },
  { key: 'operations-quality', label: 'Operations & Quality' },
  { key: 'sales-finance', label: 'Sales & Finance' },
  { key: 'company', label: 'Company' },
  { key: 'people-culture', label: 'People & Culture' },
];

/**
 * The apps shown on the hub. Single source of truth — add, remove, or reorder
 * an app by editing this array (one line per app) and nothing else. Order
 * within a group is the display order.
 */
export const apps: AppTile[] = [
  // The daily workspace: shown as the hero tile at the top of the hub.
  { name: 'paf_note', description: 'Company wiki, notes, spaces, sprints & OKRs.', href: 'https://note.planet-a-foods.com', icon: '/icons/paf-note.svg', category: 'internal', group: 'company', featured: true, keywords: ['wiki', 'notes', 'docs', 'okr', 'okrs', 'sprints', 'spaces'] },
  // R&D & Procurement.
  { name: 'QOaroma', description: 'R&D aroma & formulation analytics.', href: 'https://analytics.planet-a-foods.com', icon: '/icons/qoaroma.png', category: 'internal', group: 'rnd-procurement', keywords: ['r&d', 'rnd', 'aroma', 'flavour', 'flavor', 'formulation', 'analytics', 'lab'] },
  { name: 'paf_commodity', description: 'Daily cocoa & FX prices + COGS calculator.', href: 'https://commodity.planet-a-foods.com', icon: '/icons/paf-commodity.svg', category: 'internal', group: 'rnd-procurement', keywords: ['commodity', 'cocoa', 'prices', 'fx', 'cogs', 'procurement', 'purchasing'] },
  // Operations & Quality.
  { name: 'paf_supplychain', description: 'Supply chain planning & operations.', href: 'https://supplychain.planet-a-foods.com', icon: '/icons/paf-supplychain.svg', category: 'internal', group: 'operations-quality', keywords: ['supply chain', 'supply', 'planning', 'operations', 'ops', 'logistics'] },
  { name: 'paf_freight', description: 'Freight catchment & cheapest-origin comparison.', href: 'https://freight.planet-a-foods.com', icon: '/icons/paf-freight.svg', category: 'internal', group: 'operations-quality', keywords: ['freight', 'shipping', 'transport', 'logistics', 'origin'] },
  { name: 'paf_coa', description: 'Certificate-of-Analysis intake & customer send.', href: 'https://coa.planet-a-foods.com', icon: '/icons/paf-coa.svg', category: 'internal', group: 'operations-quality', keywords: ['coa', 'certificate', 'analysis', 'quality', 'qm'] },
  // Sales & Finance.
  { name: 'paf_force', description: 'Sales & partnerships account intelligence.', href: 'https://sales.planet-a-foods.com', icon: '/icons/paf-sales.svg', category: 'internal', group: 'sales-finance', keywords: ['sales', 'crm', 'accounts', 'customers', 'partners', 'partnerships'] },
  { name: 'paf_finance', description: 'Finance, P&L & reporting.', href: 'https://finance.planet-a-foods.com', icon: '/icons/paf-finance.svg', category: 'internal', group: 'sales-finance', keywords: ['finance', 'p&l', 'reporting', 'controlling'] },
  // Company tools (external).
  { name: 'Personio', description: 'HR, people & payroll.', href: 'https://planetafoods.app.personio.com/', icon: '/icons/personio.png', category: 'external', group: 'company', invertOnDark: true, keywords: ['hr', 'people', 'payroll', 'absence', 'vacation', 'time off'] },
  { name: 'Moss', description: 'Company spend & expense management.', href: 'https://getmoss.com/login', icon: '/icons/moss.png', category: 'external', group: 'company', keywords: ['spend', 'expenses', 'expense', 'receipts', 'cards'] },
  { name: 'Ariadne', description: 'Interactive process management system (formerly qWiki).', href: 'https://forplaneta.ariadne.cloud', icon: '/icons/ariadne.png', category: 'external', group: 'company', keywords: ['process', 'processes', 'qwiki', 'sop', 'qm'] },
  // People & Culture (used rarely, so it comes last and is visually quieter).
  //
  // Seasonal highlights: add date windows to `highlight: []` below. While a
  // window is open the tile shows the note as a badge and the app also appears
  // in "Your apps". Dates are inclusive, local time. Example:
  //   highlight: [{ from: '2027-01-10', to: '2027-01-31', note: 'Feedback round open' }]
  { name: 'paf_feedback', description: 'Team feedback & HR workflows.', href: 'https://feedback.planet-a-foods.com', icon: '/icons/paf-feedback.svg', category: 'internal', group: 'people-culture', keywords: ['hr', 'feedback', 'reviews', 'performance'], highlight: [] },
  { name: 'paf_training', description: 'Mandatory employee training & compliance quizzes.', href: 'https://training.planet-a-foods.com', icon: '/icons/paf-training.svg', category: 'internal', group: 'people-culture', keywords: ['training', 'compliance', 'quiz', 'courses', 'onboarding'], highlight: [] },
];

/** Today's date as 'YYYY-MM-DD' in the viewer's local time. */
export function localToday(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The note of the app's highlight window that contains `today` ('YYYY-MM-DD'), if any. Malformed windows are ignored. */
export function activeHighlight(app: AppTile, today: string): string | undefined {
  return app.highlight?.find(
    (h) => ISO_DATE.test(h.from) && ISO_DATE.test(h.to) && h.from <= today && today <= h.to,
  )?.note;
}
