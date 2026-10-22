/**
 * Postgres client + Drizzle handle. Same shape as paf_cogs' src/lib/db/client.ts:
 * the `postgres` driver, one lazily-created pool cached on `globalThis` so Next's
 * dev server does not open a new pool on every hot reload.
 *
 * Nothing throws at import time — DATABASE_URL is only needed when a query
 * actually runs, so `next build` (NODE_ENV=production, no runtime env) works.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

declare global {
  // eslint-disable-next-line no-var
  var __paf_hub_sql: ReturnType<typeof postgres> | undefined;
}

/**
 * Postgres codes for "that object already exists, skipping". The idempotent
 * migrations emit one NOTICE per table and index on EVERY boot — a handful of
 * lines saying nothing happened, which is how a real notice gets scrolled past.
 * Those are dropped; anything else the server says is still printed.
 */
const ALREADY_EXISTS = new Set(['42P07', '42710', '42P06', '42701', '42P16']);

/** True when this deployment has a database at all. See visibility.ts. */
export function databaseConfigured(): boolean {
  return !!process.env.DATABASE_URL;
}

export function getSql() {
  if (!global.__paf_hub_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    global.__paf_hub_sql = postgres(url, {
      max: 5,
      prepare: false,
      onnotice: (notice) => {
        if (!ALREADY_EXISTS.has(String(notice.code))) console.warn('[pg]', notice.message);
      },
    });
  }
  return global.__paf_hub_sql;
}

export function getDb() {
  return drizzle(getSql(), { schema });
}

export type Db = ReturnType<typeof getDb>;
