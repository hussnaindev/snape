# snape-media (standalone media proxy Worker)

Proxies video bytes from the upstream CDNs to the browser, **off** the Next.js
Pages app. Running this as a plain Cloudflare Worker (no `@cloudflare/next-on-pages`
adapter) is what stops **Error 1102 a few seconds into playback** — a raw Worker
streams `res.body` natively with constant memory and minimal CPU.

It is the same logic as `app/api/media-proxy/route.ts`. Extraction
(`netlify/functions/extract.mjs`) mints the signed URLs that point here; this
Worker verifies them. See `docs/STREAMING-ARCHITECTURE.md`.

## One-time setup

```bash
cd media-worker
bun install                       # wrangler + workers-types
bunx wrangler login               # if not already logged in

# Set the shared HMAC secret — MUST equal MEDIA_PROXY_SECRET on Netlify:
bunx wrangler secret put MEDIA_PROXY_SECRET

bunx wrangler deploy
```

Deploy prints the URL, e.g. `https://snape-media.<account>.workers.dev`.

## Wire it up

On **Netlify** (the extraction function), set:

```
MEDIA_PROXY_BASE = https://snape-media.<account>.workers.dev
```

`extract.mjs` then mints absolute media URLs at that origin instead of the
relative `/api/media-proxy` path. No Cloudflare Pages env change is needed; the
Pages `/api/media-proxy` route stays as a local-dev fallback (used when
`MEDIA_PROXY_BASE` is unset).

## Verify

```bash
bunx wrangler tail                # live logs
# Play a title; confirm media requests hit *.workers.dev and 1102 is gone.
```

## Keep in sync

`src/sign.ts` must stay **algorithm-identical** to `lib/media-sign.ts` and the
mirrored signing in `netlify/functions/extract.mjs` (same HMAC inputs, same
`MEDIA_PROXY_SECRET`). If you change one, change all three.
