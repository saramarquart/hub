import { afterEach, describe, expect, it } from 'vitest';
import {
  clearDirectoryCache,
  directoryConfigured,
  directoryFailureReason,
  loadDirectory,
  parseDirectoryUsers,
} from '@/lib/directory';

/**
 * The directory is the optional half of this feature, and the case that has to
 * work is the one where it is switched off. The scope it needs is granted by a
 * Workspace super-admin in a console with no API, so "unavailable" is the
 * deployment's expected steady state — not an incident.
 */

afterEach(() => {
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64;
  delete process.env.GOOGLE_IMPERSONATE_EMAIL;
  clearDirectoryCache();
});

describe('degrading when the directory is not available', () => {
  it('reports unavailable, with a reason, when nothing is configured', async () => {
    const d = await loadDirectory();
    expect(d.available).toBe(false);
    expect(d.users).toEqual([]);
    // The failure this feature was told to avoid is a blank picker with no
    // explanation, so an empty `reason` is itself a bug.
    expect(d.reason).toBeTruthy();
    expect(d.reason).toContain('GOOGLE_SERVICE_ACCOUNT_JSON_B64');
  });

  it('never throws — /admin has to render either way', async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64 = 'not-base64-json';
    process.env.GOOGLE_IMPERSONATE_EMAIL = 'sara@forplaneta.com';
    await expect(loadDirectory()).resolves.toMatchObject({ available: false });
  });

  it('says so when the impersonation address is missing', async () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64 = Buffer.from(
      JSON.stringify({ client_email: 'sa@x.iam.gserviceaccount.com', private_key: 'k' }),
    ).toString('base64');
    const d = await loadDirectory();
    expect(d.available).toBe(false);
    expect(d.reason).toContain('GOOGLE_IMPERSONATE_EMAIL');
  });

  it('knows whether it has been given anything to try with', () => {
    expect(directoryConfigured()).toBe(false);
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64 = 'x';
    process.env.GOOGLE_IMPERSONATE_EMAIL = 'sara@forplaneta.com';
    expect(directoryConfigured()).toBe(true);
  });
});

describe('directoryFailureReason — the sentence the admin reads', () => {
  it('names domain-wide delegation when Google refuses the client', () => {
    // This is the expected failure on the live deployment today, so it must say
    // what would fix it rather than "auth failed".
    const text = directoryFailureReason(
      'unauthorized_client — the service account is not delegated for the directory scope',
    );
    expect(text).toContain('domain-wide delegation');
    expect(text).toContain('admin.directory.user.readonly');
  });

  it('names delegation on a 403 too', () => {
    expect(directoryFailureReason('directory list failed (403) Forbidden')).toContain(
      'domain-wide delegation',
    );
  });

  it('points at the impersonated account on invalid_grant', () => {
    expect(directoryFailureReason('token request failed (400 invalid_grant)')).toContain(
      'GOOGLE_IMPERSONATE_EMAIL',
    );
  });

  it('always ends up saying addresses can still be typed', () => {
    expect(directoryFailureReason('something nobody predicted')).toContain('typed in by hand');
  });
});

describe('parseDirectoryUsers', () => {
  const page = {
    users: [
      { primaryEmail: 'Nils@forplaneta.com', name: { fullName: 'Nils B' } },
      { primaryEmail: 'sara@forplaneta.com', name: { fullName: 'Sara M' } },
      { primaryEmail: 'gone@forplaneta.com', name: { fullName: 'Gone Away' }, suspended: true },
      { primaryEmail: 'old@forplaneta.com', name: { fullName: 'Old Account' }, archived: true },
      { primaryEmail: 'noname@forplaneta.com' },
      { primaryEmail: 'not-an-address' },
      { name: { fullName: 'No email at all' } },
    ],
  };

  it('drops leavers, keeps active people, sorts by name', () => {
    // A suspended account in the picker invites granting a tile to somebody who
    // has left — a stale row of exactly the kind this model exists to avoid.
    expect(parseDirectoryUsers([page])).toEqual([
      { email: 'nils@forplaneta.com', name: 'Nils B' },
      { email: 'noname@forplaneta.com', name: 'noname' },
      { email: 'sara@forplaneta.com', name: 'Sara M' },
    ]);
  });

  it('merges pages and de-duplicates', () => {
    const merged = parseDirectoryUsers([page, page]);
    expect(merged).toHaveLength(3);
  });

  it('returns an empty list for an empty response rather than failing', () => {
    expect(parseDirectoryUsers([{}])).toEqual([]);
    expect(parseDirectoryUsers([])).toEqual([]);
  });
});
