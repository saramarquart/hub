import { apps } from '@/lib/apps';
import styles from './page.module.css';

/** Planet A Foods wordmark — the official stacked logo, recoloured to brand violet. */
function Wordmark() {
  return (
    <div className={styles.wordmark}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.logo}
        src="/paf-logo.png"
        alt="Planet A Foods"
        width={431}
        height={720}
      />
    </div>
  );
}

export default function Home() {
  return (
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
                <span
                  className={styles.iconBadge}
                  style={{ color: app.accent }}
                  aria-hidden="true"
                >
                  {app.icon}
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
          <span>Planet A Foods · internal</span>
        </footer>
      </div>
    </main>
  );
}
