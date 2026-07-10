# Snape (Heroflix)

Ad-free movie/TV streaming. This is a **monorepo** holding three standalone apps,
each with its own toolchain, config, docs, and CI workflow. They share a product
and a streaming source but **not** a build — you can work on any one in isolation.

| App | Path | Stack | Deploy |
|-----|------|-------|--------|
| **Web** | [`web/`](web/) | Next.js 15 (App Router) PWA · Tailwind v4 · Drizzle → Cloudflare D1 · custom PBKDF2 auth | Cloudflare Pages |
| **Mobile** | [`mobile/`](mobile/) | Kotlin · Jetpack Compose · Media3 · fully client-side | Android APK (GitHub Actions) |
| **Desktop** | [`desktop/`](desktop/) | Electron · Shaka Player | macOS universal DMG (electron-builder) |

Ads are structurally impossible in every app: none embed a third-party
iframe/script. Each extracts real stream URLs and plays them in a first-party player.

## Working in this repo

Each app is self-contained. `cd` into its folder and use its own tooling:

```bash
cd web      && bun install && bun run dev     # Next.js dev server
cd mobile   && ./gradlew assembleDebug        # Android build
cd desktop  && npm install && npm start       # Electron app
```

Per-app guidance for Claude lives in each folder's `CLAUDE.md`
([web](web/CLAUDE.md) · [mobile](mobile/CLAUDE.md) · [desktop](desktop/CLAUDE.md)).
Per-app deploy runbooks live in each folder's `docs/DEPLOYMENT.md`.

## CI

Workflows are path-filtered — a change under `web/` only builds web, etc.:
`.github/workflows/web.yml`, `mobile.yml`, `desktop.yml`.
