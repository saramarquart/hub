/**
 * What the console renders: one row per tile in lib/apps.ts, each carrying its
 * restriction if it has one.
 *
 * The restricted-or-not answer comes from restrictionsByAppId() in
 * lib/visibility.ts — the SAME function the launcher filters with. The console
 * deliberately does not run its own query for that, because the moment there
 * are two ways to ask "is this tile restricted" there are two answers, and the
 * console's is the one that will be wrong while looking right. The extra query
 * below is display-only metadata (who restricted it, when, and why) that the
 * launcher has no use for.
 */
import { inArray } from 'drizzle-orm';
import { apps, type AppTile } from '@/lib/apps';
import { databaseConfigured, getDb } from '@/lib/db/client';
import { appRestrictions } from '@/lib/db/schema';
import { restrictionsByAppId } from '@/lib/visibility';

export interface ConsoleRow {
  app: AppTile;
  restricted: boolean;
  /** Lower-cased addresses allowed to see it. Empty on a restricted tile means nobody. */
  grantedTo: string[];
  note: string | null;
  restrictedBy: string | null;
  restrictedAt: Date | null;
}

export interface ConsoleData {
  rows: ConsoleRow[];
  /** False when this deployment has no DATABASE_URL — a supported state the console has to admit to. */
  databaseReady: boolean;
  /** True when reading the tables failed. The console then refuses to pretend everything is unrestricted. */
  readFailed: boolean;
}

export async function loadConsoleData(): Promise<ConsoleData> {
  if (!databaseConfigured()) {
    return { rows: apps.map(plainRow), databaseReady: false, readFailed: false };
  }

  try {
    const byAppId = await restrictionsByAppId();
    const appIds = [...byAppId.keys()];
    const meta = appIds.length
      ? await getDb()
          .select({
            appId: appRestrictions.appId,
            note: appRestrictions.note,
            createdBy: appRestrictions.createdBy,
            createdAt: appRestrictions.createdAt,
          })
          .from(appRestrictions)
          .where(inArray(appRestrictions.appId, appIds))
      : [];
    const metaByAppId = new Map(meta.map((m) => [m.appId, m]));

    return {
      rows: apps.map((app) => {
        const restriction = byAppId.get(app.id);
        if (!restriction) return plainRow(app);
        const m = metaByAppId.get(app.id);
        return {
          app,
          restricted: true,
          grantedTo: [...restriction.grantedTo].sort(),
          note: m?.note ?? null,
          restrictedBy: m?.createdBy ?? null,
          restrictedAt: m?.createdAt ?? null,
        };
      }),
      databaseReady: true,
      readFailed: false,
    };
  } catch (err) {
    // visibleAppsFor() fails OPEN when Postgres is unreachable, and that is
    // right for the launcher — losing the company's front door is worse than
    // showing a tile. It is NOT right here. A console that renders every tile
    // as "visible to everyone" during an outage is telling the admin that the
    // restrictions they set are gone, and inviting them to set them again.
    console.error('[admin] could not read the visibility tables:', err);
    return { rows: apps.map(plainRow), databaseReady: true, readFailed: true };
  }
}

function plainRow(app: AppTile): ConsoleRow {
  return { app, restricted: false, grantedTo: [], note: null, restrictedBy: null, restrictedAt: null };
}
