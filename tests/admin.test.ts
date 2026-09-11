import { describe, expect, it } from 'vitest';
import {
  addressesOutsideDomains,
  appById,
  isKnownAppId,
  normalizeEmail,
  normalizeNote,
  parseEmailList,
} from '@/lib/admin';
import { apps } from '@/lib/apps';

/**
 * These are the checks that stand between a server action and the two tables.
 * Nobody will be signing in to click through the console until the OAuth client
 * exists, so the rules it enforces are proved here instead.
 */

describe('isKnownAppId — the only thing constraining app_id', () => {
  it('accepts every id actually in lib/apps.ts', () => {
    for (const app of apps) expect(isKnownAppId(app.id)).toBe(true);
  });

  it('rejects an id that names nothing', () => {
    // app_restrictions.app_id has no foreign key — there is no table of apps to
    // point at — so this function is the whole constraint. A row written for a
    // ghost id is inert in visibility.ts and therefore silent forever.
    expect(isKnownAppId('paf_nonexistent')).toBe(false);
    expect(isKnownAppId('')).toBe(false);
    expect(isKnownAppId('../../etc/passwd')).toBe(false);
  });

  it('is keyed on the id, not the display name', () => {
    // Renaming paf_coa to "Certificates" must not detach its restriction.
    expect(isKnownAppId('paf_coa')).toBe(true);
    expect(isKnownAppId('paf_coa ')).toBe(false);
    expect(isKnownAppId('QOaroma')).toBe(false);
    expect(appById('qoaroma')?.name).toBe('QOaroma');
  });
});

describe('normalizeEmail', () => {
  it('lower-cases and trims', () => {
    expect(normalizeEmail('  Sara@ForPlaneta.com ')).toBe('sara@forplaneta.com');
  });

  it('rejects the double-@ smuggle', () => {
    // The same case lib/config.ts guards: a naive endsWith reads this as a
    // forplaneta.com address. Two opinions about what an email is, in one
    // codebase, is how the weaker one gets reused somewhere it matters.
    expect(normalizeEmail('evil@attacker.com@forplaneta.com')).toBeNull();
  });

  it('rejects malformed addresses', () => {
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail('nobody')).toBeNull();
    expect(normalizeEmail('@forplaneta.com')).toBeNull();
    expect(normalizeEmail('sara@')).toBeNull();
    expect(normalizeEmail('sara@localhost')).toBeNull();
    expect(normalizeEmail(`${'a'.repeat(250)}@forplaneta.com`)).toBeNull();
  });

  it('rejects anything that would be rendered back into the page as markup', () => {
    expect(normalizeEmail('"><script>@forplaneta.com')).toBeNull();
    expect(normalizeEmail('sara@forplaneta.com\n')).toBe('sara@forplaneta.com');
    expect(normalizeEmail('sa ra@forplaneta.com')).toBeNull();
  });
});

describe('parseEmailList — the "add people" box', () => {
  it('takes several addresses separated by commas, spaces or newlines', () => {
    const { valid, invalid } = parseEmailList(
      'sara@forplaneta.com, nils@forplaneta.com\nthomas@forplaneta.com  max@forplaneta.com',
    );
    expect(valid).toEqual([
      'sara@forplaneta.com',
      'nils@forplaneta.com',
      'thomas@forplaneta.com',
      'max@forplaneta.com',
    ]);
    expect(invalid).toEqual([]);
  });

  it('de-duplicates, case-insensitively', () => {
    // Re-pasting the same group with one name added is the realistic case.
    const { valid } = parseEmailList('Sara@forplaneta.com sara@FORPLANETA.com');
    expect(valid).toEqual(['sara@forplaneta.com']);
  });

  it('reports bad entries instead of dropping them', () => {
    // Pasting five and seeing four appear, with no word about the fifth, is the
    // failure this return value exists to prevent.
    const { valid, invalid } = parseEmailList('sara@forplaneta.com, oops, nils@forplaneta.com');
    expect(valid).toEqual(['sara@forplaneta.com', 'nils@forplaneta.com']);
    expect(invalid).toEqual(['oops']);
  });

  it('returns nothing for an empty or whitespace-only box', () => {
    expect(parseEmailList('')).toEqual({ valid: [], invalid: [] });
    expect(parseEmailList('   \n , ; ')).toEqual({ valid: [], invalid: [] });
  });
});

describe('addressesOutsideDomains — who was granted a tile they can never see', () => {
  it('flags an address that cannot sign in to the hub at all', () => {
    expect(
      addressesOutsideDomains(['sara@forplaneta.com', 'someone@gmail.com'], ['forplaneta.com']),
    ).toEqual(['someone@gmail.com']);
  });

  it('does not flag a guest who is on ALLOWED_EMAILS', () => {
    // ALLOWED_EMAILS exists for contractors on another domain, so an
    // out-of-domain address can be perfectly deliberate.
    expect(
      addressesOutsideDomains(['guest@example.com'], ['forplaneta.com'], ['guest@example.com']),
    ).toEqual([]);
  });

  it('flags nothing when no domain rule is configured', () => {
    // How `npm run dev` runs: nothing to compare against, so nothing to warn about.
    expect(addressesOutsideDomains(['anyone@anywhere.com'], [])).toEqual([]);
  });
});

describe('normalizeNote', () => {
  it('collapses whitespace and turns empty into null', () => {
    expect(normalizeNote('  R&D   only  ')).toBe('R&D only');
    expect(normalizeNote('   ')).toBeNull();
    expect(normalizeNote(null)).toBeNull();
    expect(normalizeNote(undefined)).toBeNull();
  });

  it('caps the length so the text column is never the thing that fails a write', () => {
    expect(normalizeNote('x'.repeat(900))?.length).toBe(500);
  });
});
