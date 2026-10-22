/**
 * App config from env. Nothing here throws at import time — `next build` runs
 * with NODE_ENV=production and none of the runtime variables set, so an
 * import-time throw would break the build rather than the deploy.
 *
 * Ported from paf_cogs' src/lib/config.ts, which ported it from paf_commodity.
 * Keep the three in step: the cookie scheme is deliberately identical so that
 * fixing a flaw in one is a copy-paste into the others.
 */

export const APP_TITLE = 'Planet A Foods · Workspace';

/** auth mode: 'sso' = real Google OAuth; anything else = dev bypass. */
export const AUTH_MODE = (process.env.AUTH_MODE ?? 'dev').trim().toLowerCase();
export const IS_SSO = AUTH_MODE === 'sso';

export const IS_PROD = process.env.NODE_ENV === 'production';

/**
 * The dev bypass exists so `npm run dev` needs no Google client, and it is
 * available ONLY outside production. A deployment that forgets AUTH_MODE=sso
 * has to serve NOBODY rather than everybody: the hub is the company's front
 * door and its tile list names every internal system Planet A runs, with a
 * working URL for each. That is a map for anyone who finds the hostname.
 */
export const DEV_BYPASS = !IS_SSO && !IS_PROD;

/** Google OAuth client (only needed when IS_SSO). */
export const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID ?? '').trim();
export const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET ?? '').trim();
export const GOOGLE_REDIRECT_URI = (process.env.GOOGLE_REDIRECT_URI ?? '').trim();

/**
 * Public origin of the app. Behind Railway's proxy a route handler's `req.url`
 * resolves to the internal http://localhost:PORT — NEVER use it to build a
 * redirect Location or the browser gets bounced to localhost and the sign-in
 * loop dead-ends on the user's own machine. Use this.
 */
export const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL ?? '').trim();

export function appOrigin(fallbackUrl: string): string {
  if (PUBLIC_BASE_URL) return PUBLIC_BASE_URL.replace(/\/$/, '');
  try {
    if (GOOGLE_REDIRECT_URI) return new URL(GOOGLE_REDIRECT_URI).origin;
  } catch {
    /* fall through to the request's own origin */
  }
  try {
    return new URL(fallbackUrl).origin;
  } catch {
    return fallbackUrl;
  }
}

/**
 * HMAC secret for the signed session cookie. There is a dev default so local
 * work needs no setup, and it is NEVER usable in production: a publicly known
 * secret makes every session cookie forgeable by anyone who has read this
 * repo — which today is anyone at all, because the repo is public.
 *
 * Checked at request time by `authSecretIsSecure()`, not at import time, so the
 * production build (NODE_ENV=production, no runtime env) still succeeds.
 */
export const AUTH_COOKIE_SECRET =
  (process.env.AUTH_COOKIE_SECRET ?? '').trim() || DEV_COOKIE_SECRET();

function DEV_COOKIE_SECRET(): string {
  return 'dev-insecure-cookie-secret-change-me';
}

/**
 * False when production is running on the dev fallback secret. Callers treat
 * that as "no session can be established" rather than throwing, so the failure
 * shows up as everyone being bounced to /signin with a configuration message —
 * which is loud, and closed.
 */
export function authSecretIsSecure(): boolean {
  return !(IS_PROD && AUTH_COOKIE_SECRET === DEV_COOKIE_SECRET());
}

/**
 * Individual addresses allowed to sign in (exact, lower-cased). Expected to be
 * EMPTY here: the hub is open to the whole company via ALLOWED_DOMAINS below.
 * It exists for the guest case — a contractor on a non-forplaneta.com Google
 * account who still needs the launcher.
 */
export const ALLOWED_EMAILS: string[] = (process.env.ALLOWED_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * Whole domains allowed to sign in, e.g. "forplaneta.com". This is the hub's
 * actual rule and it is set to forplaneta.com in production: every employee
 * gets the launcher.
 *
 * A domain here means a Google account Google itself reports as VERIFIED (see
 * fetchUserEmail), not a string somebody typed. Values may carry a leading "@".
 */
export const ALLOWED_DOMAINS: string[] = (process.env.ALLOWED_DOMAINS ?? '')
  .split(',')
  .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
  .filter(Boolean);

/**
 * The access rule, as a pure function so the interesting cases can be tested
 * without touching process.env.
 *
 * @param admitOnEmpty what BOTH lists being empty means. False in production —
 *   an unconfigured deployment must admit nobody rather than every Google
 *   account on the internet. True in dev, so `npm run dev` works unconfigured.
 */
export function emailAllowed(
  email: string,
  allowed: string[],
  admitOnEmpty: boolean,
  domains: string[] = [],
): boolean {
  const e = (email || '').trim().toLowerCase();
  const at = e.indexOf('@');
  // Require exactly one "@" with something either side. Without this,
  // "evil@attacker.com@forplaneta.com" reads as a forplaneta.com address to a
  // naive `endsWith`, so the domain is only ever taken from a string that has a
  // single "@" in it at all.
  if (at <= 0 || at !== e.lastIndexOf('@') || at === e.length - 1) return false;
  if (allowed.length === 0 && domains.length === 0) return admitOnEmpty;
  if (domains.includes(e.slice(at + 1))) return true;
  return allowed.includes(e);
}

export function isAllowedEmail(email: string): boolean {
  return emailAllowed(email, ALLOWED_EMAILS, !IS_PROD, ALLOWED_DOMAINS);
}

/**
 * Who may administer tile visibility.
 *
 * Nothing in this repo reads it yet — the admin console is the next change.
 * It lives here so that console does not have to invent its own notion of
 * "admin" halfway through being written, and so the answer is one environment
 * variable rather than a hard-coded address in a component.
 *
 * Defaults to Sara, who asked for the console and is the only person who has
 * said they want it. Widening this is an env change, not a deploy.
 */
export const ADMIN_EMAILS: string[] = (
  process.env.ADMIN_EMAILS ?? 'sara@forplaneta.com'
)
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdmin(email: string | null | undefined): boolean {
  const e = (email ?? '').trim().toLowerCase();
  return e !== '' && ADMIN_EMAILS.includes(e);
}

/** Dev fallback identity when AUTH_MODE!=sso. */
export const DEV_EMAIL = ALLOWED_EMAILS[0] ?? ADMIN_EMAILS[0] ?? 'dev@local';
