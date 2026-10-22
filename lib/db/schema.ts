/**
 * Drizzle schema for paf_hub. Mirrors `migrate.ts`, which is the authority —
 * every constraint described here exists as real DDL there.
 *
 * TWO TABLES, AND THEY ARE BOTH EXCEPTION LISTS.
 *
 *   app_restrictions        which tiles are restricted at all
 *   app_restriction_grants  who may see a restricted tile
 *
 * The model is Sara's, and it is deliberately not a matrix. Seventy employees
 * times ten tiles is seven hundred rows that have to be maintained by hand and
 * re-derived every time somebody joins; two short lists is a handful of rows
 * that only exist when there is something to say. A tile is visible to
 * EVERYONE unless it appears in app_restrictions, and a tile that appears there
 * is visible only to the addresses listed against it in app_restriction_grants.
 *
 * WHAT THIS IS NOT. Hiding a tile is cosmetic. Every app the hub links to gates
 * itself — the link still works if you type it, and it is supposed to. Nothing
 * here is an access control and no future reader should treat a missing row as
 * one.
 *
 * `app_id` is not a foreign key to any table of apps, because there is no such
 * table: the tiles live in lib/apps.ts, which stays the single source of truth
 * for what an app IS (name, description, href, icon, category). This schema
 * only references them by a stable id, and a row for a tile that has since been
 * deleted from apps.ts is inert rather than an error (see visibility.ts).
 */
import { pgTable, primaryKey, timestamp, varchar, text } from 'drizzle-orm/pg-core';

/**
 * A tile that is NOT visible by default. Presence in this table is the whole
 * restriction; the grants table says who gets it back.
 *
 * A restricted tile with no grants is visible to nobody. That is a real state
 * and it is allowed on purpose — "restrict this, I will pick people in a
 * moment" has to be expressible, and the failure mode of the alternative
 * (deriving "restricted" from having at least one grant) is that removing the
 * last person silently re-publishes the tile to the whole company.
 */
export const appRestrictions = pgTable('app_restrictions', {
  /** The `id` of an AppTile in lib/apps.ts. */
  appId: varchar('app_id', { length: 64 }).primaryKey(),
  /** Why it is restricted, for whoever reads this in six months. */
  note: text('note'),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * One person who may see one restricted tile.
 *
 * ON DELETE CASCADE from app_restrictions: un-restricting a tile makes it
 * visible to everyone, so its grant rows no longer mean anything. Leaving them
 * behind would resurrect a stale list the day somebody restricts that tile
 * again — with whoever happened to be granted access last year.
 */
export const appRestrictionGrants = pgTable(
  'app_restriction_grants',
  {
    appId: varchar('app_id', { length: 64 })
      .notNull()
      .references(() => appRestrictions.appId, { onDelete: 'cascade' }),
    /** Lower-cased on the way in; the accessor compares lower-cased. */
    email: varchar('email', { length: 255 }).notNull(),
    grantedBy: varchar('granted_by', { length: 255 }).notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.appId, t.email] }),
  }),
);

export type AppRestrictionRow = typeof appRestrictions.$inferSelect;
export type AppRestrictionGrantRow = typeof appRestrictionGrants.$inferSelect;
