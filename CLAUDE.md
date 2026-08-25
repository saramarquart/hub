# CLAUDE.md — hub

**These instructions override default behavior.** Follow them exactly. When they conflict with generic assumptions, they win. Verify commands against `package.json` before running anything new.

## What it is
Static Proton-style launcher linking all Planet A internal apps. Next.js 14 exported as a **static site** (`next.config.mjs` has `output: 'export'`). Deployed to **GitHub Pages**, live at hub.planet-a-foods.com.

## Dev
```bash
npm ci
npm run dev                 # next dev
```

## Build / Test / Lint
```bash
npm run build               # next build → static export into out/
npm run lint                # next lint
npm run typecheck           # tsc --noEmit
```

## Deploy
**Mechanism: automatic — GitHub Actions builds and publishes to GitHub Pages on push** (`.github/workflows/deploy.yml`). No manual step, no Railway.

### How to verify a deploy landed
- Check the `deploy.yml` Actions run went green.
- Load hub.planet-a-foods.com and confirm the app list/change is live.

## Editing the app list
- **Single source of truth: `lib/apps.ts`** — the `apps: AppTile[]` array. Add / remove / reorder an app by editing that one array (one entry per app) and nothing else. Icons live under `public/`; see the `AppTile` interface for fields (`name`, `description`, `href`, `icon`, `category`, `invertOnDark`).

## Data / DB
- None. Fully static; no database, no secrets, no server.

## Secrets / GDPR
- No secrets. Public repo, public site — do not add anything sensitive.

## Gotchas
- It's a **static export** (`output: 'export'`) → no server-side features (no API routes, no dynamic runtime). Anything requiring a server does not belong here.
- Deploy is via **GitHub Actions to Pages**, unlike the sibling apps that use Railway.
