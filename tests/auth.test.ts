import { describe, expect, it } from 'vitest';
import { emailAllowed, isAdmin } from '@/lib/config';
import { makeSessionToken, safeNextPath, verifySessionToken } from '@/lib/auth/session';

const SECRET = 'test-secret-not-the-dev-fallback';
const OTHER_SECRET = 'a-different-secret';

describe('emailAllowed — the gate', () => {
  it('admits any address on an allowed domain', () => {
    expect(emailAllowed('nils@forplaneta.com', [], false, ['forplaneta.com'])).toBe(true);
  });

  it('admits an individually listed guest on another domain', () => {
    expect(emailAllowed('guest@example.com', ['guest@example.com'], false, ['forplaneta.com'])).toBe(
      true,
    );
  });

  it('refuses an outside address', () => {
    expect(emailAllowed('someone@gmail.com', [], false, ['forplaneta.com'])).toBe(false);
  });

  it('refuses everybody when nothing is configured and admitOnEmpty is false', () => {
    // This is the production case. A deployment that forgets ALLOWED_DOMAINS
    // must serve nobody, not every Google account on the internet.
    expect(emailAllowed('nils@forplaneta.com', [], false, [])).toBe(false);
  });

  it('admits when nothing is configured and admitOnEmpty is true (dev)', () => {
    expect(emailAllowed('nils@forplaneta.com', [], true, [])).toBe(true);
  });

  it('is case- and whitespace-insensitive', () => {
    expect(emailAllowed('  Nils@ForPlaneta.COM ', [], false, ['forplaneta.com'])).toBe(true);
  });

  it('refuses an address smuggling the allowed domain after a second @', () => {
    // "evil@attacker.com@forplaneta.com" reads as a forplaneta.com address to a
    // naive endsWith. It must not read that way here.
    expect(emailAllowed('evil@attacker.com@forplaneta.com', [], false, ['forplaneta.com'])).toBe(
      false,
    );
  });

  it('refuses a subdomain of an allowed domain', () => {
    expect(emailAllowed('evil@mail.forplaneta.com', [], false, ['forplaneta.com'])).toBe(false);
  });

  it.each(['', 'nils', '@forplaneta.com', 'nils@', 'nils@@forplaneta.com'])(
    'refuses the malformed address %o',
    (value) => {
      expect(emailAllowed(value, [], true, ['forplaneta.com'])).toBe(false);
    },
  );
});

describe('isAdmin', () => {
  it('recognises the configured admin regardless of case', () => {
    expect(isAdmin('Sara@ForPlaneta.com')).toBe(true);
  });

  it('does not treat an ordinary employee as an admin', () => {
    expect(isAdmin('nils@forplaneta.com')).toBe(false);
  });

  it('does not treat an absent address as an admin', () => {
    expect(isAdmin(null)).toBe(false);
    expect(isAdmin('')).toBe(false);
  });
});

describe('session cookie', () => {
  it('round-trips an email', async () => {
    const token = await makeSessionToken('nils@forplaneta.com');
    expect(token).not.toBeNull();
    expect(await verifySessionToken(token, undefined)).toBe('nils@forplaneta.com');
  });

  it('lower-cases the email it stores', async () => {
    const token = await makeSessionToken('Nils@ForPlaneta.com');
    expect(await verifySessionToken(token, undefined)).toBe('nils@forplaneta.com');
  });

  it('rejects a token whose payload was edited', async () => {
    const token = (await makeSessionToken('nils@forplaneta.com'))!;
    const [body, sig] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ email: 'ceo@forplaneta.com', iat: Date.now() }),
      'utf8',
    ).toString('base64url');
    expect(await verifySessionToken(`${forged}.${sig}`)).toBeNull();
    expect(body).not.toBe(forged);
  });

  it('rejects a token signed with a different secret', async () => {
    // Rotating AUTH_COOKIE_SECRET has to invalidate every cookie in the wild;
    // if it did not, rotating it after a leak would achieve nothing.
    const { createHmac } = await import('node:crypto');
    const payload = Buffer.from(
      JSON.stringify({ email: 'nils@forplaneta.com', iat: Date.now() }),
      'utf8',
    ).toString('base64url');
    const sig = createHmac('sha256', OTHER_SECRET).update(payload).digest('hex');
    expect(await verifySessionToken(`${payload}.${sig}`, SECRET)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const { createHmac } = await import('node:crypto');
    const fifteenDaysAgo = Date.now() - 15 * 24 * 60 * 60 * 1000;
    const payload = Buffer.from(
      JSON.stringify({ email: 'nils@forplaneta.com', iat: fifteenDaysAgo }),
      'utf8',
    ).toString('base64url');
    const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
    expect(await verifySessionToken(`${payload}.${sig}`, SECRET)).toBeNull();
  });

  it('rejects a token with no iat at all', async () => {
    const { createHmac } = await import('node:crypto');
    const payload = Buffer.from(
      JSON.stringify({ email: 'nils@forplaneta.com' }),
      'utf8',
    ).toString('base64url');
    const sig = createHmac('sha256', SECRET).update(payload).digest('hex');
    expect(await verifySessionToken(`${payload}.${sig}`, SECRET)).toBeNull();
  });

  it.each([undefined, null, '', 'not-a-token', 'a.b', '.abc', 'abc.', 'abc.zzzz'])(
    'rejects the junk value %o',
    async (value) => {
      expect(await verifySessionToken(value as string | undefined, SECRET)).toBeNull();
    },
  );
});

describe('safeNextPath — open-redirect guard', () => {
  it.each(['/', '/admin', '/admin?tab=apps'])('accepts the same-origin path %o', (value) => {
    expect(safeNextPath(value)).toBe(value);
  });

  it.each([
    '//evil.example',
    '/\\evil.example',
    'https://evil.example',
    'javascript:alert(1)',
    '/ok\nSet-Cookie: x=1',
    'admin',
    '',
    null,
  ])('refuses %o', (value) => {
    expect(safeNextPath(value)).toBeNull();
  });

  it('refuses an absurdly long path', () => {
    expect(safeNextPath('/' + 'a'.repeat(3000))).toBeNull();
  });
});
