# Heroflix — Claude Code Context

## Stack
- Runtime: Bun | Framework: Next.js 15 (App Router) | Styling: Tailwind CSS v4
- Validation: Zod | Linting: Biome | Language: TypeScript (strict)

## Layout
```
app/              Pages + API route handlers
  api/            Route handlers
components/       Shared UI (ui/ for primitives)
lib/              Utilities + typed fetch helpers
types/            Shared TS types
middleware.ts     Auth / redirects
```

## Conventions
- Strict TS: `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- No `any` (use `unknown` + narrow), no Axios (native `fetch`), no dotenv (Bun reads `.env.local`)
- Biome for lint+format; `@/` alias = project root
- All route handlers return `{ ok: true, data: T }` or `{ ok: false, error: string, code: number }`
- Validate request bodies with Zod; env vars via `process.env`, declared in `.env.example`
- Components: named exports, accept `className?: string`, use `cn()` from `@/lib/utils`

## Commands
```bash
bun run dev        # http://localhost:3000
bun run build
bun run typecheck
bun run lint
bun run lint:fix
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
9. **Never give a Client Component a root wrapper div whose className also appears on its Server Component parent.** The RSC payload serializes Server Component elements; Turbopack incremental compilation can desync them, causing React to match the RSC div against the wrong DOM node. Fix: own the structural container in the Server Component; have the Client Component return a `<>fragment</>`.

**Incidents:**
- `app/page.tsx` had `<main>` wrapping `<HeroSection>` + `hero-section.tsx` also used `<main>` → duplicate semantic tags.
- `app/page.tsx` `<main>` wrapper → Turbopack hot-reload desync → replaced with `<div>`.
- `hero-section.tsx` `style={{ opacity: fading ? 0 : 1 }}` → SSR string/number mismatch → replaced with `opacity-0`/`opacity-100`.
- `hero-section.tsx` had `<div className="relative h-[40vh]...">` as root; `page.tsx` wrapper was a plain `<div>`. Turbopack desynced RSC payload, placing the class on the wrong div persistently. Fixed: moved container div to `page.tsx`; `HeroSection` returns a fragment.
