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
- **Single source of truth: `lib/apps.ts`** — the `apps: AppTile[]` array. Add / remove / reorder an app by editing that one array (one entry per app) and nothing else. Icons live under `public/`; see the `AppTile` interface for fields (`name`, `description`, `href`, `icon`, `category`, `group`, `featured`, `invertOnDark`, `keywords`, `highlight`).
- Page order: **Your apps** (per-browser: pinned, then highlighted, then most-used; max 4; hidden while empty; never repeats the featured app) → the `featured` hero (paf_note) → **Teams** (`rnd-procurement`, `operations-quality`, `sales-finance`) → **Company tools** (`company` minus the featured app) → **People & Culture** (`people-culture`, last and visually quieter). Labels and order are the `groups` array in the same file.
- `keywords`: lowercase aliases for quick search (⌘K / Ctrl+K / `/`), e.g. `'wiki'` for paf_note. Ranking lives in `lib/search.ts`.
- **Seasonal highlights:** add `{ from: 'YYYY-MM-DD', to: 'YYYY-MM-DD', note: '…' }` to an app's `highlight` array (the People & Culture entries have an empty one and a comment showing where). Dates are inclusive, in the viewer's local time, and checked in the browser, so a window opens and closes without a redeploy.

## Data / DB
- None. Fully static; no database, no secrets, no server.
- Per-browser preferences only, in `localStorage` (`paf-hub-hidden`, `paf-hub-pinned`, `paf-hub-usage`); they never leave the browser. The launcher reads/writes them through `app/storage.ts`, which tolerates blocked storage (the theme toggle keeps its own try/catch).

## Secrets / GDPR
- No secrets. Public repo, public site — do not add anything sensitive.

## Gotchas
- It's a **static export** (`output: 'export'`) → no server-side features (no API routes, no dynamic runtime). Anything requiring a server does not belong here.
- Deploy is via **GitHub Actions to Pages**, unlike the sibling apps that use Railway.
