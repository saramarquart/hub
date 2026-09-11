/**
 * The rules the admin console enforces before it writes a row, kept pure and
 * kept here so they can be tested without a database, a session or a browser.
 *
 * The mutations in app/admin/actions.ts are the only writers of the two
 * visibility tables, and every one of them runs its arguments through this
 * module first. That is not ceremony: a server action is an ordinary HTTP POST
 * endpoint that anything can call with anything, so "the form only offers the
 * nine real app ids" is a statement about the form, not about the endpoint.
 */
import { apps, type AppTile } from '@/lib/apps';

/**
 * The tile ids that actually exist, from lib/apps.ts — still the single source
 * of truth for what an app IS.
 *
 * Checked on every write because `app_restrictions.app_id` has no foreign key
 * to constrain it (there is no table of apps). Without this check a typo, or a
 * crafted POST, puts a row in the table for an id that names nothing: it is
 * inert by design in visibility.ts, so nothing breaks and nothing complains,
 * and six months later the console shows a restriction list with a ghost in it
 * that nobody can explain or remove.
 */
export function isKnownAppId(appId: string): boolean {
  return apps.some((a) => a.id === appId);
}

export function appById(appId: string): AppTile | undefined {
  return apps.find((a) => a.id === appId);
}

/**
 * Normalise one address, or null if it is not one.
 *
 * The single-"@" rule is the same one lib/config.ts' emailAllowed uses, and for
 * the same reason: "evil@attacker.com@forplaneta.com" reads as a forplaneta.com
 * address to anything that takes the domain with a naive endsWith. Here the
 * stakes are lower — a bad row in a grant list hides nothing and reveals
 * nothing — but two different opinions about what an email address is, in one
 * codebase, is how the lower-stakes one ends up being the one that gets reused.
 */
export function normalizeEmail(raw: string): string | null {
  const e = (raw ?? '').trim().toLowerCase();
  if (!e || e.length > 255) return null;
  const at = e.indexOf('@');
  if (at <= 0 || at !== e.lastIndexOf('@') || at === e.length - 1) return null;
  // No whitespace or control characters anywhere: these values are rendered
  // back into the page and compared against the session email.
  // eslint-disable-next-line no-control-regex
  if (/[\s\x00-\x1f\x7f<>"']/.test(e)) return null;
  if (!e.slice(at + 1).includes('.')) return null;
  return e;
}

export interface ParsedEmails {
  valid: string[];
  invalid: string[];
}

/**
 * Parse the "add people" field. It accepts several addresses at once, separated
 * by commas, spaces or newlines, because the realistic use is pasting the three
 * or four people who need a restricted tile rather than adding them one at a
 * time and waiting for a page load between each.
 *
 * Bad entries are returned rather than silently dropped. Dropping them means an
 * admin pastes five addresses, sees four appear, and has no idea which one did
 * not take or why.
 */
export function parseEmailList(raw: string): ParsedEmails {
  const seen = new Set<string>();
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const piece of (raw ?? '').split(/[\s,;]+/)) {
    if (!piece) continue;
    const email = normalizeEmail(piece);
    if (!email) {
      invalid.push(piece.slice(0, 80));
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    valid.push(email);
  }
  return { valid, invalid };
}

/**
 * Addresses that will never see the tile they were just granted, because they
 * cannot sign in to the hub at all — a typo'd domain, or somebody's personal
 * account. Not an error: ALLOWED_EMAILS exists for guests on other domains, so
 * an address outside ALLOWED_DOMAINS can be perfectly deliberate. The console
 * says it out loud instead of deciding.
 *
 * Returns [] when no domain rule is configured, which is how `npm run dev`
 * runs — there is nothing to compare against, so there is nothing to warn about.
 */
export function addressesOutsideDomains(
  emails: readonly string[],
  allowedDomains: readonly string[],
  allowedEmails: readonly string[] = [],
): string[] {
  if (allowedDomains.length === 0) return [];
  return emails.filter((e) => {
    if (allowedEmails.includes(e)) return false;
    return !allowedDomains.includes(e.slice(e.indexOf('@') + 1));
  });
}

/**
 * The note stored alongside a restriction — "why", for whoever reads the table
 * in six months. Trimmed, capped to the column, and empty becomes null so the
 * console can tell "no reason given" from "the reason is a blank string".
 */
export function normalizeNote(raw: string | null | undefined): string | null {
  const n = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!n) return null;
  return n.slice(0, 500);
}
