/**
 * The signed session cookie: `base64url(payload).hex(HMAC-SHA256(payload))`,
 * payload being JSON `{ email, iat }`. Same scheme as paf_cogs and
 * paf_commodity — keep the three in step.
 *
 * WRITTEN AGAINST WEB CRYPTO, NOT node:crypto, and that is the whole point of
 * this file being separate. middleware.ts is the only place that sees a request
 * before a page renders, and Next runs middleware on the edge runtime, where
 * `node:crypto`'s createHmac does not exist. The obvious workaround — verify
 * properly in the page and merely check the cookie is *present* in middleware —
 * means two different answers to "is this session valid", and the weaker one
 * runs first. So there is one implementation, it is async, and both the edge
 * and the Node server call it.
 *
 * `crypto.subtle.verify` also removes the constant-time-compare footgun: it
 * compares the MAC itself, so there is no hand-rolled timingSafeEqual here to
 * get wrong (and no length-mismatch throw to remember to guard).
 */
import { AUTH_COOKIE_SECRET, IS_PROD, authSecretIsSecure } from '@/lib/config';

export const SESSION_COOKIE = 'paf_hub_session';
export const OAUTH_STATE_COOKIE = 'paf_hub_oauth_state';
/** Short-lived cookie carrying the post-login return path (same-origin path only). */
export const OAUTH_NEXT_COOKIE = 'paf_hub_oauth_next';

const MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days

export interface Session {
  email: string;
  /** How the session was established. */
  via: 'sso' | 'dev';
}

const encoder = new TextEncoder();

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function b64urlEncode(text: string): string {
  const bytes = encoder.encode(text);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(value: string): string | null {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Build the signed cookie value for an email, or null when the deployment is
 * running on the dev fallback secret in production — minting a cookie nobody
 * can trust is worse than refusing to mint one, because it looks like it worked.
 */
export async function makeSessionToken(email: string): Promise<string | null> {
  if (!authSecretIsSecure()) {
    console.error('[auth] AUTH_COOKIE_SECRET is unset in production; refusing to mint a session');
    return null;
  }
  const payload = JSON.stringify({ email: email.trim().toLowerCase(), iat: Date.now() });
  const body = b64urlEncode(payload);
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(AUTH_COOKIE_SECRET), encoder.encode(body));
  return `${body}.${toHex(sig)}`;
}

/**
 * Verify a cookie value and return the email it carries, or null if it is
 * absent, malformed, tampered with, or signed under a rotated secret.
 *
 * The secret is a parameter so tests can prove a token signed with one secret
 * is rejected under another without reaching into process.env.
 */
export async function verifySessionToken(
  token: string | undefined | null,
  secret: string = AUTH_COOKIE_SECRET,
): Promise<string | null> {
  if (!token) return null;
  if (secret === AUTH_COOKIE_SECRET && !authSecretIsSecure()) return null;

  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = fromHex(token.slice(dot + 1));
  if (!sig) return null;

  let ok = false;
  try {
    ok = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(secret),
      sig as unknown as BufferSource,
      encoder.encode(body),
    );
  } catch {
    return null;
  }
  if (!ok) return null;

  const json = b64urlDecode(body);
  if (json === null) return null;
  try {
    const payload = JSON.parse(json) as { email?: string; iat?: number };
    const iat = typeof payload.iat === 'number' ? payload.iat : 0;
    // A signature alone does not make a cookie current. Without this check a
    // token stays valid forever, so a laptop handed on to a new starter still
    // signs in as the person who left.
    if (!iat || Date.now() - iat > MAX_AGE_SEC * 1000) return null;
    const email = (payload.email ?? '').trim().toLowerCase();
    return email.includes('@') ? email : null;
  } catch {
    return null;
  }
}

/** Cookie attributes for Set-Cookie (secure in prod). */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: MAX_AGE_SEC,
  };
}

/** Attributes for the two short-lived cookies the OAuth round-trip needs. */
export function oauthCookieOptions(maxAge = 600) {
  return {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

/**
 * Restrict a post-login redirect target to a SAME-ORIGIN absolute path
 * ("/foo?x=y"). Rejects protocol-relative ("//evil.example"), scheme-ful,
 * backslash and control-character variants, so the callback can never be turned
 * into an open redirect that launders a phishing link through a
 * planet-a-foods.com hostname. Returns null when unusable.
 */
export function safeNextPath(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim();
  if (!v || v.length > 2048) return null;
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return null;
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1f\x7f]/.test(v)) return null;
  try {
    const u = new URL(v, 'http://placeholder.invalid');
    if (u.origin !== 'http://placeholder.invalid') return null;
    return u.pathname + u.search;
  } catch {
    return null;
  }
}
