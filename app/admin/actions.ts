'use server';

/**
 * The four writes the console can make. Together they are the only code in this
 * repo that changes app_restrictions or app_restriction_grants.
 *
 * EVERY ONE OF THEM RE-CHECKS THAT THE CALLER IS AN ADMIN. A server action is
 * not a private function that happens to run on the server — it compiles to a
 * POST endpoint addressed by an opaque id, and that id is in the JavaScript
 * served to every signed-in employee. The gate on the page it was rendered from
 * is not on the endpoint. middleware.ts is not either: it lets in everybody
 * with a @forplaneta.com account, which is the whole company.
 *
 * They also re-check the app id against lib/apps.ts, for the same reason:
 * whatever the form offered, the endpoint takes a string.
 *
 * Refusals redirect to /admin?err=denied rather than throwing. An admin whose
 * session quietly expired mid-session should see a sentence, not a stack trace
 * in an error boundary — and a non-admin who found the endpoint learns nothing
 * from it either way.
 */
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminSessionOrNull } from '@/lib/auth/admin';
import { isKnownAppId, normalizeEmail, normalizeNote, parseEmailList } from '@/lib/admin';
import { databaseConfigured, getDb } from '@/lib/db/client';
import { appRestrictionGrants, appRestrictions } from '@/lib/db/schema';
import { clearDirectoryCache } from '@/lib/directory';

/**
 * Where every action ends: back on the console, with a code the page turns into
 * one sentence. Query parameters rather than a returned value so the whole
 * console keeps working with JavaScript disabled — these are plain <form>
 * posts, and the result of one has to survive a full navigation.
 */
function done(params: Record<string, string | number | undefined>): never {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const qs = q.toString();
  redirect(qs ? `/admin?${qs}` : '/admin');
}

/**
 * The preamble every action shares: an admin session, a database to write to,
 * and an app id that names a real tile. Returns the admin's address, or does
 * not return at all.
 */
async function guard(formData: FormData): Promise<{ email: string; appId: string }> {
  const session = await adminSessionOrNull();
  if (!session) done({ err: 'denied' });
  if (!databaseConfigured()) done({ err: 'no_db' });

  const appId = String(formData.get('appId') ?? '').trim();
  if (!isKnownAppId(appId)) done({ err: 'unknown_app' });

  return { email: session.email, appId };
}

/**
 * Revalidate the console AND the launcher. The launcher is force-dynamic so
 * this is belt and braces there, but the point of the console is that its
 * effect is visible on the front page, and "I changed it and it did not change"
 * is the complaint this one line prevents.
 */
function refresh(): void {
  revalidatePath('/admin');
  revalidatePath('/');
}

/**
 * Mark a tile as not-visible-by-default.
 *
 * The tile is now visible to NOBODY until people are granted it — including the
 * admin who just clicked. That is deliberate (see lib/db/schema.ts) and the
 * console says so on screen, because the alternative — auto-granting whoever
 * restricted it — makes "restricted" mean something different depending on who
 * clicked, and quietly writes a row nobody asked for.
 */
export async function restrictApp(formData: FormData): Promise<void> {
  const { email, appId } = await guard(formData);
  const note = normalizeNote(String(formData.get('note') ?? ''));

  await getDb()
    .insert(appRestrictions)
    .values({ appId, note, createdBy: email })
    // Already restricted: the admin double-clicked, or two tabs are open. Doing
    // nothing is right — overwriting would silently replace an existing note
    // and created_by with this click's.
    .onConflictDoNothing();

  refresh();
  done({ msg: 'restricted', app: appId });
}

/**
 * Make a tile visible to everyone again. The grant rows go with it, by the
 * CASCADE in the schema — see the comment there for why keeping them would be
 * worse than losing them.
 */
export async function unrestrictApp(formData: FormData): Promise<void> {
  const { appId } = await guard(formData);

  await getDb().delete(appRestrictions).where(eq(appRestrictions.appId, appId));

  refresh();
  done({ msg: 'unrestricted', app: appId });
}

/**
 * Add people to a restricted tile.
 *
 * Accepts several addresses at once. Invalid ones are counted and reported
 * rather than dropped: pasting five addresses and seeing four appear, with no
 * word about the fifth, is the failure this reports its way out of.
 */
export async function grantApp(formData: FormData): Promise<void> {
  const { email, appId } = await guard(formData);
  const { valid, invalid } = parseEmailList(String(formData.get('emails') ?? ''));

  if (valid.length === 0) {
    done({ err: 'no_emails', app: appId, bad: invalid.length || undefined });
  }

  await getDb()
    .insert(appRestrictionGrants)
    .values(valid.map((e) => ({ appId, email: e, grantedBy: email })))
    // Re-adding somebody who is already on the list is a no-op, not an error.
    // The realistic case is an admin re-pasting the same group after adding one
    // more name to it.
    .onConflictDoNothing();

  refresh();
  done({ msg: 'granted', app: appId, n: valid.length, bad: invalid.length || undefined });
}

/** Take one person off a restricted tile's list. */
export async function revokeApp(formData: FormData): Promise<void> {
  const { appId } = await guard(formData);
  const email = normalizeEmail(String(formData.get('email') ?? ''));
  if (!email) done({ err: 'no_emails', app: appId });

  await getDb()
    .delete(appRestrictionGrants)
    .where(and(eq(appRestrictionGrants.appId, appId), eq(appRestrictionGrants.email, email)));

  refresh();
  done({ msg: 'revoked', app: appId });
}

/**
 * Throw away the cached staff directory and look again.
 *
 * Exists because the cache also remembers FAILURES (see lib/directory.ts), so
 * after somebody finally grants the delegation scope the console would go on
 * saying "unavailable" for another few minutes with no way to hurry it. This
 * is the button that says "I fixed it, try again".
 *
 * Admin-gated like the rest — it is the one action that does not write to the
 * database, but it does make the deployment call Google, and that is not
 * something every signed-in employee should be able to trigger in a loop.
 */
export async function refreshDirectory(): Promise<void> {
  const session = await adminSessionOrNull();
  if (!session) done({ err: 'denied' });

  clearDirectoryCache();
  revalidatePath('/admin');
  done({ msg: 'directory_refreshed' });
}
