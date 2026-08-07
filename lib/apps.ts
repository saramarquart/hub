import type { ReactNode } from 'react';
import { AromaIcon, NoteIcon, FeedbackIcon } from './icons';

export interface AppTile {
  /** Display name of the app. */
  name: string;
  /** One-line description shown beneath the name. */
  description: string;
  /** Absolute URL the tile links to. */
  href: string;
  /** Accent colour (from the violet family) used for the tile's glyph. */
  accent: string;
  /** Inline SVG glyph rendered inside the tile's icon badge. */
  icon: ReactNode;
}

/**
 * The apps shown on the hub. This is the single source of truth:
 * add, remove, or reorder an app by editing this array — nothing else.
 */
export const apps: AppTile[] = [
  {
    name: 'QOaroma',
    description: 'R&D aroma & formulation analytics.',
    href: 'https://analytics.planet-a-foods.com',
    accent: '#320F99',
    icon: AromaIcon(),
  },
  {
    name: 'note',
    description: 'Company wiki, notes, spaces, sprints & OKRs.',
    href: 'https://note.planet-a-foods.com',
    accent: '#6B3FE0',
    icon: NoteIcon(),
  },
  {
    name: 'Feedback',
    description: 'Team feedback & HR workflows.',
    href: 'https://feedback.planet-a-foods.com',
    accent: '#9A4DD9',
    icon: FeedbackIcon(),
  },
];
