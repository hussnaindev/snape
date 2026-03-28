# [App Name] — Claude Code Context

## What This Project Is

<!-- Describe what the app does in 1-2 sentences. -->

## Tech Stack

| Concern       | Tool                              |
| ------------- | --------------------------------- |
| Runtime       | Bun                               |
| Framework     | Next.js 15 (App Router)           |
| Styling       | Tailwind CSS v4                   |
| Validation    | Zod                               |
| Linting       | Biome                             |
| Language      | TypeScript (strict)               |

## Project Layout

```
app/              Next.js App Router pages + API route handlers
  api/            API route handlers (Next.js Route Handlers)
  (routes)/       Route groups — add your page routes here
components/       Shared UI components
  ui/             Primitive/atomic components
lib/              Utility functions and typed fetch helpers
types/            Shared TypeScript types
middleware.ts     Edge middleware (auth, redirects)
```

## Key File Locations

| File                     | Purpose                                        |
| ------------------------ | ---------------------------------------------- |
| `app/api/health/route.ts`| Health-check endpoint                          |
| `lib/api.ts`             | Typed `apiFetch()` wrapper                     |
| `lib/utils.ts`           | `cn()` and other general utilities             |
| `types/index.ts`         | `ApiResponse<T>` and shared types              |
| `middleware.ts`          | Auth checks / redirects                        |

## API Response Envelope

All route handlers return the same shape:

```typescript
// Success
{ ok: true, data: T }

// Error
{ ok: false, error: string, code: number }
```

Use the `ApiResponse<T>` type from `@/types`.

## Code Conventions

- **Strict TypeScript** — `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` on
- **No `any`** — use `unknown` and narrow; Biome enforces this
- **No Axios** — native `fetch` only; `AbortSignal.timeout()` for timeouts
- **No dotenv** — Bun reads `.env.local` natively
- **Biome** for lint + format (not ESLint / Prettier)
- All env vars accessed via `process.env` — declare in `.env.example`
- `@/` path alias maps to the project root

## Running the Project

```bash
bun install          # install dependencies
bun run dev          # start dev server (http://localhost:3000)
bun run build        # production build
bun run typecheck    # type-check
bun run lint         # biome check
bun run lint:fix     # biome check --write (auto-fix)
```

## Adding a New Page

1. Create `app/<route>/page.tsx`
2. Export a default React component
3. Add `export const metadata: Metadata = { title: '...' }` for SEO
4. Use `export const dynamic = 'force-dynamic'` if the page must always SSR

## Adding a New API Route

1. Create `app/api/<resource>/route.ts`
2. Export named functions: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
3. Return `NextResponse.json({ ok: true, data })` or `NextResponse.json({ ok: false, error, code }, { status: code })`
4. Validate request bodies with Zod before processing

## Adding a New Component

1. Create `components/<name>.tsx` (or `components/ui/<name>.tsx` for primitives)
2. Use `cn()` from `@/lib/utils` to merge Tailwind classes
3. Export as a named export, not default
4. Accept `className?: string` prop on wrapper elements

## Environment Variables

- Copy `.env.example` → `.env.local` and fill in values
- Never commit `.env.local`
- `NEXT_PUBLIC_` prefix makes a var available in the browser
- All vars should be documented in `.env.example`

## Biome Gotcha

Biome may suggest `import type { X }` for any import used only in type positions. This is correct for most cases. The exception: if you ever add a class-based DI framework (e.g. NestJS), value imports are required for constructor injection — add a `biome-ignore` comment in that case.

## Hydration Rules — Never Break These

Hydration errors crash the page and are caused by server/client HTML mismatches. Strict rules:

1. **Never use `typeof window !== 'undefined'` inside JSX or render logic** — use `useEffect` + state instead.
2. **Never use `Date.now()`, `Math.random()`, or any non-deterministic value in render** — compute once in `useEffect`.
3. **Never nest block elements inside inline elements** (e.g. `<p><div>` is invalid HTML and causes mismatches).
4. **`'use client'` components are still SSR'd** — all hooks run with their initial state on the server. If `useState(0)` is the initial value, the server renders slot 0. Make sure the server output for initial state is correct and stable.
5. **Semantic wrapper tags must match** — if a server component wraps a client component in `<main>`, the client component must NOT also use `<main>` as its root (duplicate semantic tags). Coordinate tag choices across the boundary.
6. **Never conditionally render different root elements** based on client-only state — the server will always render the initial branch.

**What caused the last incident:** `app/page.tsx` wrapped `<HeroSection>` in `<main>`, and a prior version of `hero-section.tsx` also used `<main>` as its root, creating a duplicate/mismatch when the component was updated.
