# Streaming Architecture (Ad-Free Extraction Player)

> Canonical doc for how movie/TV playback works in this app. Read this before
> touching anything under `app/api/stream`, `app/api/media-proxy`,
> `components/video-player.tsx`, `lib/media-sign.ts`,
> `netlify/functions/extract.mjs`, or `netlify/lib/moviebox.mjs`.

---

## TL;DR

We **extract real stream URLs** from **MovieBox** and play them in our **own**
`hls.js`/native player. Nothing from any third-party player/script loads, so
**ads are structurally impossible**. MovieBox is the **only** source — there is
no Peachify/Xpass/iframe fallback anymore (see "History" below).

The catch: MovieBox's BFF/CDN **block datacenter IPs** (Cloudflare *and* AWS),
and Cloudflare Workers can't route `fetch` through an HTTP proxy. So the pipeline
is split across two hosts:

```
Browser (app on Cloudflare)
  │
  ├─ GET /api/stream/{type}/{id}            (Cloudflare, edge)
  │     └─ delegates to ─────────────►  Netlify Function  (AWS Lambda)
  │                                       └─ resolves the MovieBox title +
  │                                          stream URLs THROUGH a residential/
  │                                          Webshare HTTP proxy (bypasses the
  │                                          datacenter IP block)
  │                                       └─ returns HMAC-signed /api/media-proxy URLs
  │
  └─ GET /api/media-proxy?u=…&h=…&s=…       (Cloudflare, edge)
        └─ verifies HMAC signature
        └─ streams the video from MovieBox's CDN with the CDN's required
           Referer/Origin, forwarding Range, rewriting HLS manifests.
           Free Cloudflare egress.
```

Why this split: extraction is tiny (KB of JSON) so it's cheap to route through a
paid/residential proxy; video is huge (TBs) so it stays on Cloudflare where
**egress is free**. Never put video bandwidth on Netlify/Vercel (metered,
~$55/100GB).

---

## Components

| File | Runtime | Role |
|---|---|---|
| `netlify/lib/moviebox.mjs` | Netlify (AWS, Node) | Resolves a TMDB id → MovieBox subject (web + signed mobile BFF), then fetches the play/captions payload. Routes through the proxy pool. Returns raw `{ sources, subtitles, debug }`. |
| `netlify/functions/extract.mjs` | Netlify (AWS, Node) | Thin wrapper around `fetchMoviebox`: signs every source/subtitle URL for the media proxy and returns the JSON. Self-contained (no `@/` imports). |
| `app/api/stream/[type]/[id]/route.ts` | Cloudflare (edge) | Thin delegator → calls the Netlify function (`NETLIFY_EXTRACT_URL`) and returns its JSON. |
| `app/api/media-proxy/route.ts` | Cloudflare (edge) | Verifies the HMAC signature, then streams the CDN media same-origin (Range support, HLS manifest rewriting, CORS). |
| `lib/media-sign.ts` | Cloudflare (edge) | HMAC-SHA256 sign/verify for media-proxy URLs. Must stay byte-identical to the signing code duplicated inside `extract.mjs`. |
| `components/video-player.tsx` | Client | Fetches `/api/stream`, plays mp4 (range-seekable) first with HLS fallback, auto-advances on source failure, renders subtitle tracks. Exports `prefetchStream` to warm the cache from detail pages. |

Players are wired into: `app/movie/[id]/movie-detail-hero.tsx`,
`app/series/[id]/series-detail-hero.tsx`, `app/movie/[id]/watch/page.tsx`,
`app/series/[id]/watch/page.tsx`, `app/collection/[id]/collection-detail-hero.tsx`.

> For the MovieBox source itself — search/match/play, the signed mobile BFF, and
> failure modes — see **`docs/MOVIEBOX.md`**.

---

## Instant playback (prefetch + cache)

`/api/stream` resolves MovieBox only, so a cold request returns in a few seconds
rather than waiting on multiple sequential providers. On top of that:

- Detail/series pages call `prefetchStream(...)` on mount, warming an in-memory
  cache keyed by `type:id[:season:episode]`.
- When the user clicks **Watch** (or resumes via Continue Watching), the player's
  `loadStreamData` returns the cached response synchronously if present, so the
  `<video>` source attaches immediately.
- In-flight requests are de-duplicated (`streamInflight`), so prefetch + Watch
  never fire two extractions for the same title.

Caching is disabled in dev (`IS_DEV`) so source changes are always re-fetched.

---

## Media proxy (`/api/media-proxy`)

- Input: `?u=<absolute CDN url>&h=<base64 headers>&s=<hmac>`.
- **Signature check first** (`verifyMediaUrl`). HMAC-SHA256 over `${u}\n${h}`.
  This replaces a host allowlist — we forward to *any* host, but only URLs we
  minted. Rejects open-proxy abuse (`evil.com` → 403).
- Sends the CDN's required `Referer`/`Origin`/`User-Agent` (decoded from `h`),
  forwards the browser's `Range` header → 206 seeking.
- If the response is an HLS manifest (`.m3u8` / `mpegurl`), it **rewrites every
  child URI** (segments, keys, sub-playlists, `EXT-X-MAP`) back through the
  proxy, re-signed and carrying the same headers.
- Streams the body through (`res.body`) for video/segments — Cloudflare egress
  is free, so even 20 TB/mo of video costs ~$0 in bandwidth (just Worker
  requests). ⚠️ See "Cloudflare video ToS" caveat below.

---

## URL signing (`lib/media-sign.ts` ⇄ `extract.mjs`)

Two implementations that **must produce identical output**:
- `encodeHeaders`: pick `referer`/`origin`/`user-agent` (in that order),
  `btoa(JSON.stringify(picked))`, or `''` if none. Order matters (it's HMAC'd).
- Signature: hex HMAC-SHA256 over `` `${url}\n${headersBlob}` ``.
- Signed path: `/api/media-proxy?u=<enc(url)>[&h=<enc(blob)>]&s=<hex>`.

Both sides key the HMAC with **`MEDIA_PROXY_SECRET`** — it MUST be the same value
on Cloudflare and Netlify or every media request 403s. Cross-verified in dev:
Netlify-signed URLs verify under CF's `verifyMediaUrl`.

---

## Infrastructure & environment variables

### Netlify (extraction)
- Deploys only `netlify/functions/extract.mjs` + `netlify/lib/moviebox.mjs`
  (see `netlify.toml`; `NETLIFY_NEXT_PLUGIN_SKIP=true` stops Netlify
  auto-building the Next app).
- Function URL: `https://<site>.netlify.app/.netlify/functions/extract`
- Env vars:
  - `PROXY_LIST` — comma/newline-separated `host:port:user:pass` entries
    (Webshare proxies). A random one is picked per request.
  - `MEDIA_PROXY_SECRET` — shared secret (same as Cloudflare).
  - `TMDB_API_KEY` — for MovieBox ↔ TMDB title matching.
  - `MOVIEBOX_*` — optional signed-mobile-BFF / guest-session overrides
    (see `.env.example` and `docs/MOVIEBOX.md`).

### Cloudflare Pages (the app + media proxy)
- Env vars:
  - `NETLIFY_EXTRACT_URL` — the Netlify function URL above.
  - `MEDIA_PROXY_SECRET` — same value as Netlify.

### Proxy
Datacenter IPs are blocked by MovieBox's backends, so the proxy must be
**residential** (or at least an ISP range they haven't blocked). Webshare's
authenticated proxies worked; free public proxy lists do **not** (datacenter
and/or dead). Extraction traffic is tiny (~few KB/play, cached 5 min) so proxy
bandwidth/cost is negligible.

---

## Why it's built this way (key constraints discovered)

1. **MovieBox blocks datacenter IPs.** Confirmed 403 from both CF Pages and
   Netlify/AWS egress. Only a residential/clean IP gets 200. → extraction needs
   a residential proxy.
2. **Cloudflare Workers `fetch` can't use an HTTP proxy.** No `undici`/proxy
   support in that runtime. → the proxied call must run on Netlify (Node), not CF.
3. **Media bandwidth must stay on Cloudflare** (free egress). Netlify/Vercel
   egress is metered and would cost thousands at scale.
4. **CDNs reject our Origin/Referer** → media must be proxied server-side (we set
   the CDN's expected headers); it can't be fetched directly by the browser.
5. **mp4 is preferred over HLS**: single predictable host and byte-range seeking.

---

## Maintenance / when it breaks

Symptoms → likely cause → fix:

- **A title shows "Coming Soon" (no sources)** → MovieBox has no confident match
  for that TMDB id, or the title is delisted on the web index. Hit the Netlify
  function directly: `…/extract?type=movie&id=1022789` and read `debug.moviebox`
  for the stage (`no-match`, `no-streams`, `no-proxy`, …). Mobile-BFF matching
  and delisting are documented in `docs/MOVIEBOX.md`.
- **All titles fail** → the proxy is dead/blocked (`debug.moviebox.stage` =
  `no-proxy`, or upstream 403s) → swap `PROXY_LIST` on Netlify and redeploy. No
  code change needed.
- **Media 403 "Bad signature"** → `MEDIA_PROXY_SECRET` mismatch between Netlify
  and Cloudflare, or the two signing implementations drifted.
- **Media 502 / stalls** → the CDN token expired or that CDN rate-limited the
  egress IP. The player auto-advances to the next available source.

---

## Cloudflare video ToS caveat

Proxying large volumes of third-party video through Cloudflare Workers can run
afoul of Cloudflare's Service-Specific Terms (§2.8) and risks being flagged at
scale. Egress is free, so it's cheap — but if Cloudflare pushes back, move
**only the media proxy** to a flat-rate-bandwidth host (e.g. a Hetzner VPS,
~20 TB included for a few €/mo). Extraction stays on Netlify either way.

---

## History (what we removed)

1. **Direct iframe** to `peachify.top/embed/...` showed ads we couldn't strip
   cross-origin, so we pivoted to URL extraction.
2. **Peachify backend extraction** (eat-peach.sbs providers Iron/Spider/Wolf/
   Multi/Dark, AES-GCM decryption, proxy-layer unwrapping) and the **Xpass**
   aggregator fallback were used as additional sources. They were slow (queried
   sequentially behind proxies) and brittle (Peachify rotated its AES key /
   provider list, needing a refresh script). Removed in favour of MovieBox-only.
3. **Current:** MovieBox is the sole source — fast to resolve, talks directly to
   MovieBox's own backends (web + signed mobile BFF), no third-party player, no
   ads. The only remaining dependency is the residential-proxy hop on Netlify.
