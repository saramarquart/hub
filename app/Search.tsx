'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import type { AppTile } from '@/lib/apps';
import { groupLabel, searchApps } from '@/lib/search';
import styles from './page.module.css';

/**
 * Quick search: ⌘K / Ctrl+K or "/" opens a modal <dialog> with a combobox
 * that filters every app (name, description, group and `keywords` aliases).
 * Arrow keys move through the results, Enter opens the app in the same tab,
 * Esc closes. showModal() makes the rest of the page inert, so focus stays in
 * the dialog until it closes.
 */
export default function Search({ onOpenApp }: { onOpenApp: (app: AppTile) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [isMac, setIsMac] = useState(true);
  const id = useId();
  const listId = `${id}-list`;
  const optionId = (i: number) => `${id}-opt-${i}`;

  const results = searchApps(query);

  const open = useCallback(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    setQuery('');
    setActive(0);
    dialog.showModal();
    document.documentElement.classList.add(styles.scrollLocked);
    inputRef.current?.focus();
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  // Restore page scroll and focus however the dialog closed (Esc, backdrop, Enter).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => {
      document.documentElement.classList.remove(styles.scrollLocked);
      returnFocusRef.current?.focus?.();
    };
    dialog.addEventListener('close', onClose);
    return () => dialog.removeEventListener('close', onClose);
  }, []);

  // Global shortcuts: ⌘K / Ctrl+K anywhere, "/" when not typing in a field.
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent));
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (dialogRef.current?.open) close();
        else open();
        return;
      }
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      open();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  // Keep the active option in view while arrowing through a long list.
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  function go(app: AppTile | undefined) {
    if (!app) return;
    onOpenApp(app);
    close();
    window.location.assign(app.href);
  }

  function onInputKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Home' && results.length) {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End' && results.length) {
      e.preventDefault();
      setActive(results.length - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      go(results[active]);
    }
  }

  const shortcut = isMac ? '⌘K' : 'Ctrl K';

  return (
    <>
      <button
        type="button"
        className={styles.searchTrigger}
        onClick={open}
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K /"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
        <span className={styles.searchTriggerLabel}>Search apps</span>
        <kbd className={styles.kbd} aria-hidden="true">
          {shortcut}
        </kbd>
      </button>

      <dialog
        ref={dialogRef}
        className={styles.searchDialog}
        aria-label="Search apps"
        // A click on the backdrop lands on the <dialog> itself: close.
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        // Focus trap: showModal() makes the page inert, but Tab can still leave
        // for the browser UI. Keep it on the dialog's focusable elements.
        onKeyDown={(e) => {
          if (e.key !== 'Tab') return;
          const focusables = Array.from(
            e.currentTarget.querySelectorAll<HTMLElement>('input, button, [href], [tabindex]:not([tabindex="-1"])'),
          );
          if (!focusables.length) return;
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }}
      >
        <div className={styles.searchPanel}>
          <div className={styles.searchField}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              ref={inputRef}
              className={styles.searchInput}
              type="text"
              role="combobox"
              aria-label="Search apps"
              aria-autocomplete="list"
              aria-expanded={results.length > 0}
              aria-controls={listId}
              aria-activedescendant={results.length ? optionId(active) : undefined}
              placeholder="Search apps, e.g. wiki, sales, spend"
              autoComplete="off"
              spellCheck={false}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onInputKey}
            />
            <kbd className={styles.kbd} aria-hidden="true">
              Esc
            </kbd>
          </div>

          <ul ref={listRef} id={listId} role="listbox" aria-label="Apps" className={styles.searchList}>
            {results.map((app, i) => (
              <li
                key={app.name}
                id={optionId(i)}
                data-index={i}
                role="option"
                aria-selected={i === active}
                className={`${styles.searchOption}${i === active ? ` ${styles.searchOptionActive}` : ''}`}
                onMouseMove={() => i !== active && setActive(i)}
                onClick={() => go(app)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={`${styles.searchIcon}${app.invertOnDark ? ` ${styles.iconInvertDark}` : ''}`}
                  src={app.icon}
                  alt=""
                  width={24}
                  height={24}
                />
                <span className={styles.searchText}>
                  <span className={styles.searchName}>
                    {app.name}
                    {app.category === 'external' && (
                      <span className={styles.searchExternal}> · opens external site</span>
                    )}
                  </span>
                  <span className={styles.searchDesc}>{app.description}</span>
                </span>
                <span className={styles.searchGroup}>{groupLabel(app)}</span>
              </li>
            ))}
          </ul>
          {!results.length && (
            <p className={styles.searchEmpty}>No apps match “{query}”.</p>
          )}
          <p className={styles.srOnly} role="status" aria-live="polite">
            {results.length === 1 ? '1 app' : `${results.length} apps`}
          </p>
        </div>
      </dialog>
    </>
  );
}
