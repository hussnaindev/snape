# Web — Deployment (Cloudflare Pages)

The web app deploys to **Cloudflare Pages** on the edge runtime via
`@cloudflare/next-on-pages`. It lives in `web/` in the monorepo, so **Pages must
build from that subdirectory**.

## Monorepo root directory (one-time, required)

Because the app moved from repo root into `web/`, set the Pages project's build
base path once in the dashboard:

> **Cloudflare dashboard → Pages → (project) → Settings → Builds & deployments →
> Root directory (advanced) = `web`**

- **Build command:** `npx @cloudflare/next-on-pages` (i.e. `bun run pages:build`)
- **Build output directory:** `.vercel/output/static` (resolved under `web/`)
- All `wrangler.toml` paths (`pages_build_output_dir`, D1 `migrations_dir`) are
  relative and resolve correctly once the root directory is `web`.

CI (`.github/workflows/web.yml`) is path-filtered to `web/**` and runs
typecheck + lint + `pages:build` as the merge gate; Pages' git integration does
the actual deploy on push to `main`.

## Bindings & config (`wrangler.toml`)

| Binding | Value |
|---------|-------|
| D1 database | `binding = "DB"`, `database_name = "snape-db"` |
| compat flags | `nodejs_compat`, `compatibility_date = 2024-09-23` |

## Secrets / environment variables

Set in **Pages → Settings → Environment variables** (declared in `.env.example`):

- `TMDB_API_KEY` — TMDB access
- `NEXT_PUBLIC_APP_URL` — canonical app URL
- `NEXT_PUBLIC_FULLSTORY_ORG` — FullStory analytics org

## Database migrations (D1)

Migrations live in `db/migrations/` (Drizzle). After editing `db/schema.ts`:

```bash
bun run db:generate       # write a new SQL migration
bun run db:migrate:local  # apply to local D1 (dev)
bun run db:migrate:cf     # apply to remote (prod) D1 — run before/with deploy
```

## Lockfile gotcha

The **committed** lockfile is `package-lock.json` (Pages builds with `npm ci`);
`bun.lock` is gitignored. Adding a dependency means updating `package-lock.json`
or the production build breaks.

## Local edge preview

```bash
bun run pages:build   # produce .vercel/output/static
bun run preview       # wrangler pages dev — local edge + D1
```
