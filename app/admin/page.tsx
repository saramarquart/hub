import Link from 'next/link';
import ThemeToggle from '../ThemeToggle';
import styles from './admin.module.css';
import { grantApp, refreshDirectory, restrictApp, revokeApp, unrestrictApp } from './actions';
import { loadConsoleData, type ConsoleRow } from './data';
import { addressesOutsideDomains } from '@/lib/admin';
import { requireAdmin } from '@/lib/auth/admin';
import { ALLOWED_DOMAINS, ALLOWED_EMAILS } from '@/lib/config';
import { loadDirectory, type DirectoryUser } from '@/lib/directory';

/**
 * Tile visibility, app-first: nine tiles listed, each either "everyone" or
 * restricted to a named list.
 *
 * WHY APP-FIRST AND NOT PERSON-FIRST. Sara asked for "select/unselect internal
 * apps depending on the user email address", which could be read either way,
 * and the numbers decide it. There are nine tiles and about seventy people. A
 * person-first console opens on a search box — find a colleague before you can
 * see anything — and then shows nine checkboxes of which, for sixty-eight of
 * those seventy people, every one is ticked and there is nothing to say. It
 * would render the default (everyone sees everything) as seventy identical
 * screens of ticks, and the exceptional case would be invisible among them.
 *
 * App-first opens on the whole truth: nine rows, and the two or three that are
 * not "everyone" are the only ones with anything in them. It also matches the
 * table underneath — app_restrictions is keyed by app_id — so there is no
 * translation layer between what the admin sees and what is stored, and no way
 * for the screen and the database to drift into disagreeing.
 *
 * The sentence Sara actually said is app-shaped too: "not everyone needs
 * qoaroma or paf_freight". She named tiles, not people.
 */
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tile visibility · Planet A Foods' };

/**
 * One sentence per outcome. Same approach as the sign-in page's ERRORS map: the
 * actions are plain form posts that redirect, so the only channel from a
 * mutation back to the page is the query string.
 */
function statusMessage(params: {
  msg?: string;
  err?: string;
  app?: string;
  n?: string;
  bad?: string;
}): { text: string; tone: 'ok' | 'error' } | null {
  const bad = Number(params.bad ?? '0');
  const badTail = bad > 0 ? ` ${bad} entr${bad === 1 ? 'y was' : 'ies were'} not a valid email address and ${bad === 1 ? 'was' : 'were'} ignored.` : '';

  if (params.err) {
    const errors: Record<string, string> = {
      denied:
        'That did not go through: this page is for admins, and your session is either not one or has expired. Sign in again.',
      no_db:
        'No database is configured on this deployment, so there is nowhere to store a restriction.',
      unknown_app:
        'That app id is not in lib/apps.ts, so nothing was written. If a tile was just renamed, its id has not changed — reload this page.',
      no_emails: `No valid email address was given, so nothing was added.${badTail}`,
    };
    return { text: errors[params.err] ?? 'Something went wrong and nothing was changed.', tone: 'error' };
  }

  if (params.msg) {
    const n = Number(params.n ?? '0');
    const ok: Record<string, string> = {
      restricted:
        'Restricted. Until somebody is added below, this tile is on nobody’s launcher — including yours.',
      unrestricted: 'That tile is back on everyone’s launcher, and its list of people was cleared.',
      granted: `Added ${n} ${n === 1 ? 'person' : 'people'}.${badTail}`,
      revoked: 'Removed.',
      directory_refreshed: 'Asked Google for the staff directory again.',
    };
    const text = ok[params.msg];
    return text ? { text, tone: 'ok' } : null;
  }

  return null;
}

export default async function AdminPage({
  searchParams,
}: {
  // Next 15 hands this over as a Promise, where Next 14 handed a plain object.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // middleware.ts got the anonymous visitors. It did NOT get the other
  // sixty-nine employees — it admits everyone with a @forplaneta.com account,
  // because that is the hub's access rule. This is the check that matters.
  const session = await requireAdmin();

  const params = await searchParams;
  const one = (k: string) => {
    const v = params[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const status = statusMessage({
    msg: one('msg'),
    err: one('err'),
    app: one('app'),
    n: one('n'),
    bad: one('bad'),
  });

  const [{ rows, databaseReady, readFailed }, directory] = await Promise.all([
    loadConsoleData(),
    loadDirectory(),
  ]);

  const internal = rows.filter((r) => r.app.category === 'internal');
  const external = rows.filter((r) => r.app.category === 'external');
  const restrictedCount = rows.filter((r) => r.restricted).length;
  const writable = databaseReady && !readFailed;

  return (
    <>
      <div className="bg-orbs" aria-hidden="true" />
      <ThemeToggle />
      <main className={styles.page}>
        <div className={styles.shell}>
          <header className={styles.header}>
            <Link className={styles.back} href="/">
              <span aria-hidden="true">←</span> Back to the hub
            </Link>
            <h1 className={styles.title}>Tile visibility</h1>
            <p className={styles.tagline}>
              Every tile is on everyone’s launcher unless it is restricted here.{' '}
              {restrictedCount === 0
                ? 'Nothing is restricted at the moment.'
                : `${restrictedCount} of ${rows.length} ${restrictedCount === 1 ? 'tile is' : 'tiles are'} restricted.`}
            </p>

            {/*
              The honest sentence, at the top, before anything can be clicked.
              Sara's own words were "exactly, hiding the tile is good enough" —
              this console is built on that and must not be mistaken for more.
              paf_coa, paf_freight and the rest each gate themselves; paf_cogs'
              allow-list is literally one person.
            */}
            <p className={styles.honest}>
              <strong>This tidies the launcher. It is not access control.</strong> Hiding a tile
              only stops the hub drawing a link to it — anyone who has the URL still reaches the
              app, and is still stopped (or not) by that app’s own sign-in. Use this to keep
              people’s launchers relevant, never to keep them out of something.
            </p>
          </header>

          {status && (
            <p
              className={status.tone === 'error' ? styles.error : styles.ok}
              role="status"
              aria-live="polite"
            >
              {status.text}
            </p>
          )}

          {!databaseReady && (
            <p className={styles.warn} role="status">
              No <code>DATABASE_URL</code> on this deployment, so restrictions cannot be stored and
              every tile is visible to everyone. This is the state <code>npm run dev</code> runs in.
            </p>
          )}
          {readFailed && (
            <p className={styles.warn} role="status">
              The visibility tables could not be read just now, so this page cannot show what is
              restricted. It is showing every tile as unrestricted, which may not be true — do not
              change anything until it loads cleanly.
            </p>
          )}

          <DirectoryNotice directory={directory} />

          <Section
            label="Internal"
            hint="Apps Planet A builds and runs."
            rows={internal}
            directory={directory.users}
            writable={writable}
            adminEmail={session.email}
          />
          <Section
            label="External"
            hint="Third-party SaaS."
            rows={external}
            directory={directory.users}
            writable={writable}
            adminEmail={session.email}
          />

          {/*
            One datalist for the whole page. When the directory is unavailable it
            renders with no options, and an <input list="…"> pointing at an empty
            datalist behaves exactly like a plain text input — which is the whole
            degradation strategy in one line of HTML, with no branch to get wrong.
          */}
          <datalist id="paf-directory">
            {directory.users.map((u) => (
              <option key={u.email} value={u.email}>
                {u.name}
              </option>
            ))}
          </datalist>

          <footer className={styles.footer}>
            <span>
              Signed in as {session.email} · admins are set by <code>ADMIN_EMAILS</code>
            </span>
          </footer>
        </div>
      </main>
    </>
  );
}

/**
 * What the console says about the employee list. The case that matters is the
 * unavailable one: a picker that is simply empty, with no explanation, is the
 * failure this whole feature was told to avoid.
 */
function DirectoryNotice({
  directory,
}: {
  directory: Awaited<ReturnType<typeof loadDirectory>>;
}) {
  if (directory.available) {
    return (
      <p className={styles.info} role="status">
        Staff directory loaded — {directory.users.length}{' '}
        {directory.users.length === 1 ? 'colleague' : 'colleagues'} from Google Workspace. Start
        typing a name or address in any “add people” box to pick from it.{' '}
        <span className={styles.infoMuted}>
          The list is read live and cached for a few minutes; it is never stored in this repo.
        </span>
      </p>
    );
  }
  return (
    <div className={styles.warn} role="status">
      <p>{directory.reason}</p>
      <form action={refreshDirectory}>
        <button type="submit" className={styles.linkBtn}>
          Try the directory again
        </button>
      </form>
    </div>
  );
}

function Section({
  label,
  hint,
  rows,
  directory,
  writable,
  adminEmail,
}: {
  label: string;
  hint: string;
  rows: ConsoleRow[];
  directory: DirectoryUser[];
  writable: boolean;
  adminEmail: string;
}) {
  if (rows.length === 0) return null;
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionLabel}>{label}</h2>
        <span className={styles.sectionHint}>{hint}</span>
        <hr className={styles.sectionRule} />
      </div>
      <ul className={styles.list}>
        {rows.map((row) => (
          <li key={row.app.id}>
            <AppRow row={row} directory={directory} writable={writable} adminEmail={adminEmail} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function AppRow({
  row,
  directory,
  writable,
  adminEmail,
}: {
  row: ConsoleRow;
  directory: DirectoryUser[];
  writable: boolean;
  adminEmail: string;
}) {
  const { app, restricted, grantedTo } = row;
  const nameFor = new Map(directory.map((u) => [u.email, u.name]));
  // Granted addresses that can never sign in to the hub, so will never see the
  // tile they were given. Worth saying; not worth refusing, because
  // ALLOWED_EMAILS exists precisely for guests on another domain.
  const stranded = addressesOutsideDomains(grantedTo, ALLOWED_DOMAINS, ALLOWED_EMAILS);

  return (
    <article className={`${styles.card}${restricted ? ` ${styles.cardRestricted}` : ''}`}>
      <div className={styles.cardHead}>
        <span className={styles.iconBadge} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={`${styles.icon}${app.invertOnDark ? ` ${styles.iconInvertDark}` : ''}`}
            src={app.icon}
            alt=""
            width={28}
            height={28}
          />
        </span>
        <div className={styles.cardTitle}>
          <h3 className={styles.appName}>{app.name}</h3>
          <p className={styles.appDesc}>{app.description}</p>
        </div>
        {/*
          The default has to read as a state, not as an absence. "Everyone" in
          one badge, rather than seventy ticked checkboxes that mean the same
          thing and would go stale the day somebody joins.
        */}
        {restricted ? (
          <span className={`${styles.badge} ${styles.badgeRestricted}`}>
            Restricted · {grantedTo.length} {grantedTo.length === 1 ? 'person' : 'people'}
          </span>
        ) : (
          <span className={`${styles.badge} ${styles.badgeEveryone}`}>Everyone</span>
        )}
      </div>

      {!restricted ? (
        <form action={restrictApp} className={styles.restrictForm}>
          <input type="hidden" name="appId" value={app.id} />
          <input
            className={styles.noteInput}
            type="text"
            name="note"
            maxLength={500}
            placeholder="Why restrict it? (optional — for whoever reads this in six months)"
            aria-label={`Reason for restricting ${app.name}`}
            disabled={!writable}
          />
          <button type="submit" className={styles.secondaryBtn} disabled={!writable}>
            Restrict…
          </button>
        </form>
      ) : (
        <div className={styles.restrictedBody}>
          <p className={styles.meta}>
            {row.note ? <span className={styles.note}>“{row.note}”</span> : null}
            {row.restrictedBy ? (
              <span className={styles.metaMuted}>
                {row.note ? ' · ' : ''}restricted by {row.restrictedBy}
                {row.restrictedAt ? ` on ${row.restrictedAt.toISOString().slice(0, 10)}` : ''}
              </span>
            ) : null}
          </p>

          {grantedTo.length === 0 ? (
            <p className={styles.emptyGrants}>
              Nobody is on the list, so this tile is on <strong>nobody’s</strong> launcher —
              including yours. Add people below, or make it visible to everyone again.
            </p>
          ) : (
            <ul className={styles.people}>
              {grantedTo.map((email) => (
                <li key={email} className={styles.person}>
                  <span className={styles.personName}>
                    {nameFor.get(email) ?? email}
                    {nameFor.has(email) && (
                      <span className={styles.personEmail}>{email}</span>
                    )}
                  </span>
                  {email === adminEmail && <span className={styles.you}>you</span>}
                  <form action={revokeApp}>
                    <input type="hidden" name="appId" value={app.id} />
                    <input type="hidden" name="email" value={email} />
                    <button
                      type="submit"
                      className={styles.removeBtn}
                      aria-label={`Remove ${email} from ${app.name}`}
                      disabled={!writable}
                    >
                      ×
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          {stranded.length > 0 && (
            <p className={styles.warnInline}>
              {stranded.join(', ')} {stranded.length === 1 ? 'is' : 'are'} outside{' '}
              <code>ALLOWED_DOMAINS</code> and cannot sign in to the hub at all, so{' '}
              {stranded.length === 1 ? 'this address' : 'these addresses'} will never see this tile.
            </p>
          )}

          <form action={grantApp} className={styles.grantForm}>
            <input type="hidden" name="appId" value={app.id} />
            <input
              className={styles.emailInput}
              type="text"
              name="emails"
              list="paf-directory"
              autoComplete="off"
              placeholder="name@forplaneta.com — several at once is fine"
              aria-label={`Add people to ${app.name}`}
              disabled={!writable}
            />
            <button type="submit" className={styles.primaryBtn} disabled={!writable}>
              Add
            </button>
          </form>

          <form action={unrestrictApp}>
            <input type="hidden" name="appId" value={app.id} />
            <button type="submit" className={styles.linkBtn} disabled={!writable}>
              Make visible to everyone again
            </button>
          </form>
        </div>
      )}
    </article>
  );
}
