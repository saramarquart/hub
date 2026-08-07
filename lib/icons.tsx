import type { ReactNode } from 'react';

const svgProps = {
  width: 28,
  height: 28,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

/** QOaroma — aroma / formulation analytics: a flask with rising notes. */
export function AromaIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <path d="M9 3h6" />
      <path d="M10 3v5.5L5.5 16.5A2.5 2.5 0 0 0 7.7 20h8.6a2.5 2.5 0 0 0 2.2-3.5L14 8.5V3" />
      <path d="M8 15h8" />
      <circle cx="10.5" cy="17" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="17.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** note — company wiki / notes: a page with lines. */
export function NoteIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <path d="M6 3h8l4 4v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v4h4" />
      <path d="M8 12h8" />
      <path d="M8 16h5" />
    </svg>
  );
}

/** Feedback — team feedback / HR: overlapping speech bubbles. */
export function FeedbackIcon(): ReactNode {
  return (
    <svg {...svgProps}>
      <path d="M4 5h11a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z" />
      <path d="M7 8.5h6" />
      <path d="M7 11h4" />
    </svg>
  );
}

/**
 * Brand logo icon for a third-party SaaS tile — a self-hosted favicon rendered
 * full-colour (unlike the monochrome glyphs above, which use currentColor).
 * `src` is a path under /public. Kept square + rounded to sit in the badge.
 */
function BrandLogo({ src, name }: { src: string; name: string }): ReactNode {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`${name} logo`}
      width={30}
      height={30}
      style={{ display: 'block', borderRadius: 7, objectFit: 'contain' }}
    />
  );
}

/** Personio — HR / people platform (self-hosted brand favicon). */
export function PersonioIcon(): ReactNode {
  return <BrandLogo src="/icons/personio.png" name="Personio" />;
}

/** Spendesk — company spend management (self-hosted brand favicon). */
export function SpendeskIcon(): ReactNode {
  return <BrandLogo src="/icons/spendesk.png" name="Spendesk" />;
}
