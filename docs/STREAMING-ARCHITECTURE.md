# Streaming Architecture (Ad-Free Extraction Player)

> Canonical doc for how movie/TV playback works in this app. Read this before
> touching anything under `app/api/stream`, `app/api/media-proxy`,
> `components/peachify-player.tsx`, `lib/media-sign.ts`, or
> `netlify/functions/extract.mjs`.
>
> `docs/PEACHIFY.md` is **legacy** — it documents the old `peachify.top` iframe
> embed (params/postMessage). We no longer use the iframe. See "History" below.

---

## TL;DR

We do **not** embed Peachify's player anymore (it injected ads we couldn't
remove cross-origin). Instead we **extract the real stream URLs** from
Peachify's backend and play them in our **own** `hls.js`/native player. Nothing
from Peachify's player/scripts loads, so **ads are structurally impossible**.

The catch: Peachify's source API (`*.eat-peach.sbs`) **blocks datacenter IPs**
(Cloudflare *and* AWS), and Cloudflare Workers can't route `fetch` through an
HTTP proxy. So the pipeline is split across two hosts:

```
Browser (app on Cloudflare)
  │
  ├─ GET /api/stream/{type}/{id}            (Cloudflare, edge)
  │     └─ delegates to ─────────────►  Netlify Function  (AWS Lambda)
  │                                       └─ fetches eat-peach.sbs THROUGH a
  │                                          residential/Webshare HTTP proxy
  │                                          (bypasses the datacenter IP block)
  │                                       └─ AES-GCM decrypts the payload
  │                                       └─ unwraps proxy layers to real CDN URL
  │                                       └─ returns HMAC-signed /api/media-proxy URLs
  │
  └─ GET /api/media-proxy?u=…&h=…&s=…       (Cloudflare, edge)
        └─ verifies HMAC signature
        └─ streams the video from the CDN (hakunaymatata / goodstream)
           with the CDN's required Referer/Origin, forwarding Range,
           rewriting HLS manifests. Free Cloudflare egress.
```

Why this split: extraction is tiny (KB of JSON) so it's cheap to route through a
paid/residential proxy; video is huge (TBs) so it stays on Cloudflare where
**egress is free**. Never put video bandwidth on Netlify/Vercel (metered,
~$55/100GB).

---

## Components

| File | Runtime | Role |
|---|---|---|
| `netlify/functions/extract.mjs` | Netlify (AWS, Node) | The **only** place that talks to `eat-peach.sbs`. Routes through the proxy pool, decrypts, unwraps to real CDN URLs, signs them for the media proxy. Self-contained (no `@/` imports). |
| `app/api/stream/[type]/[id]/route.ts` | Cloudflare (edge) | Thin delegator → calls the Netlify function (`NETLIFY_EXTRACT_URL`) and returns its JSON. |
| `app/api/media-proxy/route.ts` | Cloudflare (edge) | Verifies the HMAC signature, then streams the CDN media same-origin (Range support, HLS manifest rewriting, CORS). |
| `lib/media-sign.ts` | Cloudflare (edge) | HMAC-SHA256 sign/verify for media-proxy URLs. Must stay byte-identical to the signing code duplicated inside `extract.mjs`. |
| `components/peachify-player.tsx` | Client | Fetches `/api/stream`, plays mp4 (range-seekable) first with HLS fallback, auto-advances on source failure, renders subtitle tracks. |

Players are wired into: `app/movie/[id]/movie-detail-hero.tsx`,
`app/series/[id]/series-detail-hero.tsx`, `app/movie/[id]/watch/page.tsx`,
`app/series/[id]/watch/page.tsx`, `app/collection/[id]/collection-detail-hero.tsx`.

---

## The Peachify backend (reverse-engineered)

All of this is replicated in `netlify/functions/extract.mjs`. **If Peachify
rotates these, playback breaks until they're refreshed there.**

### Providers
`GET {api}/{path}/{type}/{tmdbId}` (movies) or
`GET {api}/{path}/{type}/{tmdbId}/{season}/{episode}` (TV).

| Label | path | api host |
|---|---|---|
| Iron | `moviebox` | `https://uwu.eat-peach.sbs` |
| Spider | `holly` | `https://usa.eat-peach.sbs` |
| Wolf | `air` | `https://usa.eat-peach.sbs` |
| Multi | `multi` | `https://usa.eat-peach.sbs` |
| Dark | `net` | `https://uwu.eat-peach.sbs` |

We query all providers in parallel and merge sources. Different titles resolve on
different providers (e.g. one movie may only have sources under `moviebox`,
another under `holly`).

### Required headers
The source API returns `403` unless the request has **`Referer: https://peachify.top/`**
*or* **`Origin: https://peachify.top`**. It also returns
`Access-Control-Allow-Origin: https://peachify.top` (CORS locked to peachify) —
which is why a browser on our domain can't call it directly.

### Decryption
Response is `{ "isEncrypted": true, "data": "<iv>.<salt>.<ciphertext>" }`.
- Each part is **base64url** (URL-safe, no padding).
- **AES-256-GCM**. Key (hex):
  `a8f2a1b5e9c470814f6b2c3a5d8e7f9c1a2b3c4d5e3f7a8b8cad1e2d0a4d5c5b`
- `iv` = first part. The sealed message passed to GCM-decrypt is
  `salt-bytes || ciphertext-bytes` concatenated (the 16-byte auth tag is the
  tail of the ciphertext part). Decrypted plaintext is JSON.

Decrypted shape:
```jsonc
{
  "sources": [
    { "type": "mp4" | "hls", "url": "<proxy-wrapped CDN url>",
      "quality": 1080, "dub": "Original Audio", "headers": {…} }
  ],
  "subtitles": [ { "url": "…", "label": "English", "language": "en" } ]
}
```
For `moviebox`, the source list is **complete videos per language × quality**
(e.g. Original/Arabic/French/Hindi/Russian/Tagalog × 360/480/1080). The
`/tran-audio/` path segment is just MovieBox's storage folder — these are still
full muxed videos, NOT audio-only tracks.

### Proxy-layer unwrapping
Source `url`s are wrapped in Peachify's own flaky proxy workers, e.g.:
- mp4: `https://<name>.workers.dev/mp4-proxy?url=<realCdn>&headers=<json>`
- hls: `https://<name>.eat-peach.sbs/m3u8-proxy?url=<realCdn>&headers=<json>`

`extract.mjs` **unwraps** these to the real CDN URL plus the `headers` the CDN
requires (e.g. `{ origin: "https://netfilm.world", referer: "…", user-agent: … }`).
Real CDNs seen: `*.hakunaymatata.com` (mp4), `goodstream.cc` (hls). We unwrap
because the workers.dev layer is an unreliable throwaway (frequent 502/522) and
because we want to set the CDN headers ourselves in the media proxy.

---

## Media proxy (`/api/media-proxy`)

- Input: `?u=<absolute CDN url>&h=<base64 headers>&s=<hmac>`.
- **Signature check first** (`verifyMediaUrl`). HMAC-SHA256 over `${u}\n${h}`.
  This replaces a host allowlist — we forward to *any* host, but only URLs we
  minted. Rejects open-proxy abuse (`evil.com` → 403).
- Sends the CDN's required `Referer`/`Origin`/`User-Agent` (decoded from `h`,
  defaults to peachify), forwards the browser's `Range` header → 206 seeking.
- If the response is an HLS manifest (`.m3u8` / `mpegurl`), it **rewrites every
  child URI** (segments, keys, sub-playlists, `EXT-X-MAP`) back through the
  proxy, re-signed and carrying the same headers.
- Streams the body through (`res.body`) for video/segments — Cloudflare egress
  is free, so even 20 TB/mo of video costs ~$0 in bandwidth (just Worker
  requests). ⚠️ See "Cloudflare video ToS" caveat below.

---

## Client-direct CDNs (`extract.mjs` `CLIENT_DIRECT_HOSTS`)

Some CDNs **block Cloudflare's egress IPs**, so the media proxy (a Worker) can
never fetch them — but they serve fine from the user's own residential IP and
send `Access-Control-Allow-Origin: *`. For these (currently the **Multi**
provider's `*.keymi417exx.com`), `extract.mjs` skips signing and hands the
browser the **raw CDN URL** with `direct: true`; our hls.js loads it directly.
Still ad-free (our player, raw video only).

**Gotcha — the Referer + cross-origin redirect (fixed via `resolveClientDirectUrl`):**
keymi's intake host (`i-arch-*`) 302-redirects the playlist to a CDN edge
(`cdnNNNNN`). The edge **requires a `Referer` header**: with one → `200` +
`ACAO: *`; without one → `404` (and a 404 has no ACAO, so the browser reports a
*CORS* error and hls.js dies with `DEMUXER_ERROR_COULD_NOT_PARSE`). Browsers send
our origin as the Referer on a *direct* cross-origin request, but can **drop it
across the cross-origin 302** — the cause of intermittent "plays for some titles,
not others." The CDN is **not IP-locked** and tolerates a stale token, so
`extract.mjs` **pre-follows the redirect server-side** (manual hops, body never
read → no token consumed, fail-open) and emits the terminal edge URL. The browser
then makes one direct request with the Referer intact. Keep the app's default
`Referrer-Policy` (must send ≥ the origin cross-origin; never `no-referrer`).

---

## Fallback provider: vsembed (`extract.mjs` `fetchVsembed`)

A second, independent extraction chain (NOT eat-peach) used as a **last-resort
source**. It exists for the case a Peachify CDN token is dead but Peachify still
returns it (e.g. an expired keymi URL on a Multi-only title, which would
otherwise be an unrecoverable blank player). `fetchVsembed` runs **in parallel**
with the Peachify loop (so it adds no latency), is **hard-capped** at
`VSEMBED_DEADLINE_MS` (so a slow hop can never delay the Peachify response), and
is **appended last** (provider label `Bolt`, `providerRank` 99 → sorts after
every Peachify source). The player therefore only reaches it when the preferred
sources fail to play — or uses it as the sole source when Peachify found nothing.

`vsembed.ru` is a vidsrc/cloudnestra clone. Chain (all hops via the residential
proxy, since the sites are Cloudflare-fronted):
1. `GET vsembed.ru/embed/movie/<tmdbId>` or `…/embed/tv/<tmdbId>/<s>/<e>`
   (both use the **TMDB** id) → the `player_iframe` for the "CloudStream Pro"
   server: `//<rcpDomain>/rcp/<hash>`. **`rcpDomain` rotates**
   (cloudnestra → cloudorchestranova → …) so it's read from the page, never
   hardcoded; cloudnestra.com itself no longer resolves.
2. `GET <rcpDomain>/rcp/<hash>` → `src: '/prorcp/<id>'` (these hops flake
   intermittently → `vsFetchText` retries once).
3. `GET <rcpDomain>/prorcp/<id>` → Playerjs `file: "<m3u8> or <m3u8>"` (mirrors;
   first valid one is taken).

The resolved m3u8 lives on a **rotating `*.space` CDN** (vestigialvortex,
obeliskoverture, penumbrapalimpsest, …) that sends `Access-Control-Allow-Origin: *`
and needs **no Referer** — so it's emitted with `direct: true` and played
**client-direct** (raw URL, no signing, no media proxy). No new env var; the same
`PROXY_LIST` is reused.

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
- Deploys only `netlify/functions/extract.mjs` (see `netlify.toml`;
  `NETLIFY_NEXT_PLUGIN_SKIP=true` stops Netlify auto-building the Next app).
- Function URL: `https://<site>.netlify.app/.netlify/functions/extract`
- Env vars:
  - `PROXY_LIST` — comma/newline-separated `host:port:user:pass` entries
    (Webshare proxies). The function picks one at random per request.
  - `MEDIA_PROXY_SECRET` — shared secret (same as Cloudflare).

### Cloudflare Pages (the app + media proxy)
- Env vars:
  - `NETLIFY_EXTRACT_URL` — the Netlify function URL above.
  - `MEDIA_PROXY_SECRET` — same value as Netlify.

### Proxy
Datacenter IPs are blocked by eat-peach, so the proxy must be **residential** (or
at least an ISP range eat-peach hasn't blocked). Webshare's authenticated proxies
worked; free public proxy lists do **not** (they're datacenter and/or dead).
Extraction traffic is tiny (~8 KB/play, cached 5 min) so proxy bandwidth/cost is
negligible.

---

## Why it's built this way (key constraints discovered)

1. **eat-peach blocks datacenter IPs.** Confirmed 403 (Cloudflare WAF block
   page) from both CF Pages and Netlify/AWS egress. Only a residential/clean IP
   + the peachify referer gets 200. → extraction needs a residential proxy.
2. **Cloudflare Workers `fetch` can't use an HTTP proxy.** No `undici`/proxy
   support in that runtime. → the proxied call must run on Netlify (Node), not CF.
3. **`Origin`/`Referer` are forbidden headers in browsers** and the source API's
   CORS is locked to peachify.top → browser-side extraction is impossible.
4. **Media bandwidth must stay on Cloudflare** (free egress). Netlify/Vercel
   egress is metered and would cost thousands at scale.
5. **CDNs reject our Origin/Referer** → media must be proxied server-side (we set
   the CDN's expected headers); it can't be fetched directly by the browser.
6. **mp4 is preferred over HLS**: single predictable host, byte-range seeking,
   and less prone to the upstream rate-limiting that hit the HLS CDN
   (`goodstream.cc`) during heavy testing.

---

## Maintenance / when it breaks

Symptoms → likely cause → fix:

- **All titles 404 "No sources found"** → eat-peach changed, or the proxy is
  dead/blocked, or the AES key/providers rotated. Hit the Netlify function
  directly: `…/extract?type=movie&id=1022789`. If it returns
  `{ ok:false, debug:{ "Iron":403,… } }`, the proxy IPs are blocked → swap
  `PROXY_LIST`. If `200` upstream but decrypt fails (no sources) → the **AES key
  or provider list changed** in Peachify's bundle; re-scrape and update the
  constants at the top of `extract.mjs`.
- **Media 403 "Bad signature"** → `MEDIA_PROXY_SECRET` mismatch between Netlify
  and Cloudflare, or the two signing implementations drifted.
- **Media 502 / stalls** → the unwrapped CDN token (`?t=`/`?sign=`) expired, or
  that CDN rate-limited the egress IP. The player auto-advances to the next
  source; mp4 (hakunaymatata) is generally more reliable than HLS (goodstream).
### Refreshing Peachify internals (key / providers rotated) — RUNBOOK

The values that go stale all live at the **top of `netlify/functions/extract.mjs`**:
`AES_KEY_HEX`, `PROVIDERS`, `REFERER`. There's a script that detects and verifies
the current ones automatically:

```bash
# 1. Detect + verify (prints the live key & providers, confirms by decrypting
#    a real payload). The verify step calls the IP-blocked source API, so either
#    run from a residential connection OR pass the proxy list:
PROXY_LIST="host:port:user:pass,host:port:user:pass" node scripts/refresh-peachify.mjs

# 2. If it prints "✅ Confirmed", patch extract.mjs automatically:
PROXY_LIST="…" node scripts/refresh-peachify.mjs --write

# 3. Commit, push, and redeploy the Netlify function.
git add netlify/functions/extract.mjs && git commit -m "Refresh Peachify key/providers" && git push
```

What the script does: fetches the embed page (`/embed/movie/1022789`), pulls all
`/_next/static/chunks/*.js` (CDN-served, never IP-blocked), extracts the
`{label,path,apis:[…]}` provider array and every 64-hex string literal (key
candidates), then **fetches a real source payload and tries each candidate key**
— the one that decrypts to valid `{sources}` is the confirmed key. `--write`
rewrites the `AES_KEY_HEX` line and the `PROVIDERS` array in `extract.mjs`.

**If the script fails** (e.g. "None of the candidate keys decrypted" or "Could
not locate providers"), Peachify changed more than the key — the decrypt *scheme*
itself moved. Do it manually (see below), then update both `extract.mjs` and the
mirrored decrypt in `scripts/refresh-peachify.mjs`.

### Manual extraction (when the script can't auto-detect)
From the player JS bundle (`peachify.top/_next/static/chunks/*.js`):
- **AES key**: the 64-hex literal passed to the decrypt call (`dD(o.data, "<hex>")`).
- **Providers**: the `ee=[{label,path,apis:[…]}]` array.
- **Decrypt routine**: functions `dD` (AES-GCM), `dC` (base64url), `dP` (importKey).
  If these change shape, update `decrypt()`/`b64urlToBytes()` in `extract.mjs`
  (and the mirror in `refresh-peachify.mjs`).
- **Source/CDN shape**: function `dF` builds `{api}/{path}/{type}/{id}` and the
  `mp4-proxy`/`m3u8-proxy` wrappers embed `url` + `headers` (handled by
  `unwrap()` in `extract.mjs`).

### When the proxy IPs get blocked (not the key)
Symptom: Netlify function returns `{ ok:false, debug:{ "Iron":403,… } }`. The
source API is up but rejecting the proxy's IPs. Fix: get fresh residential
proxies and update the **`PROXY_LIST`** env var on Netlify (and redeploy). No
code change needed. Verify a single proxy quickly:
```bash
curl -s -x "http://user:pass@host:port" "https://usa.eat-peach.sbs/multi/movie/1022789" \
  -H "Referer: https://peachify.top/" -o /dev/null -w "%{http_code}\n"   # want 200
```

---

## Cloudflare video ToS caveat

Proxying large volumes of third-party video through Cloudflare Workers can run
afoul of Cloudflare's Service-Specific Terms (§2.8) and risks being flagged at
scale. Egress is free, so it's cheap — but if Cloudflare pushes back, move
**only the media proxy** to a flat-rate-bandwidth host (e.g. a Hetzner VPS,
~20 TB included for a few €/mo). Extraction stays on Netlify either way.

---

## History (why we abandoned the iframe)

1. **Direct iframe** to `peachify.top/embed/...` worked but showed ads. Ads only
   appeared on the production domain (referer-based), not localhost.
2. Tried `referrerPolicy=no-referrer`, then `sandbox` without `allow-popups` →
   triggered Peachify's "Sandbox Detected" overlay.
3. Built a **proxy-iframe** (served Peachify's HTML through our domain, injected
   `window.open`/anchor/`crossOrigin` neutralizers, rewrote assets, stripped RSC
   + Rocket Loader). Got close, but it ultimately depends on the player's API
   calls to eat-peach — which **fail from Cloudflare's IPs** in prod (same block
   that drove the final architecture).
4. Pivoted to **URL extraction** (this doc): no Peachify player, no ads, native
   `hls.js` player. The only remaining dependency on Peachify is the source API,
   reached via the Netlify + residential-proxy hop.
