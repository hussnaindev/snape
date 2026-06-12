# MovieBox Integration — Runbook

> Canonical doc for the MovieBox stream source. Read this before touching
> `netlify/lib/moviebox.mjs` or `lib/moviebox-match.mjs`.
>
> MovieBox is the **primary** source in the extraction pipeline. It is invoked
> from `netlify/functions/extract.mjs` (see `fetchMoviebox`). For the overall
> player/proxy architecture, see `docs/STREAMING-ARCHITECTURE.md`.

---

## TL;DR

We resolve a stream by: **TMDB ref → search MovieBox → match the hit → play →
captions**. MovieBox exposes the catalog through **two** backends:

| Backend | Host | Filtered? | Gives detailPath? | Needs signing? |
|---|---|---|---|---|
| **Web (h5) BFF** | `h5-api.aoneroom.com` / `movie-box.co` | **Yes** — DMCA-delists titles (Inception, Interstellar, The Dark Knight, …): `totalCount > 0` but the subject is filtered out of `items` | **Yes** | No (bearer cookie) |
| **Mobile (app) BFF** | `api.inmoviebox.com/wefeed-mobile-bff` | **No** — returns delisted titles | **No** (`detailUrl` is always `""`) | **Yes** (`x-tr-signature`) |

We **search via the mobile BFF first** (unfiltered) and fall back to web search
only if mobile fails/returns nothing. We **play via the web endpoint**
(`movie-box.co/wefeed-h5api-bff/subject/play`) regardless of which search found
the hit — subjectIds are shared between both backends.

The two backends' asymmetry (mobile has the titles but no `detailPath`; web has
`detailPath` but delists titles) is the source of most bugs. See **Gotchas**.

---

## Pipeline & the `debug` object — your primary diagnostic

`fetchMoviebox` returns `{ sources, subtitles, debug }`. **`debug` records every
stage and is surfaced in the extract response** — always read it first. The
`debug.stage` value tells you exactly where it stopped:

| `stage` | Meaning | Where to look |
|---|---|---|
| `no-proxy` | `PROXY_LIST` empty → bailed before any request | env: `PROXY_LIST` must be set (web play & mobile search are IP-blocked from datacenters; everything routes through proxies) |
| `no-tmdb` | TMDB lookup failed / returned no title | env: `TMDB_API_KEY`; TMDB API up? `fetchTmdbRef` |
| `no-match` | Search returned hits but none matched the TMDB ref confidently | matcher too strict, or title genuinely absent — see **Matching** |
| `no-streams` | Matched + variants picked, but `play` returned 0 streams for all of them | missing `detailPath` on a TV series (Gotcha #1), **or the account free-play quota is exhausted** (Gotcha #6) |
| `error` | An exception was thrown (HTTP non-2xx, API `code != 0`, signing) | `debug.error` has the message; check signing / key rotation |
| `matched` | Success — `debug.streams` = source count | — |

Other useful `debug` fields: `searchSource` (`mobile`|`web`), `searchHits`,
`altSearchHits`, `mobileSearchError`, `variants` (per-language picks with
scores + subjectIds), `detailPathBackfill` (`{ missing, filled }`), `play`
(`{ se, ep }`), `streams`.

---

## Diagnostic harness (reproduce locally)

The fastest way to debug a specific title is to run the real fetch against the
live APIs with prod env. From the repo root:

```js
// save as ./mb_debug.mjs, run with `node ./mb_debug.mjs`, then delete it.
import fs from 'node:fs';
for (const f of ['.env', '.env.prod']) {
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const { fetchMoviebox, fetchTmdbRef } = await import('./netlify/lib/moviebox.mjs');
const cases = [
  ['tv', '93405', '1', '1'],   // Squid Game
  ['movie', '324857'],         // Spider-Man: Into the Spider-Verse
];
for (const [type, id, se, ep] of cases) {
  const tmdb = await fetchTmdbRef(type, id, se, ep);
  console.log('\n===', type, id, '->', tmdb?.title, tmdb?.year, 'orig=', tmdb?.originalTitle);
  const r = await fetchMoviebox(type, id, se, ep);
  console.log('debug:', JSON.stringify(r.debug, null, 2));
  console.log('sources:', r.sources.length);
}
```

- TMDB ids are in the URL: `/movie/324857`, `/series/93405`.
- Needs `TMDB_API_KEY` (in `.env`) and `PROXY_LIST` (in `.env.prod`) — without
  proxies you get `stage: no-proxy`.
- To probe a single backend in isolation (search vs. play), copy the relevant
  helper out of `moviebox.mjs` — the mobile request needs the full signing block
  (see **Request signing**); the web play needs the bearer cookie.

When the harness says `matched` but the site doesn't play, the break is
**downstream** (media-proxy / player), not here — pivot to
`docs/STREAMING-ARCHITECTURE.md`.

---

## Matching (`lib/moviebox-match.mjs`)

Pure, dependency-free scoring. `pickBestMovieboxMatch` scores each hit:

```
score = title*0.5 + year*0.2 + duration*0.15 + rating*0.15
```

- Default bar `minScore = 0.62`, `minTitle = 0.55`.
- **Exact-title rescue:** an exact normalized-title match is accepted even with
  weak/missing secondary signals (bar drops to 0.5) — but a hard year
  contradiction (wrong-year remake) is never rescued.
- `pickMovieboxVariants` groups the *same* film across audio languages
  (Original + Hindi/Tamil/…) by **exact normalized-title equality** to the
  anchor (so `Inception` groups its `[Hindi]` dub but not `Inception: The Cobol
  Job`). Original sorts first; default audio track is the Original.
- Language is detected from the bracket suffix: `Inception [Hindi]` → `Hindi`;
  quality tags (`[CAM]`, `1080P`, …) are ignored → `Original`.

**If a valid title is rejected (`no-match`):** check `titleMatchScore` on the
actual hit. Common causes: punctuation/colon differences, a `postTitle` that
mismatches, or the year/duration/rating dragging an exact title below 0.62 (the
rescue should catch exact titles — if it doesn't, the normalized titles differ).
Tests live in `lib/moviebox-match.test.mjs` (`node lib/moviebox-match.test.mjs`).

---

## Request signing (mobile BFF)

Required for `api.inmoviebox.com`. Implemented in `moviebox.mjs`:

- **`x-tr-signature`** = `<ts>|2|<base64(HMAC-MD5(canonical, key))>` where
  `canonical = "POST\napplication/json\napplication/json\n<bodyLen>\n<tsMs>\n<md5hex(body)>\n<path>"`
  (path = `/wefeed-mobile-bff/subject-api/search`, **no query string**).
- **key** = `MOBILE_SECRET_KEY` (base64 alphabet, **base64-decoded to bytes**
  before use), overridable via `MOVIEBOX_SECRET_KEY` env.
- **`X-Client-Token`** = `<ts>,<md5(reverse(<ts>))>`.
- **`X-Client-Info`** / **`User-Agent`** = Android app identifiers.
- **Send NO `Authorization` bearer on the mobile request.** A stale token makes
  the gateway return `401 "signature is invalid"` *before* the signature is even
  checked. Anonymous signed requests work.

Reference implementation for the scheme: `Simatwa/moviebox-api` (Python, v3 =
Android app).

---

## Gotchas (ranked by how often they bite)

### 1. TV series return `no-streams` — missing `detailPath`
The mobile BFF returns `detailUrl: ""` for **every** hit, so mobile-sourced
items have no `detailPath`. The web `play` endpoint:
- **Movies:** resolve on `subjectId` + `se=0,ep=0` alone → play even with empty
  detailPath.
- **TV:** **require** `detailPath` to resolve the episode → without it,
  `play` returns `code:0 "ok"` but **zero streams**.

**Fix (already in place):** `backfillDetailPaths` re-runs the *web* search after
variant selection and fills missing `detailPath` by matching the shared
`subjectId`. Watch `debug.detailPathBackfill = { missing, filled }`.
- A title delisted on web (e.g. a Hindi dub) can't be backfilled → that variant
  drops out (returns 0 streams, harmlessly filtered). The Original usually
  survives because it's rarely delisted.
- **A TV series that is *itself* delisted on web** (rare) can't get a detailPath
  from either backend and will still fail `no-streams`. If this happens, the
  mobile BFF's own detail/play endpoint must be wired up (not currently done).

### 2. `401 "signature is invalid"` on mobile search
You're sending an `Authorization` bearer. Don't — see **Request signing**.

### 3. Secret key / bearer rotation
MovieBox can rotate `MOBILE_SECRET_KEY` (mobile signing) or the web bearer
server-side.
- If the **secret key** rotates: mobile search throws → code falls back to web
  search → delisted titles silently disappear (Inception-type titles vanish).
  Symptom: `debug.searchSource: web` + `debug.mobileSearchError` set. Fix:
  recover the new key (decompile current app / `Simatwa/moviebox-api`), set
  `MOVIEBOX_SECRET_KEY` env.
- If the **web bearer** rotates: web `play`/`search` start returning 401 →
  `stage: error`. Update `MOVIEBOX_BEARER` (and/or `MOVIEBOX_MB_TOKEN` /
  `MOVIEBOX_TOKEN`) env; the hardcoded `AUTH_FALLBACK` is only a default.

### 4. TV se/ep indexing
MovieBox TV play uses **1-based** `se`/`ep` (TMDB S1E1 → `se=1, ep=1`). Movies
are always `se=0, ep=0`. If episodes resolve to the wrong content, check
`debug.play`.

### 6. Per-account free-play quota → `no-streams` with `limited:true` (play is ANONYMOUS)
MovieBox added a **per-account free-play quota** on the web `play` endpoint. An
authenticated account (our bearer/`mb_token` cookie) that exhausts it gets:
```
{ "code":0, "message":"ok",
  "data": { "streams":[], "dash":[], "hls":[], "hasResource":true,
            "limited":true, "freeNum":6,
            "limitedCode":"<base64 {uid,timestamp,ip,timezone}>" } }
```
`hasResource:true` proves the title exists — the streams are purely gated. `freeNum`
is the remaining quota for that `uid`; ours sat at 6 and `limited` flipped true. The
**same `play` request sent anonymously** (no cookie) comes back with `freeNum:999`,
`limited:false` and the real `streams`.

**Fix (in place):** `play()` sends **no account cookie** — it always plays as an
anonymous guest. Search still uses the bearer (mobile signed search is primary; web
search/backfill carries the bearer); captions never sent a cookie. Symptom if this
regresses: every title (movies included, not just TV) returns `no-streams`, and a raw
`play` dump shows `limited:true` / low `freeNum`. Do **not** "fix" it by rotating to a
fresh bearer — a new account just burns its own `freeNum` and breaks again; anonymous
play is the durable path.

### 5. Datacenter IP block
Both backends block datacenter IPs. Everything goes through `PROXY_LIST`. Empty
list → `stage: no-proxy`. Flaky proxies → intermittent `error`/`no-streams`
(retry is 4 attempts w/ backoff in `proxyFetch`).

---

## Environment variables

| Var | Where | Purpose |
|---|---|---|
| `TMDB_API_KEY` | `.env` | TMDB ref lookup (title/year/runtime/rating for matching). Required. |
| `PROXY_LIST` | `.env.prod` | `host:port[:user:pass]` per line/comma. Required — all upstream calls route through these. |
| `MOVIEBOX_SECRET_KEY` | (optional) | Override the mobile-BFF HMAC key when MovieBox rotates it. |
| `MOVIEBOX_BEARER` / `MOVIEBOX_MB_TOKEN` / `MOVIEBOX_TOKEN` | (optional) | Override the web bearer/cookie tokens. |

---

## History / incidents

- **Delisted titles (Inception, Interstellar, …):** web search filters them out
  of `items`. Fixed by adding the signed **mobile BFF** search (unfiltered).
- **`401 "signature is invalid"`:** caused by sending a stale `Authorization`
  bearer on the mobile request. Fixed by sending none.
- **Multi-language audio:** `pickMovieboxVariants` groups Original + dubs by
  exact normalized title; player defaults to Original, switchable via the audio
  track selector.
- **`limited:true` / `freeNum` quota (2026-06):** web `play` started returning
  `code:0 "ok"` with empty `streams` + `limited:true` for our authenticated account
  on **every** title (movies too) — a new per-account free-play cap. Fixed by sending
  the `play` request anonymously (dropped the `mb_token`/`token` cookie). See Gotcha #6.
- **Squid Game (TV) `no-streams`:** mobile items have no `detailPath`, which web
  TV play requires. Fixed with `backfillDetailPaths` (web index by subjectId).
  Movies were unaffected (resolve on subjectId alone).
