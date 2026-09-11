# paf_hub

The launcher page for **Planet A Foods** internal web apps — a grid of tiles that
forward to each app. Sign in with your Planet A Google account and you get the
tools you have access to.

Live at `hub.planet-a-foods.com`. **While the DNS cutover is pending** that
hostname is still served by GitHub Pages from the last static build, and the real
app runs on Railway at `https://web-production-16de.up.railway.app`. See
[CLAUDE.md](./CLAUDE.md) for the split and the cutover steps.

## Stack

- Next.js 15 (App Router) + TypeScript. A **server** app — not a static export.
- Google SSO (authorization-code flow), a signed httpOnly session cookie.
- Postgres via Drizzle, for tile visibility.
- Plain CSS / CSS Modules. Plus Jakarta Sans via `next/font` (self-hosted, no external CDN).
- Dark + light mode (sun/moon toggle, upper-right).

## Adding or removing an app

The app list is the single source of truth in [`lib/apps.ts`](./lib/apps.ts).
Add, remove, or reorder an app by editing that one array — nothing else changes.

```ts
{
  id: 'my_app',                // stable; the database references it. Never change it.
  name: 'My App',
  description: 'What it does.',
  href: 'https://myapp.planet-a-foods.com',
  icon: '/icons/my-app.svg',   // a file in public/icons/
  category: 'internal',        // 'internal' | 'external' — drives the two groups
  invertOnDark: true,          // optional: invert a dark/monochrome logo in dark mode
}
```

## Who sees which tile

**A tile is visible to everyone by default. A restricted tile names who may see it.**

Restrictions live in Postgres as two short exception lists, not as a
person-by-tile matrix — see `lib/visibility.ts`. With an empty database every
tile is visible to everybody.

Hiding a tile is **cosmetic**. Every app behind a tile gates itself; a hidden
tile is a link the launcher does not draw, not a door that is locked.

## Develop

```bash
npm install
npm run dev        # local dev server — no config needed, the dev auth bypass mints an identity
npm run typecheck  # tsc --noEmit
npm test           # vitest
npm run build      # next build
```

Copy `.env.example` to `.env.local` to exercise the real Google flow locally.
**No secret ever goes in this repo** — it is public, and the real values live in
Railway's environment variables.

## CI & git hooks

CI runs on every pull request and on push to `main`
(`.github/workflows/ci.yml`): `npm ci && typecheck && test && build`. It runs
with **no environment at all**, on purpose — nothing may throw at import time
when `AUTH_COOKIE_SECRET` or `DATABASE_URL` is missing.

Optional local pre-commit hook (dependency-free, no husky) — enable once per clone:

```bash
git config core.hooksPath .githooks
```

It runs `npm run typecheck` on commits that touch TS/JS. Skip with `git commit --no-verify`.
