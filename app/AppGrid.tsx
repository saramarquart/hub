'use client';

import { useEffect, useState, type ReactNode, type SyntheticEvent } from 'react';
import { apps, groups, type AppGroup, type AppTile } from '@/lib/apps';
import styles from './page.module.css';

/**
 * The app grid. Sections in order of daily use, one tile style:
 *   Teams            — one row per team group (`group` in lib/apps.ts)
 *   Company          — "Our apps" (internal) and "External tools" rows
 *   People & Culture — used rarely, so last and visually quieter
 * On phones the team rows and People & Culture become native <details>:
 * the team rows start open, People & Culture starts collapsed.
 *
 * A per-user "Customize" toggle lets each person hide the apps that aren't
 * relevant to them. The choice is kept in localStorage (this hub is a static
 * site, so it's device-local, no backend).
 */
const HIDE_KEY = 'paf-hub-hidden';
/** Matches the 560px phone breakpoint in page.module.css. */
const PHONE_QUERY = '(max-width: 560px)';
const TEAM_GROUPS = groups.filter((g) => g.key !== 'company' && g.key !== 'people-culture');
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
  /** Omitted when the section heading already names the row. */
  label?: string;
  apps: AppTile[];
  /** Collapsible on phones (team rows); the Company rows never collapse. */
  collapsible?: boolean;
}

interface Section {
  key: string;
  label: string;
  rows: Row[];
  /** The whole section collapses on phones, starting collapsed. */
  collapsible?: boolean;
  /** Rarely used apps: same tile, less visual weight. */
  quiet?: boolean;
}

export default function AppGrid() {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState(false);
  const isPhone = useIsPhone();
  // Phone open/closed choices the person made; anything not in here uses its
  // default (team rows open, People & Culture collapsed).
  const [openState, setOpenState] = useState<Record<string, boolean>>({});
  const isOpen = (key: string, byDefault: boolean) => editing || (openState[key] ?? byDefault);
  /** onToggle for a <details>: remember the person's choice (not while customize mode forces it open). */
  const onToggle = (key: string) => (e: SyntheticEvent<HTMLDetailsElement>) => {
    if (editing) return;
    const open = e.currentTarget.open;
    setOpenState((prev) => (prev[key] === open ? prev : { ...prev, [key]: open }));
  };

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

  const company = inGroup('company');
  const sections: Section[] = [
    {
      key: 'teams',
      label: 'Teams',
      rows: TEAM_GROUPS.map((g) => ({ key: g.key, label: g.label, apps: inGroup(g.key), collapsible: true })),
    },
    {
      key: 'company',
      label: 'Company',
      rows: [
        { key: 'our-apps', label: 'Our apps', apps: company.filter((a) => a.category === 'internal') },
        { key: 'external-tools', label: 'External tools', apps: company.filter((a) => a.category === 'external') },
      ],
    },
    {
      key: 'people-culture',
      label: 'People & Culture',
      rows: [{ key: 'people-culture-apps', apps: inGroup('people-culture') }],
      collapsible: true,
      quiet: true,
    },
  ];

  /** A tile is a link normally, and a show/hide toggle button in customize mode. */
  function renderTile(app: AppTile, quiet = false) {
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
          className={`${styles.tile}${quiet ? ` ${styles.tileQuiet}` : ''} ${styles.tileEditing}${isHidden ? ` ${styles.tileHidden}` : ''}`}
        >
          {inner}
        </button>
      );
    }
    return (
      <a
        key={app.name}
        href={app.href}
        className={`${styles.tile}${quiet ? ` ${styles.tileQuiet}` : ''}`}
        rel="noopener"
        aria-label={`Open ${app.name} — ${app.description}${isExternal ? ` (${EXTERNAL_LABEL})` : ''}`}
      >
        {inner}
      </a>
    );
  }

  const chevron = (
    <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );

  function renderRow(row: Row, quiet: boolean) {
    const tiles = <div className={styles.tiles}>{row.apps.map((a) => renderTile(a, quiet))}</div>;
    if (row.collapsible && row.label && isPhone) {
      return (
        <details key={row.key} className={styles.row} open={isOpen(row.key, true)} onToggle={onToggle(row.key)}>
          <summary className={styles.rowSummary}>
            <h3 className={styles.rowLabel}>{row.label}</h3>
            {chevron}
          </summary>
          {tiles}
        </details>
      );
    }
    return (
      <div key={row.key} className={`${styles.row}${row.label ? '' : ` ${styles.rowNoLabel}`}`}>
        {row.label && <h3 className={styles.rowLabel}>{row.label}</h3>}
        {tiles}
      </div>
    );
  }

  function renderSection(section: Section): ReactNode {
    const rows = section.rows.filter((r) => r.apps.length);
    if (!rows.length) return null;
    const id = `group-${section.key}`;
    const heading = (
      <h2 id={id} className={styles.sectionLabel}>
        {section.label}
      </h2>
    );
    const rule = <hr className={styles.sectionRule} />;
    const body = <div className={styles.rows}>{rows.map((r) => renderRow(r, !!section.quiet))}</div>;
    const className = `${styles.section}${section.quiet ? ` ${styles.sectionQuiet}` : ''}`;
    if (section.collapsible && isPhone) {
      return (
        <section key={section.key} className={className} aria-labelledby={id}>
          <details open={isOpen(section.key, false)} onToggle={onToggle(section.key)}>
            <summary className={`${styles.sectionHead} ${styles.sectionSummary}`}>
              {heading}
              {chevron}
              {rule}
            </summary>
            {body}
          </details>
        </section>
      );
    }
    return (
      <section key={section.key} className={className} aria-labelledby={id}>
        <div className={styles.sectionHead}>
          {heading}
          {rule}
        </div>
        {body}
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

      {sections.map(renderSection)}
    </>
  );
}
