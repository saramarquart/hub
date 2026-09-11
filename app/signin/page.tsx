import { redirect } from 'next/navigation';
import ThemeToggle from '../ThemeToggle';
import { resolveSession } from '@/lib/auth/server';
import { googleConfigured } from '@/lib/auth/google';
import { IS_SSO } from '@/lib/config';
import { safeNextPath } from '@/lib/auth/session';
import styles from './signin.module.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in · Planet A Foods' };

/**
 * Copy for the ?error= codes the OAuth callback redirects with. Each says what
 * happened and what to do. `not_allowed` gets the neutral tone: an outside
 * Google account knocking on an internal launcher is the system working, not a
 * fault, and red contradicts its own text.
 */
const ERRORS: Record<string, { text: string; tone: 'error' | 'notice' }> = {
  not_allowed: {
    text: 'That Google account is not a Planet A account. Sign in with your @forplaneta.com address — if you are staff and this keeps happening, ask in #help.',
    tone: 'notice',
  },
  bad_state: {
    text: 'The sign-in link expired or was opened out of order. Please try again.',
    tone: 'error',
  },
  exchange_failed: {
    text: "Google sign-in didn't complete. Please try again.",
    tone: 'error',
  },
  not_configured: {
    text: 'Google sign-in is not configured on this deployment. Tell an admin.',
    tone: 'error',
  },
};

export default async function SignIn({
  searchParams,
}: {
  // Next 15 hands pages a Promise here, where Next 14 handed a plain object.
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  // Already signed in (or running in dev mode, where sessions are minted
  // server-side): there is nothing to do on this page.
  if (await resolveSession()) redirect('/');

  const params = await searchParams;
  const error = params.error ? ERRORS[params.error] ?? ERRORS.exchange_failed : null;
  // Re-validated here as well as in the callback: this value is rendered into
  // an href, and it arrived in a query string anyone can write.
  const next = safeNextPath(params.next ?? null);
  const loginHref = next
    ? `/auth/google/login?next=${encodeURIComponent(next)}`
    : '/auth/google/login';
  const ready = IS_SSO && googleConfigured();

  return (
    <>
      <div className="bg-orbs" aria-hidden="true" />
      <ThemeToggle />
      <main className={styles.wrap}>
        <div className={styles.stage}>
          {/* eslint-disable @next/next/no-img-element */}
          <img
            className={`${styles.logo} ${styles.logoLight}`}
            src="/paf-logo.png"
            alt="Planet A Foods"
            width={431}
            height={720}
          />
          <img
            className={`${styles.logo} ${styles.logoDark}`}
            src="/paf-logo-dark.png"
            alt=""
            aria-hidden="true"
            width={431}
            height={720}
          />
          {/* eslint-enable @next/next/no-img-element */}

          <h1 className={styles.title}>Your Planet&nbsp;A workspace</h1>
          <p className={styles.tagline}>Sign in to see the tools you have access to.</p>

          {error && (
            <p className={error.tone === 'notice' ? styles.notice : styles.error}>{error.text}</p>
          )}

          <div className={styles.actions}>
            {ready ? (
              <a className={styles.google} href={loginHref}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1H12v3.2h5.35c-.23 1.5-1.73 4.4-5.35 4.4a6.2 6.2 0 1 1 0-12.4 5.6 5.6 0 0 1 3.95 1.55l2.5-2.4A9.3 9.3 0 0 0 12 2.5a9.5 9.5 0 1 0 0 19c5.48 0 9.1-3.85 9.1-9.27 0-.62-.07-1.1-.15-1.13Z"
                  />
                </svg>
                Continue with Google
              </a>
            ) : (
              <p className={styles.devBadge}>
                Google sign-in isn&apos;t configured on this deployment (AUTH_MODE is not
                &ldquo;sso&rdquo;, or the GOOGLE_* variables are unset).
              </p>
            )}
          </div>

          <div className={styles.parent}>Planet A Foods · internal</div>
        </div>
      </main>
    </>
  );
}
