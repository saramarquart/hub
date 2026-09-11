import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { appOrigin } from '@/lib/config';

export const dynamic = 'force-dynamic';

/** POST or GET /auth/signout — clear the session cookie and return to /signin. */
function handle(req: Request) {
  const res = NextResponse.redirect(new URL('/signin', appOrigin(req.url)));
  res.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}

export const GET = handle;
export const POST = handle;
