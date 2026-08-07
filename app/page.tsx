import { apps } from '@/lib/apps';
import styles from './page.module.css';

/** Planet A Foods wordmark — small inline SVG mark + text, no external assets. */
function Wordmark() {
  return (
    <div className={styles.wordmark}>
      <svg
        className={styles.mark}
        width="34"
        height="34"
        viewBox="0 0 34 34"
        aria-hidden="true"
        focusable="false"
      >
        <rect x="1" y="1" width="32" height="32" rx="9" fill="#320F99" />
        <circle
          cx="17"
          cy="17"
          r="8.5"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="2"
        />
        <path
          d="M17 8.5a8.5 8.5 0 0 1 0 17"
          fill="none"
          stroke="#C9B8F5"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle cx="17" cy="17" r="2.4" fill="#FFFFFF" />
      </svg>
      <span className={styles.wordmarkText}>
        Planet&nbsp;A <strong>Foods</strong>
      </span>
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
