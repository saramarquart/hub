'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { apps, groups, type AppGroup, type AppTile } from '@/lib/apps';
import styles from './page.module.css';

/**
 * The app grid. Two tiers, one tile style:
 *   For everyone — "Our apps" (internal) and "External tools" rows
 *   Teams        — one row per team group (`group` in lib/apps.ts)
 * On phones the team rows become native <details>, collapsed by default.
 *
 * A per-user "Customize" toggle lets each person hide the apps that aren't
 * relevant to them. The choice is kept in localStorage (this hub is a static
 * site, so it's device-local, no backend).
 */
const HIDE_KEY = 'paf-hub-hidden';
/** Matches the 560px phone breakpoint in page.module.css. */
const PHONE_QUERY = '(max-width: 560px)';
const TEAM_GROUPS = groups.filter((g) => g.key !== 'everyone');
const EXTERNAL_LABEL = 'opens external site';

/** Small ↗ after an external app's name. Decorative: the link's accessible name carries the meaning. */
function ExternalMark() {
  return (
    <span className={styles.extMark} title="Opens external site" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 17 17 7" />
        <path d="M8 7h9v9" />
      </svg>
    </span>
  );
}

/** True on phones (after hydration; the prerendered HTML is the desktop layout). */
function useIsPhone() {
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.(PHONE_QUERY);
    if (!mq) return;
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return isPhone;
}

interface Row {
  key: string;
  label: string;
  apps: AppTile[];
  /** Team rows collapse on phones; the "For everyone" rows never do. */
  collapsible: boolean;
}

export default function AppGrid() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const isPhone = useIsPhone();
  // Team rows the person has expanded on a phone (all start collapsed).
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  function resetHidden() {
    setHidden(new Set());
    try {
      localStorage.removeItem(HIDE_KEY);
    } catch {
      /* ignore */
    }
  }

  // When not editing, a row is only shown if it has at least one visible app.
  const allHidden = !editing && apps.every((a) => hidden.has(a.name));
  const shown = (a: AppTile) => editing || !hidden.has(a.name);
  const inGroup = (key: AppGroup) => apps.filter((a) => a.group === key && shown(a));

  const everyone = inGroup('everyone');
  const everyoneRows: Row[] = [
    { key: 'our-apps', label: 'Our apps', apps: everyone.filter((a) => a.category === 'internal'), collapsible: false },
    { key: 'external-tools', label: 'External tools', apps: everyone.filter((a) => a.category === 'external'), collapsible: false },
  ].filter((r) => r.apps.length);
  const teamRows: Row[] = TEAM_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    apps: inGroup(g.key),
    collapsible: true,
  })).filter((r) => r.apps.length);

  /** A tile is a link normally, and a show/hide toggle button in customize mode. */
  function renderTile(app: AppTile) {
    const isHidden = hidden.has(app.name);
    const isExternal = app.category === 'external';
    const inner = (
      <>
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
        <span className={styles.tileBody}>
          <span className={styles.tileName}>
            {app.name}
            {isExternal && <ExternalMark />}
          </span>
          <span className={styles.tileDesc}>{app.description}</span>
        </span>
        {editing && (
          <span className={styles.status} aria-hidden="true">
            {isHidden ? 'Show' : 'Hide'}
          </span>
        )}
      </>
    );
    if (editing) {
      return (
        <button
          key={app.name}
          type="button"
          onClick={() => toggle(app.name)}
          aria-pressed={!isHidden}
          aria-label={app.name}
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
        rel="noopener"
        aria-label={`Open ${app.name} — ${app.description}${isExternal ? ` (${EXTERNAL_LABEL})` : ''}`}
      >
        {inner}
      </a>
    );
  }

  function renderRow(row: Row) {
    const tiles = <div className={styles.tiles}>{row.apps.map(renderTile)}</div>;
    if (row.collapsible && isPhone) {
      return (
        <details
          key={row.key}
          className={styles.row}
          // Customize mode shows every row so each app can be toggled.
          open={editing || expanded.has(row.key)}
          onToggle={(e) => {
            if (editing) return;
            const isOpen = e.currentTarget.open;
            setExpanded((prev) => {
              const next = new Set(prev);
              if (isOpen) next.add(row.key);
              else next.delete(row.key);
              return next;
            });
          }}
        >
          <summary className={styles.rowSummary}>
            <h3 className={styles.rowLabel}>{row.label}</h3>
            <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </summary>
          {tiles}
        </details>
      );
    }
    return (
      <div key={row.key} className={styles.row}>
        <h3 className={styles.rowLabel}>{row.label}</h3>
        {tiles}
      </div>
    );
  }

  function renderSection(id: string, label: string, rows: Row[]): ReactNode {
    if (!rows.length) return null;
    return (
      <section className={styles.section} aria-labelledby={id}>
        <div className={styles.sectionHead}>
          <h2 id={id} className={styles.sectionLabel}>
            {label}
          </h2>
          <hr className={styles.sectionRule} />
        </div>
        <div className={styles.rows}>{rows.map(renderRow)}</div>
      </section>
    );
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

      {renderSection('group-everyone', 'For everyone', everyoneRows)}
      {renderSection('group-teams', 'Teams', teamRows)}
    </>
  );
}
