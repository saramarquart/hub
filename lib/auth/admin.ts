/**
 * The admin gate, for the console page and for every mutation behind it.
 *
 * middleware.ts already redirects anonymous requests away from /admin. That is
 * a convenience and NOT the security boundary, for two separate reasons:
 *
 *   1. Middleware only proves that SOMEBODY is signed in. Everyone with a
 *      @forplaneta.com account passes it — that is the hub's whole access rule.
 *      It has never had an opinion about who is an admin.
 *   2. A matcher is one regex away from exempting a route by accident, and a
 *      server action is an ordinary POST endpoint that is reachable by its
 *      action id whether or not the page that renders the form was.
 *
 * So the page calls requireAdmin() and so does every action. A handler that
 * trusts middleware is one refactor away from being open, and the refactor that
 * opens it will not look like a security change.
 */
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/config';
import { resolveSession } from './server';
import type { Session } from './session';

/**
 * The session of an admin, or no return at all.
 *
 * Not signed in → /signin, carrying ?next so they land back here.
 * Signed in but not an admin → the launcher. Deliberately not a 403 page: from
 * a normal employee's point of view /admin is a URL that does not exist for
 * them, and an explanation of what they are not allowed to do is an invitation.
 */
export async function requireAdmin(): Promise<Session> {
  const session = await resolveSession();
  if (!session) redirect('/signin?next=%2Fadmin');
  if (!isAdmin(session.email)) redirect('/');
  return session;
}

/**
 * The same check for a mutation, which must not redirect — a server action that
 * redirects on refusal looks to the caller exactly like one that succeeded and
 * then navigated. Returns null instead, and the actions turn that into a
 * refusal the page can render.
 */
export async function adminSessionOrNull(): Promise<Session | null> {
  const session = await resolveSession();
  if (!session || !isAdmin(session.email)) return null;
  return session;
}
