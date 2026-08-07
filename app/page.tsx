import { apps } from '@/lib/apps';
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
            <p className={styles.tagline}>Pick an app to get started.</p>
          </header>

          <nav aria-label="Planet A Foods apps" className={styles.grid}>
            {apps.map((app) => {
              const external = /^https?:\/\//i.test(app.href);
              return (
                <a
                  key={app.name}
                  href={app.href}
                  className={styles.tile}
                  rel={external ? 'noopener' : undefined}
                  aria-label={`Open ${app.name} — ${app.description}`}
                >
                  <span className={styles.iconBadge} aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      className={`${styles.icon}${app.invertOnDark ? ` ${styles.iconInvertDark}` : ''}`}
                      src={app.icon}
                      alt=""
                      width={30}
                      height={30}
                    />
                  </span>
                  <span className={styles.tileBody}>
                    <span className={styles.tileName}>{app.name}</span>
                    <span className={styles.tileDesc}>{app.description}</span>
                  </span>
                  <span className={styles.open} aria-hidden="true">
                    Open <span className={styles.arrow}>&rarr;</span>
                  </span>
                </a>
              );
            })}
          </nav>

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
                href="https://slack.com/app_redirect?channel=office-planegg"
                rel="noopener"
              >
                Need help? #office-planegg
              </a>
            </span>
            <span className={styles.footerMuted}>Planet A Foods · internal</span>
          </footer>
        </div>
      </main>
    </>
  );
}
