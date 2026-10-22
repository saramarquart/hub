import { NextResponse } from 'next/server';
import {
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  makeSessionToken,
  safeNextPath,
  sessionCookieOptions,
} from '@/lib/auth/session';
import { exchangeCode, fetchUserEmail, googleConfigured } from '@/lib/auth/google';
import { IS_SSO, appOrigin, isAllowedEmail } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * GET /auth/google/callback — Google redirects here with ?code&state. This PATH
 * must equal GOOGLE_REDIRECT_URI exactly, or Google refuses the round-trip.
 *
 * Verify state, exchange the code, fetch the VERIFIED userinfo email, check it
 * against the allow rule, then set the signed session cookie and redirect home
 * (or to the same-origin `next` path the login route stashed — re-validated
 * here, never trusted raw off the wire).
 *
 * Every failure lands on /signin with a reason. None of them sets a cookie.
 */
export async function GET(req: Request) {
  const origin = appOrigin(req.url);

  if (!IS_SSO || !googleConfigured()) {
    return NextResponse.redirect(new URL('/signin?error=not_configured', origin));
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = req.headers
    .get('cookie')
    ?.match(new RegExp(`${OAUTH_STATE_COOKIE}=([^;]+)`))?.[1];

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(new URL('/signin?error=bad_state', origin));
  }

  let email: string | null = null;
  try {
    const tokens = await exchangeCode(code);
    email = await fetchUserEmail(tokens.access_token);
  } catch (err) {
    console.warn('[oauth] callback failed:', (err as Error).message);
    return NextResponse.redirect(new URL('/signin?error=exchange_failed', origin));
  }

  if (!email || !isAllowedEmail(email)) {
    return NextResponse.redirect(new URL('/signin?error=not_allowed', origin));
  }

  const token = await makeSessionToken(email);
  if (!token) {
    // makeSessionToken refuses when production is running on the dev fallback
    // secret. Sending them home without a cookie would be an endless loop with
    // no explanation; say what is wrong instead.
    return NextResponse.redirect(new URL('/signin?error=not_configured', origin));
  }

  const rawNext = req.headers
    .get('cookie')
    ?.match(new RegExp(`${OAUTH_NEXT_COOKIE}=([^;]+)`))?.[1];
  let next: string | null = null;
  try {
    next = safeNextPath(rawNext ? decodeURIComponent(rawNext) : null);
  } catch {
    next = null;
  }

  const res = NextResponse.redirect(new URL(next ?? '/', origin));
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
  // Clear the one-time state + next cookies.
  res.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 });
  res.cookies.set(OAUTH_NEXT_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
