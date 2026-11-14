'use client';

import { useEffect, useState } from 'react';
import { apps, groups, type AppGroup, type AppTile } from '@/lib/apps';
import styles from './page.module.css';

/**
 * The app grid, grouped by who uses each app (`group` in lib/apps.ts):
 * "For everyone" as large tiles, then the team groups as compact tiles, each a
 * native <details> so phones can collapse them. A per-user "Customize" toggle
 * lets each person hide the apps that aren't relevant to them. The choice is
 * kept in localStorage (this hub is a static site, so it's device-local, no backend).
 */
const HIDE_KEY = 'paf-hub-hidden';
/** Phones: team groups start collapsed (matches the 560px breakpoint in page.module.css). */
const PHONE_QUERY = '(max-width: 560px)';
const TEAM_GROUPS = groups.filter((g) => g.key !== 'everyone');
const EXTERNAL_LABEL = 'opens external site';

/** Small ↗ marker for third-party apps, with a text label for screen readers. */
function ExternalMark() {
  return (
    <span className={styles.extMark} title="Opens external site">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 17 17 7" />
        <path d="M8 7h9v9" />
      </svg>
      <span className={styles.srOnly}>({EXTERNAL_LABEL})</span>
    </span>
  );
}

export default function AppGrid() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  // Team groups are open in the prerendered HTML (desktop default) and
  // collapsed after hydration on phones.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(TEAM_GROUPS.map((g) => [g.key, true])),
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HIDE_KEY);
      if (raw) setHidden(new Set(JSON.parse(raw) as string[]));
      // Screenshot/QA hook: open in customize mode when this flag is set.
      if (localStorage.getItem('paf-hub-force-customize') === '1') setEditing(true);
    } catch {
      /* ignore malformed storage */
    }
    if (window.matchMedia?.(PHONE_QUERY).matches) {
      setOpenGroups(Object.fromEntries(TEAM_GROUPS.map((g) => [g.key, false])));
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
  const allHidden = !editing && apps.every((a) => hidden.has(a.name));

  function resetHidden() {
    setHidden(new Set());
    try {
      localStorage.removeItem(HIDE_KEY);
    } catch {
      /* ignore */
    }
  }

  const visibleIn = (key: AppGroup) =>
    apps.filter((a) => a.group === key && (editing || !hidden.has(a.name)));

  /** A tile is a link normally, and a show/hide toggle button in customize mode. */
  function renderTile(app: AppTile, compact: boolean) {
    const isHidden = hidden.has(app.name);
    const isExternal = app.category === 'external';
    const icon = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={`${compact ? styles.compactIcon : styles.icon}${app.invertOnDark ? ` ${styles.iconInvertDark}` : ''}`}
        src={app.icon}
        alt=""
        width={compact ? 28 : 30}
        height={compact ? 28 : 30}
      />
    );
    const status = editing ? (isHidden ? 'Show' : 'Hide') : 'Open';
    const statusGlyph = editing ? (isHidden ? '+' : '×') : '→';
    const inner = compact ? (
      <>
        <span className={styles.compactIconWrap} aria-hidden="true">
          {icon}
        </span>
        <span className={styles.compactBody}>
          <span className={styles.compactName}>
            {app.name}
            {isExternal && <ExternalMark />}
          </span>
          <span className={styles.compactDesc}>{app.description}</span>
        </span>
        {editing && (
          <span className={styles.compactStatus} aria-hidden="true">
            {statusGlyph}
          </span>
        )}
      </>
    ) : (
      <>
        <span className={styles.iconBadge} aria-hidden="true">
          {icon}
        </span>
        <span className={styles.tileBody}>
          <span className={styles.tileName}>
            {app.name}
            {isExternal && <ExternalMark />}
          </span>
          <span className={styles.tileDesc}>{app.description}</span>
        </span>
        <span className={styles.open} aria-hidden="true">
          {status} <span className={styles.arrow}>{statusGlyph}</span>
        </span>
      </>
    );
    const base = compact ? styles.compactTile : styles.tile;
    if (editing) {
      return (
        <button
          key={app.name}
          type="button"
          onClick={() => toggle(app.name)}
          aria-pressed={!isHidden}
          title={compact ? app.description : undefined}
          className={`${base} ${styles.tileEditing}${isHidden ? ` ${styles.tileHidden}` : ''}`}
        >
          {inner}
        </button>
      );
    }
    return (
      <a
        key={app.name}
        href={app.href}
        className={base}
        rel="noopener"
        title={compact ? app.description : undefined}
        aria-label={`Open ${app.name} — ${app.description}${isExternal ? ` (${EXTERNAL_LABEL})` : ''}`}
      >
        {inner}
      </a>
    );
  }

  const everyoneApps = visibleIn('everyone');
  const teamGroups = TEAM_GROUPS.map((g) => ({ ...g, apps: visibleIn(g.key) })).filter(
    (g) => g.apps.length,
  );

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

      {everyoneApps.length > 0 && (
        <section className={styles.section} aria-labelledby="group-everyone">
          <div className={styles.sectionHead}>
            <h2 id="group-everyone" className={styles.sectionLabel}>
              For everyone
            </h2>
            <span className={styles.sectionCount}>{everyoneApps.length}</span>
            <hr className={styles.sectionRule} />
          </div>
          <div className={styles.grid}>{everyoneApps.map((a) => renderTile(a, false))}</div>
        </section>
      )}

      {teamGroups.length > 0 && (
        <section className={styles.section} aria-labelledby="group-teams">
          <div className={styles.sectionHead}>
            <h2 id="group-teams" className={styles.sectionLabel}>
              Teams
            </h2>
            <hr className={styles.sectionRule} />
          </div>
          <div className={styles.teams}>
            {teamGroups.map((g) => (
              <details
                key={g.key}
                className={styles.group}
                // Customize mode shows every group so each app can be toggled.
                open={editing || openGroups[g.key]}
                onToggle={(e) => {
                  const isOpen = e.currentTarget.open;
                  if (!editing) setOpenGroups((prev) => ({ ...prev, [g.key]: isOpen }));
                }}
              >
                <summary className={styles.groupSummary}>
                  <h3 className={styles.groupTitle}>{g.label}</h3>
                  <span className={styles.groupCount}>{g.apps.length}</span>
                  <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                <div className={styles.compactGrid}>{g.apps.map((a) => renderTile(a, true))}</div>
              </details>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
