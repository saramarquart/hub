import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The gate on /admin and on everything it can write.
 *
 * Nobody can sign in to this deployment yet — GOOGLE_CLIENT_ID is unset, and
 * creating the OAuth client is a console action with no CLI. So the thing that
 * would normally be proved by clicking is proved here instead: that a signed-in
 * NON-admin gets nothing, and that a signed-out request gets nothing.
 *
 * This matters more than the usual "the page checks auth" test, because on this
 * route the middleware genuinely does not help. middleware.ts admits every
 * @forplaneta.com account — about seventy people — since that is the hub's
 * access rule. It has never had an opinion about who is an admin.
 */

class Redirected extends Error {
  constructor(public readonly to: string) {
    super(`redirect:${to}`);
  }
}

vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Redirected(to);
  },
}));

const resolveSession = vi.fn();
vi.mock('@/lib/auth/server', () => ({ resolveSession: () => resolveSession() }));

afterEach(() => {
  resolveSession.mockReset();
});

async function gate() {
  return import('@/lib/auth/admin');
}

describe('requireAdmin — the page gate', () => {
  it('lets the admin through', async () => {
    resolveSession.mockResolvedValue({ email: 'sara@forplaneta.com', via: 'sso' });
    const { requireAdmin } = await gate();
    await expect(requireAdmin()).resolves.toMatchObject({ email: 'sara@forplaneta.com' });
  });

  it('sends an anonymous request to sign in, and back here afterwards', async () => {
    resolveSession.mockResolvedValue(null);
    const { requireAdmin } = await gate();
    await expect(requireAdmin()).rejects.toThrow('redirect:/signin?next=%2Fadmin');
  });

  it('sends a signed-in colleague to the launcher, not to a 403', async () => {
    // Every employee passes middleware. This is the check that stops them, and
    // it deliberately does not explain itself: from their side /admin is a URL
    // that does not exist, and a page describing what they may not do is an
    // invitation to try.
    resolveSession.mockResolvedValue({ email: 'nils@forplaneta.com', via: 'sso' });
    const { requireAdmin } = await gate();
    await expect(requireAdmin()).rejects.toThrow('redirect:/');
  });

  it('is case-insensitive about the admin address', async () => {
    resolveSession.mockResolvedValue({ email: 'SARA@ForPlaneta.com', via: 'sso' });
    const { requireAdmin } = await gate();
    await expect(requireAdmin()).resolves.toBeTruthy();
  });
});

describe('adminSessionOrNull — the mutation gate', () => {
  it('returns null rather than redirecting', async () => {
    // A server action that redirects on refusal is indistinguishable, to the
    // caller, from one that succeeded and then navigated.
    resolveSession.mockResolvedValue({ email: 'nils@forplaneta.com', via: 'sso' });
    const { adminSessionOrNull } = await gate();
    await expect(adminSessionOrNull()).resolves.toBeNull();

    resolveSession.mockResolvedValue(null);
    await expect(adminSessionOrNull()).resolves.toBeNull();
  });

  it('returns the session for an admin', async () => {
    resolveSession.mockResolvedValue({ email: 'sara@forplaneta.com', via: 'sso' });
    const { adminSessionOrNull } = await gate();
    await expect(adminSessionOrNull()).resolves.toMatchObject({ email: 'sara@forplaneta.com' });
  });
});

/**
 * A structural test, and yes it reads the source rather than calling anything.
 *
 * The risk it covers is specific and is not a logic bug: somebody adds a fifth
 * server action next year, copies the body of an existing one, and leaves the
 * guard out. Nothing fails. The endpoint ships, addressable by its action id,
 * to every signed-in employee. There is no unit test that would notice, because
 * the new function is exactly as correct as it was written to be — so the
 * assertion has to be about the file, not about a function.
 */
describe('every exported server action is gated', () => {
  const source = readFileSync(
    fileURLToPath(new URL('../app/admin/actions.ts', import.meta.url)),
    'utf-8',
  );

  const exported = [...source.matchAll(/export async function (\w+)\(/g)].map((m) => m[1]);

  it('finds the actions at all (so this test cannot pass by finding nothing)', () => {
    expect(exported).toEqual(
      expect.arrayContaining([
        'restrictApp',
        'unrestrictApp',
        'grantApp',
        'revokeApp',
        'refreshDirectory',
      ]),
    );
  });

  it('has each of them reach the admin check before doing anything', () => {
    for (const name of exported) {
      const body = source.slice(source.indexOf(`export async function ${name}(`));
      const end = body.indexOf('\nexport async function ', 1);
      const fn = end === -1 ? body : body.slice(0, end);
      // Either directly, or via guard(), which is the shared preamble that does
      // the same check plus the app-id check.
      expect(
        /adminSessionOrNull\(\)|await guard\(/.test(fn),
        `${name} does not check that the caller is an admin`,
      ).toBe(true);
    }
  });

  it('has every write path go through guard(), which also validates the app id', () => {
    for (const name of ['restrictApp', 'unrestrictApp', 'grantApp', 'revokeApp']) {
      const body = source.slice(source.indexOf(`export async function ${name}(`));
      const end = body.indexOf('\nexport async function ', 1);
      const fn = end === -1 ? body : body.slice(0, end);
      expect(fn.includes('await guard('), `${name} does not validate its appId`).toBe(true);
    }
  });
});
