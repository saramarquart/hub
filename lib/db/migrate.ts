/**
 * MIGRATIONS RUN FROM THE `start` SCRIPT, NOT FROM railway.json.
 *
 * paf_cogs declared `preDeployCommand: npm run db:migrate` in railway.json and
 * on the first real deploy it did not run: the log showed only `npm run start`,
 * the database came up with zero tables, and the app reported healthy. Railway
 * ignores the deploy block for these services. So `"start": "npm run db:migrate
 * && next start"` in package.json is how migration actually happens here.
 *
 * It costs a second on every boot and that is the price of it being true. It is
 * safe because everything below is idempotent — `IF NOT EXISTS` on every
 * statement, so a re-run prints skip notices and changes nothing — and because
 * a migration that fails stops the container instead of serving pages against a
 * schema that is not there.
 *
 * FUTURE CHANGES ARE ADDITIVE. A new column goes in as
 * `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`; a new constraint on an existing
 * table goes in a `DO $$ ... EXCEPTION WHEN duplicate_object THEN null; END $$`
 * block. The constraints below are inline in their CREATE TABLE because these
 * two tables are new — do not copy that for a table already in production.
 *
 *   npm run db:migrate          (with DATABASE_URL set)
 *   applyMigrations(sql)        (from a test)
 */
import postgres from 'postgres';

type Sql = ReturnType<typeof postgres>;

export async function applyMigrations(sql: Sql): Promise<void> {
  // Which tiles are NOT visible by default. An empty table means every tile is
  // visible to everybody, which is the state the hub ships in.
  await sql`
    CREATE TABLE IF NOT EXISTS app_restrictions (
      app_id varchar(64) PRIMARY KEY,
      note text,
      created_by varchar(255) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `;

  // Who may see a restricted tile. CASCADE because un-restricting a tile makes
  // it public again and its grants stop meaning anything — keeping them would
  // hand a stale list back to whoever restricts that tile next.
  await sql`
    CREATE TABLE IF NOT EXISTS app_restriction_grants (
      app_id varchar(64) NOT NULL REFERENCES app_restrictions(app_id) ON DELETE CASCADE,
      email varchar(255) NOT NULL,
      granted_by varchar(255) NOT NULL,
      granted_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (app_id, email)
    );
  `;

  // Every page load asks "which restricted tiles is THIS address granted", so
  // the lookup is by email, not by app. The primary key above indexes
  // (app_id, email) and is no use for that direction.
  await sql`
    CREATE INDEX IF NOT EXISTS app_restriction_grants_email_idx
      ON app_restriction_grants (email);
  `;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // NOT an error, and deliberately not exit(1). This runs from `npm start`,
    // and a deployment with no database is a supported state: with no
    // restrictions to read, every tile is visible to everyone, which is exactly
    // what the hub did before this table existed. Failing here would turn "no
    // restrictions" into "no launcher".
    console.log('DATABASE_URL is not set — no database to migrate, skipping.');
    return;
  }
  const sql = postgres(url, { max: 1 });
  try {
    await applyMigrations(sql);
    console.log('Migrations applied.');
  } finally {
    await sql.end();
  }
}

// Run only when executed directly, never when imported by the app or a test.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
