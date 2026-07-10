# Heroflix (Snape) — Claude Code Context

TMDB-powered streaming/discovery app. Deployed to **Cloudflare Pages** (edge) via `@cloudflare/next-on-pages`.

## Stack
- Dev runtime: Bun | Framework: Next.js 15 (App Router, React 19) | Styling: Tailwind CSS v4
- Data: Cloudflare **D1** (SQLite) via **Drizzle ORM** | Auth: custom PBKDF2 + cookie sessions
- Validation: Zod | Lint+format: Biome | Language: TypeScript (strict)
- Playback: `hls.js` | PWA: `@ducanh2912/next-pwa` | Analytics: FullStory
- Deploy target: Cloudflare Pages (Functions run on the **edge** runtime, not Node)

## Layout
```
app/              Pages + API route handlers
  api/            Route handlers (all `export const runtime = 'edge'`)
components/       Shared UI (ui/ for primitives)
lib/              Utilities + typed fetch helpers (tmdb.ts, db.ts, session.ts, crypto.ts, ...)
db/               Drizzle schema.ts + migrations/ (SQL + snapshots)
types/            Shared TS types (incl. cloudflare-env.d.ts)
docs/             Long-form runbooks
middleware.ts     Auth redirect guard for /profile, /settings, /watchlist
wrangler.toml     Cloudflare Pages + D1 binding config
drizzle.config.ts Drizzle Kit config
```

## Data & Auth
- Access the DB with `getDb()` from `@/lib/db` — resolves the D1 binding via `@cloudflare/next-on-pages` request context and returns a Drizzle client. Only works in `runtime = 'edge'` handlers.
- Schema in `db/schema.ts`: `users`, `passwords` (salt:hash), `sessions`, `profiles`, `watchlist`, `watchHistory`, `preferences`, `collections`, `collectionItems`. Most user data keys off `profileId`, not `userId`.
- Auth is custom: PBKDF2 hashing in `lib/crypto.ts`, cookie sessions in `lib/session.ts` (`SESSION_COOKIE = 'session_token'`, 7-day TTL). Call `getSession()` in handlers; return a 401 envelope when null.
- Change schema → `bun run db:generate` (writes a migration) → apply with `db:migrate:local` (dev) / `db:migrate:cf` (prod).

## Conventions
- Strict TS: `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- No `any` (use `unknown` + narrow), no Axios (native `fetch`), no dotenv (Bun/Next read `.env.local`)
- Biome for lint+format; `@/` alias = project root
- API route handlers: add `export const runtime = 'edge'`; return `{ ok: true, data: T }` or `{ ok: false, error: string, code: number }` (with matching HTTP status)
- Validate request bodies with Zod; env vars via `process.env`, declared in `.env.example` (`TMDB_API_KEY`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_FULLSTORY_ORG`)
- Components: named exports, accept `className?: string`, use `cn()` from `@/lib/utils`
- **Committed lockfile is `package-lock.json`** (Cloudflare Pages builds with `npm ci`); `bun.lock` is gitignored. Adding a dep → update `package-lock.json` or the prod deploy breaks.

## Commands
```bash
bun run dev              # http://localhost:3000 (predev clears .next)
bun run build
bun run typecheck        # tsc --noEmit
bun run lint             # biome check .
bun run lint:fix         # biome check --write .
bun run db:generate      # generate Drizzle migration from schema
bun run db:migrate:local # apply migrations to local D1
bun run db:migrate:cf    # apply migrations to remote (prod) D1
bun run pages:build      # build for Cloudflare Pages (next-on-pages)
bun run preview          # wrangler pages dev (local edge preview)
```

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
