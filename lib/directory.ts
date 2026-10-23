/**
 * The employee list, read live from Google Workspace.
 *
 * Sara chose pulling the directory over maintaining a list by hand, and the
 * reason is the failure mode of the alternative: a committed list of colleagues
 * is wrong the first time somebody joins and nothing anywhere says so. So there
 * is no list in this repo. There is no fixture, no seed, no `employees.json`.
 * The names exist in Google, in this module's in-memory cache for a few minutes,
 * and in Postgres only once an admin has actually granted somebody a tile.
 *
 * THIS MODULE IS OPTIONAL AND MUST STAY OPTIONAL.
 *
 * `admin.directory.user.readonly` is a domain-wide-delegation scope, and DWD is
 * granted per (client id, scope) by a Workspace super-admin in a console that
 * has no API. At the time of writing the hub's deployment has no service
 * account at all, so every call here fails — which is the ordinary state, not
 * an outage. The console therefore treats the directory as a CONVENIENCE:
 * present, it offers real colleagues to pick from; absent, the admin types an
 * address and everything else works identically. `loadDirectory()` never
 * throws and never returns a rejected promise for a configuration problem; it
 * returns a Directory whose `reason` says, in one sentence, what would fix it.
 *
 * Credentials follow the sibling apps' shape exactly — feedback's
 * `web/src/lib/googleCreds.ts` and paf-coa's `google_clients.py` both read a
 * service-account JSON out of the environment and impersonate a Workspace user
 * via `subject`. The same two variable names are used here on purpose, so the
 * value can be copied from one Railway service to another without translation.
 *
 * The one deliberate difference: the assertion is signed here with node:crypto
 * rather than by pulling in `googleapis`. The hub is a launcher whose entire
 * dependency list is Next, React, Drizzle and postgres; adding the full Google
 * client (and its bundling quirks inside a Next server component) to make one
 * GET request is a large permanent cost for a feature that is expected to be
 * switched off. The JWT below is the same RS256 assertion that library builds.
 */
import { createSign } from 'node:crypto';

/** One colleague, as the picker needs them. */
export interface DirectoryUser {
  email: string;
  name: string;
}

/**
 * The result of asking for the employee list. `available: false` is a normal
 * answer and the console renders it as a sentence, not an error page.
 */
export interface Directory {
  available: boolean;
  users: DirectoryUser[];
  /** Present when unavailable: what happened and what would fix it. */
  reason?: string;
}

interface ServiceAccountJson {
  client_email?: string;
  private_key?: string;
  client_id?: string;
}

/** Read-only. The console never writes to Google, and asking for more scope than that would be a lie. */
const DIRECTORY_SCOPE = 'https://www.googleapis.com/auth/admin.directory.user.readonly';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERS_ENDPOINT = 'https://admin.googleapis.com/admin/directory/v1/users';

/**
 * How long a fetched directory is reused. Long enough that opening the console
 * and ticking four people is one call to Google rather than five; short enough
 * that a new joiner shows up the same morning without a redeploy. The list is
 * only ever used to populate a picker, so staleness costs nothing — an address
 * that is not in it can still be typed.
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Google caps this endpoint at 500 per page. Planet A is ~70 people; the loop
 * below exists so that a domain that has grown does not silently show the first
 * page only, and it is bounded so a malformed nextPageToken cannot spin.
 */
const PAGE_SIZE = 200;
const MAX_PAGES = 10;

/**
 * A network timeout, because this call sits in the render path of /admin. With
 * no timeout a Google outage does not make the picker empty — it makes the
 * whole console hang, which is a much worse version of the same problem.
 */
const REQUEST_TIMEOUT_MS = 8000;

function env(name: string): string {
  return (process.env[name] ?? '').trim();
}

/**
 * The service-account JSON, base64-encoded. Same variable name as the feedback
 * app: base64 because a PEM private key has newlines in it, and newlines in a
 * Railway variable arrive mangled often enough to be worth never finding out.
 */
function serviceAccount(): ServiceAccountJson | null {
  const raw = env('GOOGLE_SERVICE_ACCOUNT_JSON_B64');
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, 'base64').toString('utf-8')) as ServiceAccountJson;
  } catch {
    return null;
  }
}

/**
 * The Workspace user the service account acts as. DWD cannot list the directory
 * as "nobody" — the token is always minted on behalf of a human, and that human
 * needs to be able to read users. Same variable name as the siblings.
 */
function impersonateEmail(): string {
  return env('GOOGLE_IMPERSONATE_EMAIL').toLowerCase();
}

/** True when this deployment has been given something to try with. */
export function directoryConfigured(): boolean {
  return !!env('GOOGLE_SERVICE_ACCOUNT_JSON_B64') && !!impersonateEmail();
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Mint an access token by signing the standard Google service-account
 * assertion. `sub` is the whole point: without it the token belongs to the
 * service account, which is not a member of the Workspace and can see no users.
 */
async function accessToken(sa: ServiceAccountJson, subject: string): Promise<string> {
  if (!sa.client_email || !sa.private_key) {
    throw new Error('service-account JSON has no client_email/private_key');
  }
  const iat = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      sub: subject,
      scope: DIRECTORY_SCOPE,
      aud: TOKEN_ENDPOINT,
      iat,
      exp: iat + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const signature = b64url(
    createSign('RSA-SHA256').update(signingInput).sign(sa.private_key.replace(/\\n/g, '\n')),
  );

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${signingInput}.${signature}`,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!res.ok || !body.access_token) {
    // `unauthorized_client` here is the specific, expected failure: the JSON is
    // valid and the key signs fine, but nobody has delegated this client id for
    // this scope yet. Say so rather than "auth failed".
    throw new Error(
      body.error === 'unauthorized_client'
        ? 'unauthorized_client — the service account is not delegated for the directory scope'
        : `token request failed (${res.status} ${body.error ?? ''} ${body.error_description ?? ''})`.trim(),
    );
  }
  return body.access_token;
}

/** Shape of the bit of the Directory API response this module reads. */
interface UsersPage {
  users?: {
    primaryEmail?: string;
    name?: { fullName?: string };
    suspended?: boolean;
    archived?: boolean;
  }[];
  nextPageToken?: string;
}

/**
 * Turn the API payload into the picker's list. Pure and exported so the parsing
 * rules — suspended people are dropped, a user with no name falls back to the
 * local part, the list is sorted and de-duplicated — are testable without a
 * Google account.
 *
 * Suspended and archived accounts are dropped because they are the leavers.
 * Offering a leaver in a picker of "who may see this tile" invites granting a
 * tile to somebody who no longer works here, which is not dangerous (hiding a
 * tile is cosmetic) but is exactly the kind of stale row this model exists to
 * avoid accumulating.
 */
export function parseDirectoryUsers(pages: readonly UsersPage[]): DirectoryUser[] {
  const byEmail = new Map<string, DirectoryUser>();
  for (const page of pages) {
    for (const u of page.users ?? []) {
      if (u.suspended || u.archived) continue;
      const email = (u.primaryEmail ?? '').trim().toLowerCase();
      if (!email.includes('@')) continue;
      const name = (u.name?.fullName ?? '').trim() || email.slice(0, email.indexOf('@'));
      if (!byEmail.has(email)) byEmail.set(email, { email, name });
    }
  }
  return [...byEmail.values()].sort((a, b) => a.name.localeCompare(b.name));
}

interface CacheEntry {
  at: number;
  value: Directory;
}

/**
 * Cached on globalThis rather than in a module-level `let` for the same reason
 * the postgres pool is: Next's dev server re-evaluates modules on hot reload,
 * and a per-module cache would quietly become no cache at all.
 *
 * Failures are cached too, and on purpose. The expected steady state of this
 * deployment is "not delegated", and re-signing a JWT and asking Google for a
 * token on every single render of /admin — to be told no every single time — is
 * a slow console and a pointless dependency on Google being up.
 */
declare global {
  // eslint-disable-next-line no-var
  var __paf_hub_directory: CacheEntry | undefined;
}

/** Drop the cached answer. Used after an admin explicitly asks to retry. */
export function clearDirectoryCache(): void {
  global.__paf_hub_directory = undefined;
}

/**
 * The employee list, or a reason there isn't one.
 *
 * NEVER THROWS. Every caller is a page that has to render either way, and a
 * thrown error here would replace a working console with an error boundary over
 * a feature that is explicitly optional.
 */
export async function loadDirectory(): Promise<Directory> {
  const cached = global.__paf_hub_directory;
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.value;

  const value = await fetchDirectory();
  global.__paf_hub_directory = { at: Date.now(), value };
  return value;
}

async function fetchDirectory(): Promise<Directory> {
  const sa = serviceAccount();
  const subject = impersonateEmail();

  if (!env('GOOGLE_SERVICE_ACCOUNT_JSON_B64')) {
    return {
      available: false,
      users: [],
      reason:
        'No Google service account is configured, so the staff directory cannot be read. Set GOOGLE_SERVICE_ACCOUNT_JSON_B64 and GOOGLE_IMPERSONATE_EMAIL on this deployment to turn the picker on.',
    };
  }
  if (!sa) {
    return {
      available: false,
      users: [],
      reason:
        'GOOGLE_SERVICE_ACCOUNT_JSON_B64 is set but is not valid base64-encoded JSON, so the staff directory cannot be read.',
    };
  }
  if (!subject) {
    return {
      available: false,
      users: [],
      reason:
        'GOOGLE_IMPERSONATE_EMAIL is not set. Domain-wide delegation reads the directory on behalf of a Workspace user, so it needs an address of somebody allowed to list users.',
    };
  }

  try {
    const token = await accessToken(sa, subject);
    const pages: UsersPage[] = [];
    let pageToken: string | undefined;

    for (let i = 0; i < MAX_PAGES; i++) {
      const url = new URL(USERS_ENDPOINT);
      // `my_customer` means "the Workspace the impersonated user belongs to",
      // which avoids hard-coding a customer id that would have to be looked up
      // and would be wrong if this were ever pointed at another domain.
      url.searchParams.set('customer', 'my_customer');
      url.searchParams.set('maxResults', String(PAGE_SIZE));
      url.searchParams.set('orderBy', 'email');
      url.searchParams.set('projection', 'basic');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const res = await fetch(url, {
        headers: { authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`directory list failed (${res.status}) ${detail.slice(0, 200)}`);
      }
      const page = (await res.json()) as UsersPage;
      pages.push(page);
      pageToken = page.nextPageToken;
      if (!pageToken) break;
    }

    return { available: true, users: parseDirectoryUsers(pages) };
  } catch (err) {
    const message = (err as Error).message ?? String(err);
    // Logged, not surfaced verbatim: the message can carry a chunk of Google's
    // error body, and this page is rendered for a human who needs the sentence
    // below, not a stack trace.
    console.warn('[directory] could not read the Workspace directory:', message);
    return {
      available: false,
      users: [],
      reason: directoryFailureReason(message),
    };
  }
}

/**
 * Translate a failure into the one sentence an admin can act on. Pure and
 * exported so the mapping is tested — this text is the entire difference
 * between "the picker is empty" and "the picker is empty because nobody has
 * granted this scope yet, and here is who can".
 */
export function directoryFailureReason(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('unauthorized_client') || m.includes('403') || m.includes('forbidden')) {
    return `The staff directory is unavailable: Google refused the request. The service account needs domain-wide delegation for ${DIRECTORY_SCOPE} — a Workspace super-admin grants it under Security → API controls → Domain-wide delegation — and the impersonated account must be allowed to read users.`;
  }
  if (m.includes('invalid_grant')) {
    return 'The staff directory is unavailable: Google rejected the impersonation. Check that GOOGLE_IMPERSONATE_EMAIL is a real, active account in this Workspace.';
  }
  if (m.includes('timeout') || m.includes('aborted')) {
    return 'The staff directory is unavailable: Google did not answer in time. Addresses can still be typed in, and the list will be retried in a few minutes.';
  }
  return 'The staff directory is unavailable, so there is no list of colleagues to pick from. Addresses can still be typed in by hand.';
}
