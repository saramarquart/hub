export interface AppTile {
  /** Display name of the app. */
  name: string;
  /** One-line description shown beneath the name. */
  description: string;
  /** Absolute URL the tile links to. */
  href: string;
  /** Path (under /public) to the app's real icon, rendered as an <img>. */
  icon: string;
  /** Invert the icon in dark mode (for dark/monochrome logos that vanish on a dark bg). */
  invertOnDark?: boolean;
}

/**
 * The apps shown on the hub. Single source of truth — add, remove, or reorder
 * an app by editing this array (one line per app) and nothing else.
 */
export const apps: AppTile[] = [
  { name: 'QOaroma', description: 'R&D aroma & formulation analytics.', href: 'https://analytics.planet-a-foods.com', icon: '/icons/qoaroma.png' },
  { name: 'paf_note', description: 'Company wiki, notes, spaces, sprints & OKRs.', href: 'https://note.planet-a-foods.com', icon: '/icons/paf-note.svg' },
  { name: 'paf_feedback', description: 'Team feedback & HR workflows.', href: 'https://feedback.planet-a-foods.com', icon: '/icons/paf-feedback.svg' },
  { name: 'Personio', description: 'HR, people & payroll.', href: 'https://planetafoods.app.personio.com/', icon: '/icons/personio.png', invertOnDark: true },
  { name: 'Spendesk', description: 'Company spend & expense management.', href: 'https://app.spendesk.com/', icon: '/icons/spendesk.png' },
];
