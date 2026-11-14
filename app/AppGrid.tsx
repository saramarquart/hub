'use client';

import { useEffect, useState, type ReactNode, type SyntheticEvent } from 'react';
import { activeHighlight, apps, groups, localToday, type AppGroup, type AppTile } from '@/lib/apps';
import Search from './Search';
import { isCountMap, isStringArray, readFlag, readJSON, removeKey, writeJSON } from './storage';
import styles from './page.module.css';

/**
 * The app grid, in order of daily use, one tile language:
 *   Your apps        — up to four: pinned, then any app in a seasonal
 *                      highlight window, then most-used. Hidden while empty.
 *   Hero             — the `featured` app (paf_note), a larger full-width tile
 *   Teams            — one row per team group (`group` in lib/apps.ts)
 *   Company tools    — the rest of `company` (the external tools)
 *   People & Culture — used rarely, so last and visually quieter
 * On phones the team rows and People & Culture become native <details>:
 * the team rows start open, People & Culture starts collapsed.
 *
 * Per-browser preferences live in localStorage (this hub is a static site, so
 * there is no backend and nothing leaves the browser): apps hidden via
 * "Customize", apps pinned to "Your apps", and how often each tile was opened.
 */
const HIDE_KEY = 'paf-hub-hidden';
const PIN_KEY = 'paf-hub-pinned';
const USAGE_KEY = 'paf-hub-usage';
const YOUR_APPS_MAX = 4;
const KNOWN = new Set(apps.map((a) => a.name));
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

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 17v5" />
      <path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z" />
    </svg>
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
  /** Up to four tiles across the full width on wide screens (Your apps). */
  wide?: boolean;
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

  const [pinned, setPinned] = useState<string[]>([]);
  const [usage, setUsage] = useState<Record<string, number>>({});
  // Highlight windows are checked against the viewer's clock after hydration;
  // the prerendered HTML (built at deploy time) never shows a highlight.
  const [today, setToday] = useState<string | null>(null);

  useEffect(() => {
    setHidden(new Set(readJSON(HIDE_KEY, isStringArray, [])));
    setPinned(readJSON(PIN_KEY, isStringArray, []).filter((n) => KNOWN.has(n)));
    setUsage(readJSON(USAGE_KEY, isCountMap, {}));
    setToday(localToday());
    // Screenshot/QA hook: open in customize mode when this flag is set.
    if (readFlag('paf-hub-force-customize')) setEditing(true);
  }, []);

  function toggle(name: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      writeJSON(HIDE_KEY, [...next]);
      return next;
    });
  }

  function resetHidden() {
    setHidden(new Set());
    removeKey(HIDE_KEY);
  }

  /** Pin/unpin. Reads storage first so pins made in another tab aren't lost. */
  function togglePin(name: string) {
    const current = readJSON(PIN_KEY, isStringArray, pinned).filter((n) => KNOWN.has(n));
    const next = current.includes(name) ? current.filter((n) => n !== name) : [...current, name];
    writeJSON(PIN_KEY, next);
    setPinned(next);
  }

  /** Count an open. Reads storage first so counts from other tabs aren't lost. */
  function recordOpen(app: AppTile) {
    const counts = readJSON(USAGE_KEY, isCountMap, usage);
    const next = { ...counts, [app.name]: (counts[app.name] ?? 0) + 1 };
    writeJSON(USAGE_KEY, next);
    setUsage(next);
  }

  function clearYourApps() {
    setPinned([]);
    setUsage({});
    removeKey(PIN_KEY);
    removeKey(USAGE_KEY);
  }

  // When not editing, a row is only shown if it has at least one visible app.
  const allHidden = !editing && apps.every((a) => hidden.has(a.name));
  const shown = (a: AppTile) => editing || !hidden.has(a.name);
  const inGroup = (key: AppGroup) => apps.filter((a) => a.group === key && shown(a));

  const company = inGroup('company');
  const heroes = apps.filter((a) => a.featured && shown(a));
  const noteFor = (app: AppTile) => (today ? activeHighlight(app, today) : undefined);

  // "Your apps": pinned, then highlighted, then most-used. Never hidden apps,
  // and never the hero, which already sits right below.
  const visible = (a: AppTile) => !hidden.has(a.name) && !a.featured;
  const byName = new Map(apps.map((a) => [a.name, a] as const));
  const yourApps = [
    ...pinned.map((n) => byName.get(n)).filter((a): a is AppTile => !!a),
    ...apps.filter((a) => noteFor(a)),
    ...apps
      .filter((a) => (usage[a.name] ?? 0) > 0)
      .sort((a, b) => (usage[b.name] ?? 0) - (usage[a.name] ?? 0)),
  ]
    .filter((a, i, list) => visible(a) && list.indexOf(a) === i)
    .slice(0, YOUR_APPS_MAX);
  const hasYourAppsData = pinned.length > 0 || Object.keys(usage).length > 0;

  const sections: Section[] = [
    {
      // Never in customize mode: every app is already listed below to pin or hide.
      key: 'your-apps',
      label: 'Your apps',
      rows: [{ key: 'your-apps-row', apps: editing ? [] : yourApps }],
      wide: true,
    },
    {
      key: 'teams',
      label: 'Teams',
      rows: TEAM_GROUPS.map((g) => ({ key: g.key, label: g.label, apps: inGroup(g.key), collapsible: true })),
    },
    {
      key: 'company',
      label: 'Company tools',
      rows: [{ key: 'company-tools', apps: company.filter((a) => !a.featured) }],
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
    const isPinned = pinned.includes(app.name);
    const note = noteFor(app);
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
          {note && <span className={styles.badge}>{note}</span>}
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
      // Two sibling buttons: the tile itself shows/hides, the pin pins.
      return (
        <div
          key={app.name}
          className={`${styles.tile}${quiet ? ` ${styles.tileQuiet}` : ''} ${styles.tileEditing}${isHidden ? ` ${styles.tileHidden}` : ''}`}
        >
          <button
            type="button"
            className={styles.tileToggle}
            onClick={() => toggle(app.name)}
            aria-pressed={!isHidden}
            aria-label={`Show ${app.name}`}
          >
            {inner}
          </button>
          {!app.featured && (
            <button
              type="button"
              className={`${styles.pinBtn}${isPinned ? ` ${styles.pinBtnOn}` : ''}`}
              onClick={() => togglePin(app.name)}
              aria-pressed={isPinned}
              aria-label={`Pin ${app.name} to Your apps`}
              title={isHidden ? 'Show the app to pin it' : isPinned ? 'Unpin from Your apps' : 'Pin to Your apps'}
              disabled={isHidden}
            >
              <PinIcon />
            </button>
          )}
        </div>
      );
    }
    return (
      <a
        key={app.name}
        href={app.href}
        className={`${styles.tile}${quiet ? ` ${styles.tileQuiet}` : ''}`}
        rel="noopener"
        aria-label={`Open ${app.name} — ${app.description}${isExternal ? ` (${EXTERNAL_LABEL})` : ''}${note ? ` (${note})` : ''}`}
        onClick={() => recordOpen(app)}
        // Middle-click opens a new tab: count that too.
        onAuxClick={(e) => e.button === 1 && recordOpen(app)}
      >
        {inner}
      </a>
    );
  }

  /** The featured app (paf_note): same tile language, one size up, full width. */
  function renderHero(app: AppTile) {
    const note = noteFor(app);
    return (
      <a
        key={app.name}
        href={app.href}
        className={styles.hero}
        rel="noopener"
        aria-label={`Open ${app.name} — ${app.description}${note ? ` (${note})` : ''}`}
        onClick={() => recordOpen(app)}
        onAuxClick={(e) => e.button === 1 && recordOpen(app)}
      >
        <span className={`${styles.iconBadge} ${styles.heroBadge}`} aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className={`${styles.heroIcon}${app.invertOnDark ? ` ${styles.iconInvertDark}` : ''}`}
            src={app.icon}
            alt=""
            width={36}
            height={36}
          />
        </span>
        <span className={styles.tileBody}>
          <span className={`${styles.tileName} ${styles.heroName}`}>
            {app.name}
          </span>
          {note && <span className={styles.badge}>{note}</span>}
          <span className={styles.heroDesc}>{app.description}</span>
        </span>
        <span className={styles.heroArrow} aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </span>
      </a>
    );
  }

  const chevron = (
    <svg className={styles.chevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );

  function renderRow(row: Row, quiet: boolean, wide: boolean) {
    const tiles = (
      <div className={`${styles.tiles}${wide ? ` ${styles.tilesWide}` : ''}`}>
        {row.apps.map((a) => renderTile(a, quiet))}
      </div>
    );
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
      <div
        key={row.key}
        className={`${styles.row}${wide ? ` ${styles.rowWide}` : row.label ? '' : ` ${styles.rowNoLabel}`}`}
      >
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
    const body = <div className={styles.rows}>{rows.map((r) => renderRow(r, !!section.quiet, !!section.wide))}</div>;
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
        <Search onOpenApp={recordOpen} />
        <span className={styles.barSpacer} />
        {editing && (
          <button
            type="button"
            className={styles.clearBtn}
            onClick={clearYourApps}
            disabled={!hasYourAppsData}
            title="Forget pins and usage counts on this device"
          >
            Clear Your apps
          </button>
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

      {editing && (
        <p className={styles.customizeHint}>
          Tap an app to show or hide it, or pin it to Your apps. Saved on this device only.
        </p>
      )}

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

      {renderSection(sections[0])}
      {heroes.length > 0 && (
        <div className={styles.heroWrap}>{heroes.map((a) => (editing ? renderTile(a) : renderHero(a)))}</div>
      )}
      {sections.slice(1).map(renderSection)}
    </>
  );
}
