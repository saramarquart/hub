/** Who an app is for. Drives the sections on the hub (see `groups` below). */
export type AppGroup = 'everyone' | 'rnd-procurement' | 'operations-quality' | 'sales-finance';

export interface AppTile {
  /** Display name of the app. */
  name: string;
  /** One-line description shown beneath the name. */
  description: string;
  /** Absolute URL the tile links to. */
  href: string;
  /** Path (under /public) to the app's real icon, rendered as an <img>. */
  icon: string;
  /** Apps Planet A builds/runs vs. third-party SaaS. Splits "For everyone" into "Our apps" / "External tools"; external apps get a ↗ marker. */
  category: 'internal' | 'external';
  /** Who uses it: the section and row the app appears in. */
  group: AppGroup;
  /** Invert the icon in dark mode (for dark/monochrome logos that vanish on a dark bg). */
  invertOnDark?: boolean;
}

/** The groups, in display order. 'everyone' is the first section; the rest are rows under "Teams". */
export const groups: { key: AppGroup; label: string }[] = [
  { key: 'everyone', label: 'For everyone' },
  { key: 'rnd-procurement', label: 'R&D & Procurement' },
  { key: 'operations-quality', label: 'Operations & Quality' },
  { key: 'sales-finance', label: 'Sales & Finance' },
];

/**
 * The apps shown on the hub. Single source of truth — add, remove, or reorder
 * an app by editing this array (one line per app) and nothing else. Order
 * within a group is the display order.
 */
export const apps: AppTile[] = [
  // For everyone: our own apps first, then external tools (rendered as two rows).
  { name: 'paf_note', description: 'Company wiki, notes, spaces, sprints & OKRs.', href: 'https://note.planet-a-foods.com', icon: '/icons/paf-note.svg', category: 'internal', group: 'everyone' },
  { name: 'paf_training', description: 'Mandatory employee training & compliance quizzes.', href: 'https://training.planet-a-foods.com', icon: '/icons/paf-training.svg', category: 'internal', group: 'everyone' },
  { name: 'paf_feedback', description: 'Team feedback & HR workflows.', href: 'https://feedback.planet-a-foods.com', icon: '/icons/paf-feedback.svg', category: 'internal', group: 'everyone' },
  { name: 'Personio', description: 'HR, people & payroll.', href: 'https://planetafoods.app.personio.com/', icon: '/icons/personio.png', category: 'external', group: 'everyone', invertOnDark: true },
  { name: 'Moss', description: 'Company spend & expense management.', href: 'https://getmoss.com/login', icon: '/icons/moss.png', category: 'external', group: 'everyone' },
  { name: 'Ariadne', description: 'Interactive process management system (formerly qWiki).', href: 'https://forplaneta.ariadne.cloud', icon: '/icons/ariadne.png', category: 'external', group: 'everyone' },
  // R&D & Procurement.
  { name: 'QOaroma', description: 'R&D aroma & formulation analytics.', href: 'https://analytics.planet-a-foods.com', icon: '/icons/qoaroma.png', category: 'internal', group: 'rnd-procurement' },
  { name: 'paf_commodity', description: 'Daily cocoa & FX prices + COGS calculator.', href: 'https://commodity.planet-a-foods.com', icon: '/icons/paf-commodity.svg', category: 'internal', group: 'rnd-procurement' },
  // Operations & Quality.
  { name: 'paf_supplychain', description: 'Supply chain planning & operations.', href: 'https://supplychain.planet-a-foods.com', icon: '/icons/paf-supplychain.svg', category: 'internal', group: 'operations-quality' },
  { name: 'paf_freight', description: 'Freight catchment & cheapest-origin comparison.', href: 'https://freight.planet-a-foods.com', icon: '/icons/paf-freight.svg', category: 'internal', group: 'operations-quality' },
  { name: 'paf_coa', description: 'Certificate-of-Analysis intake & customer send.', href: 'https://coa.planet-a-foods.com', icon: '/icons/paf-coa.svg', category: 'internal', group: 'operations-quality' },
  // Sales & Finance.
  { name: 'paf_force', description: 'Sales & partnerships account intelligence.', href: 'https://sales.planet-a-foods.com', icon: '/icons/paf-sales.svg', category: 'internal', group: 'sales-finance' },
  { name: 'paf_finance', description: 'Finance, P&L & reporting.', href: 'https://finance.planet-a-foods.com', icon: '/icons/paf-finance.svg', category: 'internal', group: 'sales-finance' },
];
