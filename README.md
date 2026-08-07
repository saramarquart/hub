# paf_hub

A simple, premium launcher page for **Planet A Foods** internal web apps — a clean
grid of tiles that forward to each app. No authentication, no backend: a fully
static site hosted on **GitHub Pages** at `hub.planet-a-foods.com`.

## Stack

- Next.js 14 (App Router) + TypeScript, configured for **static export**
  (`output: 'export'`).
- Plain CSS / CSS Modules. Inter via `next/font` (self-hosted, no external CDN).
- Light mode only.

## Adding or removing an app

The app list is the single source of truth in [`lib/apps.ts`](./lib/apps.ts).
Add, remove, or reorder an app by editing that one array — nothing else changes.

```ts
{
  name: 'My App',
  description: 'What it does.',
  href: 'https://myapp.planet-a-foods.com',
  accent: '#6B3FE0',
  icon: MyIcon(), // add a glyph in lib/icons.tsx
}
```

## Develop

```bash
npm install
npm run dev        # local dev server
npm run typecheck  # tsc --noEmit
npm run build      # static export → ./out
```

## Deploy

Pushing to `main` triggers `.github/workflows/deploy.yml`, which builds the static
export and publishes `./out` to GitHub Pages. The custom domain is configured via
`public/CNAME` (`hub.planet-a-foods.com`); `public/.nojekyll` ensures the `_next/`
assets are served.

> The operator enables Pages ("GitHub Actions" source) and DNS after the first push.
