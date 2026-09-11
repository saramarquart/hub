# CLAUDE.md — hub

**These instructions override default behavior.** Follow them exactly. When they conflict with generic assumptions, they win. Verify commands against `package.json` before running anything new.

## What it is
Proton-style launcher linking all Planet A internal apps — the company's front door. **Next.js 15, a server app**: Google SSO, a Postgres database, and per-person tile visibility. It used to be a static export on GitHub Pages; it is not any more (see **Deploy**).

## Dev
```bash
npm ci
npm run dev                 # next dev — needs NO config; the dev auth bypass mints a local identity
```
Copy `.env.example` to `.env.local` if you want to exercise the real Google flow locally. With `AUTH_MODE` unset the bypass is on, and it **refuses to work when `NODE_ENV=production`**.

## Build / Test / Lint
```bash
npm run build               # next build
npm run lint                # tsc --noEmit  (same as typecheck — matches paf_cogs; there is no eslint config)
npm run typecheck           # tsc --noEmit
npm test                    # vitest run
```

## Deploy
**Two things serve this app right now, and that is deliberate.**

| Host | Serves | Status |
|---|---|---|
| **Railway** (`paf-hub` / `web`) | `https://web-production-16de.up.railway.app` | the real app: SSO, database, visibility |
| **GitHub Pages** | `hub.planet-a-foods.com` | the **last static export**, frozen, unauthenticated |

`hub.planet-a-foods.com` still points at Pages and still works, because Pages keeps serving the artifact it last built. It will **not** pick up further changes: `output: 'export'` is gone, so there is no `./out` to publish. `.github/workflows/deploy.yml` is therefore `workflow_dispatch` only — leaving it on `push` would paint main red forever and train everyone to ignore CI.

The DNS cutover is Sara's to run. Until she does, ship to Railway and verify there.

### Railway deploy recipe (the one that works)
Deploying from the repo directory has caused an outage before. Export a clean tree **outside** the repo and push that:
```bash
rm -rf /tmp/hub-deploy && mkdir -p /tmp/hub-deploy
git archive HEAD | tar -x -C /tmp/hub-deploy
cd /tmp/hub-deploy
railway link -p paf-hub -e production -s web
railway up --detach
```
Project `262b57e9-3135-43b8-95ee-57ad8a480100`, service `web` `5eded051-f3eb-42f7-90d9-e34056a78867`, environment `production` `a950fded-e298-4e9f-ad29-aaab29044253`.

### How to verify a deploy landed
- `curl https://web-production-16de.up.railway.app/api/health` → `{"ok":true,"sso":true,"database":true}`.
- `curl -o /dev/null -w '%{http_code} %{redirect_url}' https://web-production-16de.up.railway.app/` → **307 to `/signin`**. Anything else means the gate is open; treat it as an incident.
- Sign in with a `@forplaneta.com` account and confirm the tile grid renders.

## Editing the app list
- **Single source of truth for what an app IS: `lib/apps.ts`** — the `apps: AppTile[]` array. Add / remove / reorder by editing that one array and nothing else. Icons live under `public/`.
- Every tile needs a stable **`id`**. Database rows reference it. **Never change an `id` that is already in the database** — rename the `name` instead; a visibility rule keyed on display copy detaches itself silently the day the copy changes.
- **Who SEES a tile is not in this file.** See below.

## Tile visibility
> A tile is visible to everyone by default. A **restricted** tile names who may see it.

Two exception lists in Postgres (`app_restrictions`, `app_restriction_grants`), read by `visibleAppsFor(email)` in `lib/visibility.ts`. An empty table means every tile is visible to everybody, which is what the hub ships as. There is deliberately **no 70 × 10 person-by-tile matrix**: nothing to create when somebody joins, nothing to delete when they leave.

**Hiding a tile is cosmetic, not access control.** Every app the hub links to gates itself; the link still works if you type it, and it is supposed to. Do not write code or copy that implies otherwise. `visibleAppsFor` therefore **fails open** if Postgres is unreachable — a launcher showing an extra tile beats the whole company losing its front door.

There is **no admin UI yet**. `lib/config.ts` has `ADMIN_EMAILS` / `isAdmin()` ready for it.

## Data / DB
- **Postgres on Railway**, via Drizzle (`lib/db/`). It holds the two visibility tables **and nothing else** — no employee list, no PII.
- `lib/db/migrate.ts` is **additive and idempotent** (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`), safe on every boot and safe twice.
- **Migrations run from `npm start`**, i.e. `"start": "npm run db:migrate && next start"`. Railway **ignores `railway.json`'s deploy block** for these services — paf_cogs declared `preDeployCommand` there, it silently never ran, and the app came up healthy against an empty database. `railway.json` here carries build config only, on purpose.
- **`DATABASE_URL` unset is a supported state**: no restrictions, so every tile is visible to everyone. `npm run dev` runs this way.

## Auth
- Google authorization-code flow, copied from paf_cogs (`/auth/google/login`, `/auth/google/callback`, `/auth/signout`). Session is a signed, httpOnly cookie — `base64url(payload).hex(HMAC-SHA256)`, 14-day expiry, re-checked against the allow rule on **every** request.
- The rule is `ALLOWED_DOMAINS=forplaneta.com`: every employee gets the launcher. `ALLOWED_EMAILS` is for guests on other domains.
- **Fails closed.** `middleware.ts` gates everything except `/signin`, `/auth/*`, `/api/health` and static files; `app/page.tsx` resolves its own session as well, because a matcher is one regex away from quietly exempting a route.
- `lib/auth/session.ts` uses **Web Crypto, not `node:crypto`** — middleware runs on the edge runtime, where `createHmac` does not exist. One implementation for both runtimes, deliberately; two would mean two answers to "is this session valid" and the weaker one runs first.

## Secrets / GDPR
- **The repo is public.** Nothing sensitive goes in a file here — not in a fixture, not in `.env.example`, not in a test. Every secret lives in Railway environment variables.
- `AUTH_COOKIE_SECRET` has a dev fallback that **production refuses to use**: a publicly known signing secret makes every session cookie forgeable, and this repo is readable by anyone.
- The database stores email addresses of people granted a restricted tile. That is the only personal data here.

## Gotchas
- **Do not re-add `output: 'export'`.** It would not fail the build; it would drop middleware and the auth routes from the output and publish the signed-in grid to anonymous visitors.
- **The tile grid is the front door.** Its markup and `page.module.css` must not drift — a visual regression here is more expensive than a late feature. The sign-in screen is a CSS module precisely so nothing it does can reach the grid.
- `cookies()` and page `searchParams` are **Promises** in Next 15. `tsc` is what catches a missed `await`, which is why `lint` is `tsc --noEmit`.
- Behind Railway's proxy `req.url` is `http://localhost:PORT`. Build redirect Locations from `appOrigin()` / `PUBLIC_BASE_URL`, or sign-in bounces the browser to its own machine.
- `public/CNAME`, `public/.nojekyll` and `.github/workflows/deploy.yml` are **GitHub Pages leftovers**. Delete all three once DNS points at Railway.
