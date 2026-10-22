/**
 * Which tiles a given person sees.
 *
 * THE RULE, in one line: a tile is visible to everyone by default, and a
 * RESTRICTED tile names who may see it.
 *
 * Everything else follows from that. An empty database means the hub behaves
 * exactly as it did when the tile list was a static array — nobody has said
 * "not everyone needs paf_freight" yet, so everybody gets paf_freight. There is
 * no per-user row to create when somebody joins, no row to delete when they
 * leave, and no 70 × 10 matrix to keep true.
 *
 * COSMETIC, NOT ACCESS CONTROL. A hidden tile is a link the hub does not draw.
 * The app behind it is still there, still on its own hostname, and still gates
 * itself — paf_freight checks its own allow-list, paf_coa checks its own. This
 * module tidies a launcher; it does not defend anything, and no caller should
 * be written as though it does.
 */
import { and, eq, inArray } from 'drizzle-orm';
import { apps as allApps, type AppTile } from '@/lib/apps';
import { databaseConfigured, getDb } from '@/lib/db/client';
import { appRestrictionGrants, appRestrictions } from '@/lib/db/schema';

/** A restricted tile and the addresses allowed to see it. */
export interface Restriction {
  appId: string;
  /** Lower-cased. Empty means the tile is visible to nobody — a real state. */
  grantedTo: string[];
}

/**
 * The rule itself, pure, so the cases that matter can be tested without a
 * database: no restrictions, a restriction the viewer is on, one they are not,
 * a restriction with an empty grant list, and a restriction naming a tile that
 * no longer exists.
 *
 * Order is preserved: the grid's Internal/External grouping and the deliberate
 * ordering inside each group come from lib/apps.ts, and filtering must not
 * reshuffle them.
 */
export function filterAppsForEmail(
  tiles: readonly AppTile[],
  restrictions: readonly Restriction[],
  email: string,
): AppTile[] {
  if (restrictions.length === 0) return [...tiles];
  const viewer = (email ?? '').trim().toLowerCase();
  const byAppId = new Map(restrictions.map((r) => [r.appId, r]));
  return tiles.filter((tile) => {
    const restriction = byAppId.get(tile.id);
    if (!restriction) return true;
    return restriction.grantedTo.includes(viewer);
  });
}

/**
 * Read the restriction lists. Returns [] — "nothing is restricted" — when there
 * is no database configured, which is the state `npm run dev` runs in.
 *
 * A restriction row naming a tile that is no longer in lib/apps.ts is dropped
 * here rather than carried around: the tile is gone, so the rule about it is a
 * fact about nothing. It is NOT deleted from the table, because a tile removed
 * by accident and put back the same afternoon should come back restricted.
 */
export async function loadRestrictions(): Promise<Restriction[]> {
  if (!databaseConfigured()) return [];

  const db = getDb();
  const known = new Set(allApps.map((a) => a.id));

  const rows = await db.select({ appId: appRestrictions.appId }).from(appRestrictions);
  const appIds = rows.map((r) => r.appId).filter((id) => known.has(id));
  if (appIds.length === 0) return [];

  const grants = await db
    .select({ appId: appRestrictionGrants.appId, email: appRestrictionGrants.email })
    .from(appRestrictionGrants)
    .where(inArray(appRestrictionGrants.appId, appIds));

  const grantedTo = new Map<string, string[]>(appIds.map((id) => [id, []]));
  for (const g of grants) {
    grantedTo.get(g.appId)?.push(g.email.trim().toLowerCase());
  }
  return appIds.map((appId) => ({ appId, grantedTo: grantedTo.get(appId) ?? [] }));
}

/**
 * The accessor the page calls: the tiles this address should see.
 *
 * FAILS OPEN, on purpose, and this is the one place in the codebase where that
 * is the right answer. If Postgres is down, the choice is between a launcher
 * showing one or two tiles somebody was not meant to notice, and the whole
 * company losing its front door. The tiles are cosmetic; the front door is not.
 * Nothing is protected by the tile being absent — see the header comment.
 */
export async function visibleAppsFor(
  email: string,
  tiles: readonly AppTile[] = allApps,
): Promise<AppTile[]> {
  try {
    return filterAppsForEmail(tiles, await loadRestrictions(), email);
  } catch (err) {
    console.error('[visibility] could not read restrictions, showing every tile:', err);
    return [...tiles];
  }
}

/**
 * Everything the admin console needs to render one row per tile. Not used by
 * the launcher — it is here so the console reads the same table through the
 * same module rather than growing a second opinion about what "restricted"
 * means.
 */
export async function restrictionsByAppId(): Promise<Map<string, Restriction>> {
  return new Map((await loadRestrictions()).map((r) => [r.appId, r]));
}

/** Narrow helper for the console: is this one address granted this one tile? */
export async function isGranted(appId: string, email: string): Promise<boolean> {
  if (!databaseConfigured()) return true;
  const rows = await getDb()
    .select({ email: appRestrictionGrants.email })
    .from(appRestrictionGrants)
    .where(
      and(
        eq(appRestrictionGrants.appId, appId),
        eq(appRestrictionGrants.email, email.trim().toLowerCase()),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
