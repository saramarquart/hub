import { NextResponse, type NextRequest } from 'next/server';
import { DEV_BYPASS, IS_SSO, isAllowedEmail } from '@/lib/config';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

/**
 * The gate. Everything not named in `config.matcher` below needs a valid
 * session, and an anonymous request is sent to /signin.
 *
 * The page itself ALSO calls resolveSession() and redirects on null. That is
 * not belt-and-braces for its own sake: middleware is easy to route around by
 * accident — one over-eager exclusion in the matcher below and a route is
 * silently public — whereas a server component that reads its own session
 * cannot be reached without going through it.
 *
 * FAILS CLOSED. Any path that does not end in "we verified this cookie and the
 * address is allowed" redirects: no session, bad signature, expired token,
 * missing AUTH_COOKIE_SECRET in production, or an exception while checking.
 */
export async function middleware(req: NextRequest) {
  if (DEV_BYPASS) return NextResponse.next();

  if (IS_SSO) {
    try {
      const token = req.cookies.get(SESSION_COOKIE)?.value;
      const email = await verifySessionToken(token);
      if (email && isAllowedEmail(email)) return NextResponse.next();
    } catch (err) {
      console.warn('[auth] middleware check failed:', (err as Error).message);
    }
  }

  const signin = new URL('/signin', req.url);
  // Send them back where they were aiming once they are in. Only the path — the
  // callback re-validates it with safeNextPath before using it.
  const from = req.nextUrl.pathname + req.nextUrl.search;
  if (from && from !== '/') signin.searchParams.set('next', from);
  return NextResponse.redirect(signin);
}

export const config = {
  matcher: [
    /**
     * Everything except:
     *   signin            — the closed door itself; gating it is an infinite loop.
     *   auth/*            — the routes that SET the cookie. Gating /auth/google/callback
     *                       means the only way to get a session requires already having one.
     *   api/health        — Railway's healthcheck has no browser and no cookie; a 307 to
     *                       /signin is not a 200, so the deploy would never go live.
     *   _next/static, _next/image — build output.
     *   icons/            — the tile icons, and the sign-in page's own mark.
     *   root-level static files — favicons, logos, manifest.webmanifest, sw.js.
     *
     * The static exclusion is ANCHORED to root-level names (`[^/]*\.ext$`), not
     * `.*\.ext$`. The unanchored form matches ANY path ending in an extension,
     * so a crafted deep URL ending in .png would bypass this entirely — the hole
     * paf_note found in its own matcher and fixed.
     */
    '/((?!signin|auth/|api/health|_next/static|_next/image|icons/|[^/]*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|js|json|txt|xml|webmanifest)$).*)',
  ],
};
