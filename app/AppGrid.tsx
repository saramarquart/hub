'use client';

import { useEffect, useState } from 'react';
import { apps, type AppTile } from '@/lib/apps';
import styles from './page.module.css';

/**
 * The app grid, grouped Internal / External, with a per-user "Customize" toggle:
 * each person can hide the apps that aren't relevant to them. The choice is kept
 * in localStorage (this hub is a static site, so it's device-local, no backend).
 */
const HIDE_KEY = 'paf-hub-hidden';
const GROUPS: { key: AppTile['category']; label: string }[] = [
  { key: 'internal', label: 'Internal' },
  { key: 'external', label: 'External' },
];

export default function AppGrid() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HIDE_KEY);
      if (raw) setHidden(new Set(JSON.parse(raw) as string[]));
      // Screenshot/QA hook: open in customize mode when this flag is set.
      if (localStorage.getItem('paf-hub-force-customize') === '1') setEditing(true);
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  function toggle(name: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      try {
        localStorage.setItem(HIDE_KEY, JSON.stringify([...next]));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // When not editing, a group is only shown if it has at least one visible app.
  const allHidden =
    !editing && apps.every((a) => hidden.has(a.name));

  function resetHidden() {
    setHidden(new Set());
    try {
      localStorage.removeItem(HIDE_KEY);
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <div className={styles.customizeBar}>
        {editing && (
          <span className={styles.customizeHint}>
            Tap an app to show or hide it. Your choice is saved on this device.
          </span>
        )}
        <button
          type="button"
          className={`${styles.customizeBtn}${editing ? ` ${styles.customizeBtnActive}` : ''}`}
          onClick={() => setEditing((e) => !e)}
          aria-pressed={editing}
        >
          {editing ? (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Done
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              Customize
            </>
          )}
        </button>
      </div>

      {allHidden && (
        <div className={styles.emptyAll} role="status">
          <h2 className={styles.emptyTitle}>No apps on your hub yet</h2>
          <p className={styles.emptyText}>
            You&apos;ve hidden every app. Customize your hub to bring the ones
            you use back.
          </p>
          <button type="button" className={styles.emptyBtn} onClick={resetHidden}>
            Restore all apps
          </button>
        </div>
      )}

      {GROUPS.map((g) => {
        const groupApps = apps.filter(
          (a) => a.category === g.key && (editing || !hidden.has(a.name)),
        );
        if (!groupApps.length) return null;
        return (
          <section key={g.key} className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionLabel}>{g.label}</h2>
              <span className={styles.sectionCount}>{groupApps.length}</span>
              <hr className={styles.sectionRule} />
            </div>
            <div aria-label={`${g.label} apps`} className={styles.grid}>
              {groupApps.map((app) => {
                const isHidden = hidden.has(app.name);
                const external = /^https?:\/\//i.test(app.href);
                const inner = (
                  <>
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
                      {editing ? (isHidden ? 'Show' : 'Hide') : 'Open'}{' '}
                      <span className={styles.arrow}>
                        {editing ? (isHidden ? '+' : '×') : '→'}
                      </span>
                    </span>
                  </>
                );
                if (editing) {
                  return (
                    <button
                      key={app.name}
                      type="button"
                      onClick={() => toggle(app.name)}
                      aria-pressed={!isHidden}
                      className={`${styles.tile} ${styles.tileEditing}${isHidden ? ` ${styles.tileHidden}` : ''}`}
                    >
                      {inner}
                    </button>
                  );
                }
                return (
                  <a
                    key={app.name}
                    href={app.href}
                    className={styles.tile}
                    rel={external ? 'noopener' : undefined}
                    aria-label={`Open ${app.name} — ${app.description}`}
                  >
                    {inner}
                  </a>
                );
              })}
            </div>
          </section>
        );
      })}
    </>
  );
}
