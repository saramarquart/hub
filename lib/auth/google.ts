/**
 * Google authorization-code flow, lifted from paf_cogs' src/lib/auth.ts so the
 * hub signs people in exactly the way the apps it links to already do.
 *
 * Nothing here decides who gets in — that is isAllowedEmail() in config.ts.
 * This file only establishes WHICH VERIFIED ADDRESS is knocking.
 */
import {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI,
} from '@/lib/config';

export function googleConfigured(): boolean {
  return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REDIRECT_URI);
}

/** Build the Google consent URL for a given anti-CSRF `state`. */
export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** Exchange an authorization code for tokens. */
export async function exchangeCode(
  code: string,
): Promise<{ access_token: string; id_token?: string }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: HTTP ${res.status}`);
  return (await res.json()) as { access_token: string; id_token?: string };
}

/**
 * Fetch the userinfo email using an access token. Returns null unless Google
 * reports the address as VERIFIED — an unverified address proves nothing about
 * who controls it, so matching one against ALLOWED_DOMAINS would let anyone who
 * can create a Google account claim to be @forplaneta.com.
 */
export async function fetchUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const info = (await res.json()) as { email?: string; email_verified?: boolean };
  if (!info.email || info.email_verified === false) return null;
  return info.email.trim().toLowerCase();
}
