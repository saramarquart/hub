import AppGrid from './AppGrid';
import ThemeToggle from './ThemeToggle';
import styles from './page.module.css';

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

export default function Home() {
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

          <AppGrid />

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
            </span>
            <span className={styles.footerMuted}>Planet A Foods · internal</span>
          </footer>
        </div>
      </main>
    </>
  );
}
