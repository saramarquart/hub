import { NextResponse } from 'next/server';
import {
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  oauthCookieOptions,
  safeNextPath,
} from '@/lib/auth/session';
import { googleAuthUrl, googleConfigured } from '@/lib/auth/google';
import { IS_SSO } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * GET /auth/google/login[?next=/path] — start the Google authorization-code
 * flow. Sets a short-lived anti-CSRF `state` cookie and redirects to Google's
 * consent page. An optional `next` (same-origin PATH only, validated by
 * safeNextPath) rides in a second short-lived cookie so the callback can land
 * the user where they were aiming.
 */
export async function GET(req: Request) {
  if (!IS_SSO || !googleConfigured()) {
    return NextResponse.json(
      { error: 'Google SSO not configured (set AUTH_MODE=sso + GOOGLE_* env)' },
      { status: 400 },
    );
  }

  const state = crypto.randomUUID().replace(/-/g, '');
  const next = safeNextPath(new URL(req.url).searchParams.get('next'));
  const res = NextResponse.redirect(googleAuthUrl(state));
  const opts = oauthCookieOptions();

  res.cookies.set(OAUTH_STATE_COOKIE, state, opts);
  // Clear rather than leave a previous attempt's `next` in place — otherwise a
  // plain sign-in inherits wherever the last abandoned attempt was headed.
  if (next) res.cookies.set(OAUTH_NEXT_COOKIE, next, opts);
  else res.cookies.set(OAUTH_NEXT_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
