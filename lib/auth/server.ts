/**
 * Session resolution for server components and route handlers.
 *
 * Separate from session.ts because this one imports `next/headers`, which only
 * exists in the Node server runtime. middleware.ts must not reach for it.
 */
import { cookies } from 'next/headers';
import { DEV_BYPASS, DEV_EMAIL, IS_SSO, isAllowedEmail } from '@/lib/config';
import { SESSION_COOKIE, verifySessionToken, type Session } from './session';

/**
 * The current session, or null.
 *
 *   • DEV mode → a dev identity, no cookie needed, never in production.
 *   • SSO mode → the verified cookie email, RE-CHECKED against the allow rule
 *     on every request. Revoking a Google account therefore takes effect at the
 *     next page load rather than whenever a 14-day cookie happens to expire.
 *
 * Returns null on every failure path. Callers redirect to /signin on null, so
 * "we could not work out who this is" and "we know and they are not allowed"
 * both end at the same closed door.
 */
export async function resolveSession(): Promise<Session | null> {
  if (!IS_SSO) return DEV_BYPASS ? { email: DEV_EMAIL, via: 'dev' } : null;

  // Next 15: `cookies()` returns a Promise, where Next 14 returned the store
  // directly. Forgetting the await yields a truthy object whose .get() is
  // undefined — it throws rather than silently admitting anyone, but tsc is
  // what catches it, which is one reason `lint` here is `tsc --noEmit`.
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const email = await verifySessionToken(token);
  if (email && isAllowedEmail(email)) return { email, via: 'sso' };
  return null;
}
