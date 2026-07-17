# Bot Abuse / Cloudflare Request-Limit Investigation

**App:** Snape web (`web/`) — Next.js 15 on Cloudflare Pages (`@cloudflare/next-on-pages`)
**Investigated:** 2026-07-17
**Status:** Root cause identified (calibrated confidence). Edge remediation pending
(must be applied in the Cloudflare dashboard — see §6).

---

## 1. Symptom

The Cloudflare account repeatedly exceeds a **~100k/day** limit despite essentially
no real users. Account analytics (last 7 days, all sites) as reported:

| Metric | Value |
|---|---|
| Requests | 1.23M (≈175k/day) |
| Visits / Page views | ~728k each |
| Bandwidth | 11.84 GB |
| Cached requests | 682 (**0.06%**) |
| 4xx errors | 195.19k (**15.8%**) |
| 5xx errors | 300.68k (**24.4%**) |
| HTTP/1.1 | 1.2M of 1.23M (**~97%**) |
| Content type `html` | 1.22M (**~99%**) |
| Top geos | Vietnam, Brazil, Bangladesh, Argentina, Pakistan, Mexico, Iraq, Colombia, South Africa, Venezuela |

Two hostnames serve the app:
- `snape.hussnainraza.cv` — custom domain, inside a Cloudflare **zone** (WAF-capable).
- `snape.pages.dev` — default Pages domain, **outside** any zone.

---

## 2. Critical metric distinction (read this first)

Two different meters are being conflated:

- **Account/zone Analytics "Requests" (1.23M)** counts *everything* the Cloudflare
  edge handled — including challenges, 4xx, redirects, and blocked requests. Many of
  these never reach your code.
- **The 100k/day limit** is the **Workers/Pages Functions Free** meter. It counts
  only requests that actually **invoke a Pages Function**.

On `@cloudflare/next-on-pages`, **every non-static request invokes a Function**
(SSR pages, API routes, middleware, and even dynamic 404s). So on this app the two
numbers track closely — but they are not identical, and fixes must target the
**Function-invocation** meter.

---

## 3. Evidence gathered

### 3.1 Production database (D1 `snape-db`)
Queried live via MCP:

```
users = 1
sessions = 22 (total, all-time)
sessions created in last 7 days = 0
watch_history rows = 0
```

**Conclusion:** effectively **zero human traffic**. 175k requests/day against 0 new
sessions and 0 watch events is not users — it is automated traffic.

### 3.2 Live HTTP probes (2026-07-17)
Plain `curl` (no JavaScript, no cookies) against the **custom** domain
`snape.hussnainraza.cv`:

| Path | Status | Notes |
|---|---|---|
| `/` | **404** | `cf-cache-status: DYNAMIC`, **no challenge header** |
| `/browse/streaming` | **404** | |
| `/movie/550` | **404** | |
| `/api/tmdb/trending/all/day` | **404** | expected a 403 same-origin reject; got 404 |
| `/auth/login` | 200 | |
| `/robots.txt`, `/sitemap.xml` | 200 | static, served from edge |
| `/wp-login.php`, `/random-junk` | 404 | |

`snape.pages.dev` behaves the same (e.g. `/browse/streaming` → 404).

**Two findings from this probe:**
1. A dumb no-JS `curl` reached a **Function-generated** response
   (`cf-cache-status: DYNAMIC`) on the custom domain with **no `cf-mitigated`
   challenge header**. → Under Attack / Bot Fight Mode is **not effectively
   challenging** automated traffic on the custom domain right now.
2. `/` and the main content routes return **404** in production — a likely
   **broken/partial deployment** (see F5). Each 404 is still a Function invocation.

---

## 4. Findings / Issues

| ID | Severity | Finding |
|---|---|---|
| **F1** | Critical | **Bot/scraper flood.** ~175k req/day with ~0 real users; HTTP/1.1 + `html` + distributed scraper geographies + ~40% error rate = automated abuse, not humans. |
| **F2** | Critical | **Edge protection is not actually blocking.** Under Attack / "Fight Mode" on `snape.hussnainraza.cv` let a bare `curl` through to a Function response (`DYNAMIC`, no `cf-mitigated`). Whatever is enabled is not challenging simple bots. |
| **F3** | High | **`snape.pages.dev` is outside the zone.** WAF / Under Attack Mode / rate-limiting **cannot** apply to it. It is an inherently unprotected surface. (Not *proven* to be the majority of load — see §7 — but it is a real hole.) |
| **F4** | High | **Every hit = a Function invocation.** next-on-pages routes `/*` through the Function, so even 404s and bot junk paths burn the 100k/day meter. This is why the limit trips. |
| **F5** | High | **Production returns 404 on `/` and main content routes.** Possible broken deploy; inflates the 195k 4xx and wastes invocations. Needs separate investigation. |
| **F6** | Medium | **No caching.** 0.06% cache rate — nearly every request reaches the Function. |
| **F7** | Low | **`robots.txt` allowed `/api/` and pointed the sitemap at pages.dev.** (Fixed in-repo, §5.) Won't stop malicious bots but is correct hygiene. |
| **F8** | Info | **Per-hostname invocation split is unverified.** The `cloudflare-observability` MCP connector did not expose query tools in this session, so the exact pages.dev-vs-custom-domain breakdown could not be measured. |

---

## 5. In-repo changes already applied

These are **defense-in-depth / hygiene**. None of them reduce the Function-invocation
count on their own (the Function is already invoked before app code runs) — the real
cap comes from §6.

- **`middleware.ts`** — 301-redirects any `*.pages.dev` request to
  `NEXT_PUBLIC_CANONICAL_HOST` (default `snape.hussnainraza.cv`), consolidating
  traffic onto the zone. Matcher widened to all non-asset routes.
- **`public/robots.txt`** — added `Disallow: /api/`; `Sitemap:` now points at the
  custom domain.
- **`app/sitemap.ts`** — canonical `baseUrl` default changed from `snape.pages.dev`
  → `https://snape.hussnainraza.cv`.

---

## 6. Remediation — apply in the Cloudflare dashboard

Ordered by impact. Items 1–3 are what actually cap the 100k/day meter, because they
act **before** the Pages Function is invoked.

### 6.1 Rate limiting rule (REQUESTED — this is the primary "add rate limiting" step)

Dashboard → **`snape.hussnainraza.cv` zone → Security → WAF → Rate limiting rules →
Create rule**:

- **Rule name:** `anti-bot-burst`
- **If incoming requests match:** `Custom` →
  expression: `(http.host eq "snape.hussnainraza.cv")`
  (or leave as "All incoming requests")
- **Rate:** `50` requests per `10` seconds
- **Counting characteristic (per):** `IP address`
- **Also apply to:** all paths (or scope to `not http.request.uri.path in {"/robots.txt" "/sitemap.xml"}`)
- **Then take action:** `Managed Challenge` (safer than Block; escalate to `Block`
  if abuse continues)
- **Duration (mitigation timeout):** `60 seconds`

> Free plan note: Cloudflare Free includes **one** rate-limiting rule with a fixed
> 10s window and limited actions. The values above fit within that. If you are on a
> paid plan, tighten to e.g. 30 req / 10s and add a second rule for `/api/*`.

**Scripted alternative (only if you prefer API/Terraform):** this rule lives in the
`http_ratelimit` ruleset phase and can be created with `POST
/zones/{zone_id}/rulesets` (kind `zone`, phase `http_ratelimit`). It requires an
account **API token** with `Zone WAF: Edit` — handle that token yourself; do not
paste it here.

### 6.2 Bot Fight Mode (one toggle)
Dashboard → zone → **Security → Bots → Bot Fight Mode: On**. Free. Challenges
definitely-automated requests at the edge.

### 6.3 Verify Under Attack Mode is actually engaged (F2)
Dashboard → zone → **Security → Settings**. Set **Security Level / Under Attack Mode**
and confirm with a probe: `curl -sI https://snape.hussnainraza.cv/` should now return
a `403`/`503` with a `cf-mitigated: challenge` header (not a `200`/`404` `DYNAMIC`).
If it still sails through, the setting is not applied to this hostname.

### 6.4 Lock down `snape.pages.dev` (F3)
Dashboard → **Zero Trust → Access → Applications → Add → Self-hosted**:
- Domain: `snape.pages.dev`.
- Policy: **Block – Everyone** (there are no legitimate pages.dev users), or Allow
  only your own email. Access blocks at the edge → blocked requests **do not invoke
  the Function** and don't count against the limit.

### 6.5 Optional WAF custom rule — challenge non-browser traffic
Dashboard → zone → **Security → WAF → Custom rules → Create**:
- Expression:
  `(http.request.version in {"HTTP/1.0" "HTTP/1.1"} and not cf.client.bot and not cf.verified_bot_category eq "Search Engine Crawler")`
- Action: `Managed Challenge`
- Rationale: the flood is ~97% HTTP/1.1; real browsers use HTTP/2/3. Use Managed
  Challenge (not Block) to avoid harming the rare legitimate HTTP/1.1 client.

### 6.6 Optional geo challenge
If you have no users in the top abusive countries (§1), add a WAF rule to
`Managed Challenge` those `ip.geoip.country` codes.

### 6.7 Caching (reduce cost of what gets through) (F6)
- Give static/marketing pages a `Cache-Control: s-maxage=…` so the CDN serves repeats
  without re-invoking the Function.
- The TMDB proxy already sets `s-maxage=3600` — good.

---

## 7. Confidence & what is NOT proven

- **High confidence:** the traffic is automated abuse, not users (F1, from D1); every
  hit invokes a Function (F4, from the stack); edge protection is currently not
  challenging simple bots on the custom domain (F2, from live probe).
- **Medium confidence:** `pages.dev` being outside the zone is a genuine unprotected
  surface (F3) — but I could **not measure** how much of the load is pages.dev vs the
  custom domain (F8). Both domains behaved identically in probes.
- **Not fixable in code:** the 100k/day meter counts Function invocations; `middleware`
  and route handlers run *inside* the Function, so no code change reduces that count.
  Only edge blocking (§6) does.

**To close the gap:** reconnect the `cloudflare-observability` connector, then pull the
per-hostname Function-invocation breakdown to confirm which door carries the load.

---

## 8. Separate issue to investigate — F5 (production 404s)

`/`, `/browse/streaming`, `/movie/550` return **404** in production while `/auth/login`
returns 200. This suggests a broken or partial deploy (routing/build output mismatch),
independent of the abuse problem. Worth a dedicated look — it both degrades real UX and
turns crawler hits into 404 invocations.

---

## 9. Post-remediation verification

- Cloudflare → Analytics: requests/day fall back under 100k within hours.
- Workers & Pages → project → Metrics: **Function invocations** drop.
- Security → Events: rate-limit / Bot Fight Mode / WAF actions appear.
- `curl -sI https://snape.hussnainraza.cv/` shows a challenge header for bare clients.
- Zero Trust → Access → Logs: pages.dev requests are blocked at the edge.
