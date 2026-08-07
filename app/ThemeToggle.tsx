'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';

type Theme = 'dark' | 'light';

/**
 * Persisted light/dark toggle. Sets data-theme on <html>. Initial value is
 * read from what the no-flash <head> script already resolved (localStorage or
 * prefers-color-scheme), so this button never fights the first paint.
 */
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  // Sync state with whatever the pre-paint script set on <html>.
  useEffect(() => {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'light' ? 'light' : 'dark');
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('paf-theme', next);
    } catch {
      /* ignore */
    }
  };

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className={styles.themeToggle}
      onClick={toggle}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Switch to light' : 'Switch to dark'}
    >
      {isDark ? (
        // Sun — shown in dark mode (click to go light).
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.4M12 19.1v2.4M4.6 4.6l1.7 1.7M17.7 17.7l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.6 19.4l1.7-1.7M17.7 6.3l1.7-1.7" />
        </svg>
      ) : (
        // Moon — shown in light mode (click to go dark).
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a6.5 6.5 0 1 0 10.5 10.5Z" />
        </svg>
      )}
    </button>
  );
}
