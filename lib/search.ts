import { apps, groups, type AppTile } from './apps';

const TEAM_GROUPS = new Set(['rnd-procurement', 'operations-quality', 'sales-finance']);

/** The label of the row/section an app sits in, e.g. "R&D & Procurement". */
export function groupLabel(app: AppTile): string {
  return groups.find((g) => g.key === app.group)?.label ?? '';
}

/** Lowercase words; keeps '&' inside words so "R&D" and "P&L" stay whole. */
function words(text: string): string[] {
  return text.toLowerCase().split(/[\s,.;:()/+]+/).filter(Boolean);
}

/**
 * Apps matching `query`, best match first. Every word of the query has to
 * match the app's name, keywords, description or group; name matches rank
 * above keyword (alias) matches, which rank above description and group.
 * Ties keep the hub's own order. An empty query returns every app.
 */
export function searchApps(query: string, list: AppTile[] = apps): AppTile[] {
  const tokens = words(query);
  if (!tokens.length) return list;
  const scored: { app: AppTile; index: number; score: number }[] = [];
  list.forEach((app, index) => {
    const name = app.name.toLowerCase();
    const shortName = name.replace(/^paf_/, '');
    const phrases = (app.keywords ?? []).map((k) => k.toLowerCase());
    const keywordWords = phrases.flatMap(words);
    const description = words(app.description);
    const group = words(`${groupLabel(app)}${TEAM_GROUPS.has(app.group) ? ' teams' : ''}`);
    let score = 0;
    for (const t of tokens) {
      let best = 0;
      if (name === t || shortName === t) best = 120;
      else if (name.startsWith(t) || shortName.startsWith(t)) best = 100;
      else if (name.includes(t)) best = 60;
      if (phrases.includes(t) || keywordWords.includes(t)) best = Math.max(best, 80);
      else if (keywordWords.some((w) => w.startsWith(t))) best = Math.max(best, 50);
      if (description.some((w) => w.startsWith(t))) best = Math.max(best, 30);
      if (group.some((w) => w.startsWith(t))) best = Math.max(best, 20);
      if (!best) return;
      score += best;
    }
    scored.push({ app, index, score });
  });
  return scored.sort((a, b) => b.score - a.score || a.index - b.index).map((s) => s.app);
}
