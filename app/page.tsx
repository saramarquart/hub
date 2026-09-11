import { redirect } from 'next/navigation';
import AppGrid from './AppGrid';
import ThemeToggle from './ThemeToggle';
import styles from './page.module.css';
import { resolveSession } from '@/lib/auth/server';
import { visibleAppsFor } from '@/lib/visibility';

/**
 * Reads the session cookie and the restriction table, so it cannot be
 * pre-rendered. Without this Next would try to build the grid at compile time,
 * when there is no request and therefore nobody to build it for.
 */
export const dynamic = 'force-dynamic';

/**
 * Planet A Foods wordmark — the official stacked logo. Two <img>s, one per
 * theme; CSS shows/hides the right one via data-theme on <html>.
 */
function Wordmark() {
  return (
    <div className={styles.wordmark}>
      {/* eslint-disable @next/next/no-img-element */}
      <img
        className={`${styles.logo} ${styles.logoLight}`}
        src="/paf-logo.png"
        alt="Planet A Foods"
        width={431}
        height={720}
      />
      <img
        className={`${styles.logo} ${styles.logoDark}`}
        src="/paf-logo-dark.png"
        alt=""
        aria-hidden="true"
        width={431}
        height={720}
      />
      {/* eslint-enable @next/next/no-img-element */}
    </div>
  );
}

export default async function Home() {
  // middleware.ts already turned anonymous requests away. This is the second
  // check on purpose: a matcher is one regex away from quietly exempting a
  // route, and a page that resolves its own session cannot be reached without
  // one. Fails closed — null means the door, whatever the reason.
  const session = await resolveSession();
  if (!session) redirect('/signin');

  const visibleApps = await visibleAppsFor(session.email);

  return (
    <>
      <div className="bg-orbs" aria-hidden="true" />
      <ThemeToggle />
      <main className={styles.page}>
        <div className={styles.shell}>
          <header className={styles.header}>
            <Wordmark />
            <h1 className={styles.title}>Your Planet&nbsp;A workspace</h1>
            <p className={styles.tagline}>
              Every tool the team uses, one click away.
            </p>
          </header>

          <AppGrid apps={visibleApps} />

          <footer className={styles.footer}>
            <span className={styles.footerLinks}>
              <a
                className={styles.footerLink}
                href="https://note.planet-a-foods.com"
                rel="noopener"
              >
                New here? Start guide
              </a>
              <span className={styles.footerDot} aria-hidden="true">
                ·
              </span>
              <a
                className={styles.footerLink}
                href="https://slack.com/app_redirect?channel=help"
                rel="noopener"
              >
                Need help? #help
              </a>
              <span className={styles.footerDot} aria-hidden="true">
                ·
              </span>
              {/* There is a session now, so there has to be a way out of it —
                  shared machines in the lab are the case that matters. */}
              <a className={styles.footerLink} href="/auth/signout">
                Sign out
              </a>
            </span>
            <span className={styles.footerMuted}>
              {session.email} · Planet A Foods · internal
            </span>
          </footer>
        </div>
      </main>
    </>
  );
}
