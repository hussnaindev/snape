# [App Name]

> Short description of what this app does.

## Stack

- **Runtime** — [Bun](https://bun.sh)
- **Framework** — [Next.js 15](https://nextjs.org) (App Router)
- **Styling** — [Tailwind CSS v4](https://tailwindcss.com)
- **Validation** — [Zod](https://zod.dev)
- **Linting** — [Biome](https://biomejs.dev)
- **Language** — TypeScript (strict)

## Getting Started

```bash
# 1. Install dependencies
bun install

# 2. Set up environment
cp .env.example .env.local
# Edit .env.local and fill in your values

# 3. Start dev server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Commands

| Command             | Description                         |
| ------------------- | ----------------------------------- |
| `bun run dev`       | Start dev server with Turbopack     |
| `bun run build`     | Production build                    |
| `bun run start`     | Start production server             |
| `bun run typecheck` | Type-check without emitting         |
| `bun run lint`      | Lint with Biome                     |
| `bun run lint:fix`  | Lint + auto-fix with Biome          |
| `bun run format`    | Format all files with Biome         |

## Project Structure

```
app/                    Pages and API routes (Next.js App Router)
  api/                  Route handlers
    health/route.ts     Health check — GET /api/health
  layout.tsx            Root layout
  page.tsx              Home page
components/             Shared React components
  ui/                   Primitive/atomic components
lib/
  api.ts                Typed fetch wrapper (apiFetch)
  utils.ts              cn(), formatDate(), clamp()
types/
  index.ts              ApiResponse<T> and shared types
middleware.ts           Edge middleware (auth, redirects)
```

## API Conventions

All route handlers return a consistent envelope:

```typescript
// Success
{ ok: true, data: T }

// Error
{ ok: false, error: string, code: number }
```

Use `apiFetch<T>(path)` from `@/lib/api` to call your own routes with this shape automatically typed.

## Adding Things

### New page
```
app/<route>/page.tsx   — export default component
```

### New API route
```
app/api/<resource>/route.ts   — export GET, POST, etc.
```

### New component
```
components/<name>.tsx   — named export, accepts className prop, use cn() for class merging
```

## Recommended Additions

These aren't included to keep the template minimal, but are common next steps:

- **UI components** — [shadcn/ui](https://ui.shadcn.com) (built on Radix + Tailwind)
- **Auth** — [Auth.js](https://authjs.dev) or [Clerk](https://clerk.com)
- **Database ORM** — [Prisma](https://prisma.io) or [Drizzle](https://orm.drizzle.team)
- **Testing** — [Vitest](https://vitest.dev) + [Testing Library](https://testing-library.com)
- **State management** — [Zustand](https://zustand-demo.pmnd.rs) or React Context
- **Data fetching** — [TanStack Query](https://tanstack.com/query)

## Environment Variables

Copy `.env.example` to `.env.local`. See `.env.example` for all available vars.

> Never commit `.env.local` — it's in `.gitignore`.
