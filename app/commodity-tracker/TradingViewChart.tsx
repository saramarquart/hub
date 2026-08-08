'use client';

import { useEffect, useRef, useState } from 'react';
import styles from './tracker.module.css';

/**
 * Live cocoa chart via the free TradingView "Advanced Chart" widget. No API key,
 * client-side only — safe for a static export. Theme-aware: it reads the hub's
 * data-theme on <html> and re-injects the widget when the toggle flips.
 *
 * Symbol: ICEUS:CC1! (ICE US cocoa continuous front-month).
 */
function currentTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export default function TradingViewChart() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Track the hub's theme toggle so the embed matches light/dark.
  useEffect(() => {
    setTheme(currentTheme());
    const observer = new MutationObserver(() => setTheme(currentTheme()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);

  // (Re)build the widget whenever the theme changes.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.innerHTML = '';

    const widget = document.createElement('div');
    widget.className = 'tradingview-widget-container__widget';
    widget.style.height = '100%';
    widget.style.width = '100%';
    el.appendChild(widget);

    const script = document.createElement('script');
    script.src =
      'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.type = 'text/javascript';
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: 'ICEUS:CC1!',
      interval: 'D',
      timezone: 'Etc/UTC',
      theme,
      style: '3', // area
      locale: 'en',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      save_image: false,
      backgroundColor: theme === 'light' ? '#ffffff' : '#12121a',
      gridColor: 'rgba(124, 92, 255, 0.10)',
      support_host: 'https://www.tradingview.com',
    });
    el.appendChild(script);

    return () => {
      el.innerHTML = '';
    };
  }, [theme]);

  return (
    <div className={styles.tvWrap}>
      <div ref={containerRef} className={styles.tvContainer} />
      <noscript>
        <p className={styles.muted}>Enable JavaScript to view the live cocoa chart.</p>
      </noscript>
    </div>
  );
}
