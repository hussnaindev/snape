# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Snape (aka Heroflix) is an ad-free movie/TV streaming app. The web app is a Next.js
15 PWA on Cloudflare Pages; a separate native Android app lives in `android-native/`.
Both stream by extracting real stream URLs from **MovieBox** and playing them in a
first-party player — no third-party iframe/script, so ads are structurally impossible.

## Stack
- Runtime: Bun | Framework: Next.js 15 (App Router) | Styling: Tailwind CSS v4
- Validation: Zod | Linting: Biome | Language: TypeScript (strict)
- DB: Drizzle ORM → Cloudflare D1 (prod) / `bun:sqlite` (dev) | Auth: custom PBKDF2 sessions

## Commands
```bash
bun run dev            # dev server (localhost:3000) + local extract server together — see scripts/dev.mjs
bun run build
bun run typecheck      # tsc --noEmit
bun run lint           # biome check .
bun run lint:fix       # biome check --write .
bun test app/api/search/autocomplete/route.test.ts   # run a single test (Bun's runner)
bun run db:generate    # regenerate SQL migrations after editing db/schema.ts
bun run db:migrate:local   # apply migrations to local D1
bun run db:migrate:cf      # apply migrations to remote Cloudflare D1
```
Tests are `*.test.ts` / `*.test.mjs` colocated next to source, run with Bun's test runner.

## Conventions
- Strict TS: `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- No `any` (use `unknown` + narrow), no Axios (native `fetch`), no dotenv (Bun reads `.env.local`)
- Biome for lint+format; `@/` alias = project root
- All route handlers return `{ ok: true, data: T }` or `{ ok: false, error: string, code: number }`
- Validate request bodies with Zod; env vars via `process.env`, declared in `.env.example`
- Components: named exports, accept `className?: string`, use `cn()` from `@/lib/utils`

## Streaming pipeline — the core architecture

Read `docs/STREAMING-ARCHITECTURE.md` and `docs/MOVIEBOX.md` before touching anything
under `app/api/stream`, `app/api/media-proxy`, `lib/media-sign.ts`,
`components/video-player.tsx`, or `netlify/`.

The pipeline is split across **two hosts** because of two hard constraints:
MovieBox blocks datacenter IPs, and Cloudflare Workers `fetch` can't use an HTTP proxy.

```
Browser (app on Cloudflare Pages)
 ├─ GET /api/stream/{type}/{id}   (CF edge, thin delegator)
 │    └─► Netlify Function (AWS Lambda)  netlify/functions/extract.mjs
 │          └─ resolves MovieBox title + stream URLs THROUGH a residential
 │             proxy (PROXY_LIST), returns HMAC-signed /api/media-proxy URLs
 └─ GET /api/media-proxy?u=&h=&s= (CF edge)
      └─ verifies HMAC, streams video from MovieBox CDN with required
         Referer/Origin, forwards Range, rewrites HLS manifests
```

Why split: extraction is tiny JSON (cheap to route through a paid proxy); video is
huge and stays on Cloudflare where egress is free. **Never route video bandwidth
through Netlify/Vercel** (metered).

Critical invariants:
- `lib/media-sign.ts` (CF) and the signing code duplicated inside `extract.mjs`
  (Netlify) MUST produce byte-identical HMAC output. Both key off `MEDIA_PROXY_SECRET`,
  which MUST be the same value on both hosts or every media request 403s.
- Netlify deploys **only** the extract function, not the Next app (see `netlify.toml`,
  `NETLIFY_NEXT_PLUGIN_SKIP=true`).
- MovieBox search uses the mobile BFF first (unfiltered) then falls back to web
  (DMCA-delists titles). `fetchMoviebox` returns a `debug` object surfaced in the
  extract response — always read `debug.stage` first when a title fails.
- Dev replaces Netlify with a local Node extract server (`scripts/dev-extract-server.mjs`,
  port 8787); it needs `PROXY_LIST` in `.env.local` or MovieBox 403s.

## Data / auth layer
- `lib/db.ts` returns a Drizzle client over the CF D1 binding (`env.DB`); schema in
  `db/schema.ts`. After editing the schema, `db:generate` then apply migrations.
- Custom auth (no library): `lib/crypto.ts` (PBKDF2), `lib/session.ts` (7-day session
  cookie `session_token`), `middleware.ts` for redirects. `app/api/auth/*` handlers.

## Android apps
- `android-native/` — the real app: Kotlin + Jetpack Compose + Media3, fully
  client-side. Talks straight to the MovieBox mobile BFF from the phone's residential
  IP (no proxy, no CF/Netlify). Has its own README with performance rules — notably
  the home feed is `Column + verticalScroll`, **not** `LazyColumn` (virtualization
  re-composes heavy sections during fling and causes jank). Built via GitHub Actions
  (`.github/workflows/android.yml`, `assembleRelease`). MovieBox HMAC key rotates
  server-side — update `SECRET_KEY` in `data/MovieBoxSign.kt` if search breaks.
- `android/` — deprecated Capacitor web-wrapper spike; ignore unless explicitly asked.

## Deployment gotchas
- The repo has **both** `package-lock.json` (Cloudflare Pages runs `npm ci`) and
  `bun.lock`. Adding a dependency means updating BOTH or the prod deploy fails.
- CF Pages build: `bun run pages:build` (`@cloudflare/next-on-pages`), output in
  `.vercel/output/static`; D1 binding + secrets configured in `wrangler.toml` / CF dashboard.

## Hydration Rules — Never Break These

1. No `typeof window !== 'undefined'` in JSX — use `useEffect` + state.
2. No `Date.now()` / `Math.random()` in render — compute in `useEffect`.
3. No block elements inside inline elements (`<p><div>` = invalid HTML).
4. `'use client'` components ARE SSR'd — initial hook state must produce stable, valid HTML.
5. **Never use `<main>` in `app/page.tsx` or any page file.** Use `<div>` instead. Semantic landmark elements (`<main>`, `<article>`, etc.) inside Next.js page files cause recurring hydration mismatches during Turbopack hot-reload because the server HTML and client reconciliation diverge.
6. Never conditionally render different root element types based on client-only state.
7. Coordinate wrapper tags across server/client boundaries — no duplicated semantic elements.
8. No numeric values in inline `style` props driven by state (e.g. `style={{ opacity: x }}`). React SSR serializes numbers to strings; on hydration the server DOM has `"1"` (string) but the client vdom has `1` (number) → mismatch. Use Tailwind classes instead (`opacity-0` / `opacity-100`).
9. **Never wrap a Client Component in a structural container div inside a Server Component page file.** Turbopack desyncs the RSC payload for any `<div>` that directly wraps a Client Component in a page file, regardless of whether classNames overlap. Fix: Client Component owns its own outermost container div entirely; the Server Component page renders `<ClientComponent />` with no wrapper.

**Incidents:**
- `app/page.tsx` had `<main>` wrapping `<HeroSection>` + `hero-section.tsx` also used `<main>` → duplicate semantic tags.
- `app/page.tsx` `<main>` wrapper → Turbopack hot-reload desync → replaced with `<div>`.
- `hero-section.tsx` `style={{ opacity: fading ? 0 : 1 }}` → SSR string/number mismatch → replaced with `opacity-0`/`opacity-100`.
- `hero-section.tsx` had `<div className="relative h-[40vh]...">` as root; `page.tsx` wrapper was a plain `<div>`. Turbopack desynced RSC payload, placing the class on the wrong div persistently. Attempted fix: moved container div to `page.tsx`; `HeroSection` returns a fragment — desync persisted.
- Definitive fix: removed wrapper div from `page.tsx` entirely; `HeroSection` owns its `relative h-[40vh]...` container as its root element.
