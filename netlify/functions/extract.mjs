// Peachify extraction on Netlify (AWS Lambda) — routes the source-API calls
// through a residential/Webshare HTTP proxy because eat-peach.sbs blocks
// datacenter IPs (Cloudflare AND AWS). Cloudflare Workers can't use HTTP
// proxies in fetch, so extraction lives here; media streaming stays on CF.
//
// Returns sources/subtitles whose URLs are pre-signed for the Cloudflare
// /api/media-proxy endpoint (HMAC must match lib/media-sign.ts, so the same
// MEDIA_PROXY_SECRET must be set on both Netlify and Cloudflare).
//
// Env vars (set in Netlify UI):
//   PROXY_LIST          comma/newline-separated  host:port:user:pass  entries
//   MEDIA_PROXY_SECRET  same value as on Cloudflare
//
// GET ?type=movie&id=1022789   |   ?type=tv&id=1399&season=1&episode=1

import { ProxyAgent, fetch as uFetch } from 'undici';

const AES_KEY_HEX = 'a8f2a1b5e9c470814f6b2c3a5d8e7f9c1a2b3c4d5e3f7a8b8cad1e2d0a4d5c5b';
const REFERER = 'https://peachify.top/';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// Queried sequentially; mp4 from any provider beats hls-only from an earlier one.
export const PROVIDERS = [
  { label: 'Iron', path: 'moviebox', api: 'https://uwu.eat-peach.sbs', attempts: 5 },
  { label: 'Spider', path: 'holly', api: 'https://usa.eat-peach.sbs', attempts: 5 },
  { label: 'Wolf', path: 'air', api: 'https://usa.eat-peach.sbs', attempts: 3 },
  { label: 'Multi', path: 'multi', api: 'https://usa.eat-peach.sbs', attempts: 3 },
  { label: 'Dark', path: 'net', api: 'https://uwu.eat-peach.sbs', attempts: 3 },
];

// ---- proxy pool ---------------------------------------------------------
function parseProxies() {
  const raw = process.env.PROXY_LIST ?? '';
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((entry) => {
      const [host, port, user, pass] = entry.split(':');
      if (!host || !port) return null;
      const auth = user && pass ? `${encodeURIComponent(user)}:${encodeURIComponent(pass)}@` : '';
      return `http://${auth}${host}:${port}`;
    })
    .filter(Boolean);
}
const PROXIES = parseProxies();
function pickProxyAgent() {
  if (PROXIES.length === 0) return undefined;
  const url = PROXIES[Math.floor(Math.random() * PROXIES.length)];
  return new ProxyAgent(url);
}

// ---- crypto: decrypt source payloads ------------------------------------
function b64urlToBytes(input) {
  const norm = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = norm.length % 4 === 0 ? '' : '='.repeat(4 - (norm.length % 4));
  return new Uint8Array(Buffer.from(norm + pad, 'base64'));
}
function hexToBytes(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map((h) => Number.parseInt(h, 16)));
}
async function decrypt(data) {
  const [iv, salt, ct] = data.split('.');
  const ivB = b64urlToBytes(iv);
  const saltB = b64urlToBytes(salt);
  const ctB = b64urlToBytes(ct);
  const sealed = new Uint8Array(saltB.length + ctB.length);
  sealed.set(saltB, 0);
  sealed.set(ctB, saltB.length);
  const key = await crypto.subtle.importKey(
    'raw',
    hexToBytes(AES_KEY_HEX),
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivB }, key, sealed);
  return JSON.parse(new TextDecoder().decode(plain));
}

// ---- unwrap proxy layers to the real CDN URL + required headers ----------
function unwrap(rawUrl) {
  let url = rawUrl;
  const headers = {};
  for (let i = 0; i < 3; i++) {
    let u;
    try {
      u = new URL(url);
    } catch {
      break;
    }
    const isProxy =
      (u.hostname.endsWith('.workers.dev') || u.hostname.endsWith('.eat-peach.sbs')) &&
      // mp4-proxy / m3u8-proxy wrap video; ts-segment wraps subtitles.
      /proxy|segment/i.test(u.pathname);
    const inner = u.searchParams.get('url');
    if (!isProxy || !inner) break;
    const h = u.searchParams.get('headers');
    if (h) {
      try {
        Object.assign(headers, JSON.parse(h));
      } catch {}
    }
    url = inner;
  }
  return { url, headers };
}

// CDNs that block Cloudflare's egress IPs — the media proxy (a Worker) can never
// reach them — but that serve fine from the user's residential IP AND send
// `Access-Control-Allow-Origin: *`. For these we hand the RAW CDN URL to the
// browser and let our own hls.js fetch it directly. Still ad-free — it's our
// player loading raw video, no Peachify scripts. (Multi provider's keymi417exx.)
//
// NOTE on the redirect: keymi's intake host (`i-cdn-*` / `i-arch-*`) 302-redirects
// the playlist to a rotating CDN edge (`cdnNNNNN`). The edge REQUIRES a `Referer`
// header — with ANY non-empty one it returns 200 + ACAO:*, with NONE it 404s (and
// a 404 has no ACAO → the browser surfaces a CORS error → hls.js
// DEMUXER_ERROR_COULD_NOT_PARSE). We hand the browser the RAW intake URL and let
// IT follow the 302: its request carries our origin as the Referer, so the edge
// serves 200. (We tried pre-resolving the redirect server-side, but the resolved
// edge URL is rejected for the browser — 404/405 — so that approach is NOT used.)
const CLIENT_DIRECT_HOSTS = ['keymi417exx.com'];
export function isClientDirectHost(rawUrl) {
  try {
    const h = new URL(rawUrl).hostname.toLowerCase();
    return CLIENT_DIRECT_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

// NOTE: keymi (client-direct) URLs are handed to the browser RAW — we deliberately
// do NOT pre-resolve their 302 server-side. The intake host 302-redirects to a
// rotating `cdnNNNNN` edge that requires a Referer (no Referer → 404) but accepts
// any non-empty one; the browser following the redirect supplies its origin as the
// Referer and gets 200 + ACAO:*. Pre-resolving instead produced an edge URL the
// browser couldn't use (404/405), which silently broke every keymi title.

// ---- media-proxy signing (MUST match lib/media-sign.ts) -----------------
const SECRET = process.env.MEDIA_PROXY_SECRET ?? 'snape-media-proxy-dev-secret';
let signKey;
async function getSignKey() {
  if (!signKey) {
    signKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
  }
  return signKey;
}
function pickHeaders(h) {
  const out = {};
  for (const k of ['referer', 'origin', 'user-agent']) {
    const v = h?.[k] ?? h?.[k.toLowerCase()];
    if (typeof v === 'string' && v) out[k] = v;
  }
  return out;
}
function encodeHeaders(h) {
  const picked = pickHeaders(h);
  return Object.keys(picked).length ? btoa(JSON.stringify(picked)) : '';
}
// Base origin of the media proxy. Set MEDIA_PROXY_BASE to the standalone
// Cloudflare Worker (e.g. https://snape-media.<acct>.workers.dev) to serve video
// off a plain Worker instead of the Next.js Pages route — this is what avoids
// Error 1102 during playback. Unset → relative path (Pages route, local dev).
const MEDIA_PROXY_BASE = (process.env.MEDIA_PROXY_BASE ?? '').replace(/\/+$/, '');

export async function signedMediaUrl(absoluteUrl, headers) {
  const h = encodeHeaders(headers);
  const key = await getSignKey();
  const sigBuf = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${absoluteUrl}\n${h}`),
  );
  const sig = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const hParam = h ? `&h=${encodeURIComponent(h)}` : '';
  return `${MEDIA_PROXY_BASE}/api/media-proxy?u=${encodeURIComponent(absoluteUrl)}${hParam}&s=${sig}`;
}

// ---- provider fetch -----------------------------------------------------
// Providers are queried IN PARALLEL (see the loop in the handler). They used to
// be sequential with a tiny 1800ms per-attempt timeout, but eat-peach has gotten
// slow: `usa.eat-peach.sbs` (Spider/Wolf/Multi) now takes ~11s to respond while
// `uwu.eat-peach.sbs` (Iron/Dark) takes ~2s. A short timeout aborted every usa
// attempt, so titles that only resolve on usa returned "No sources found"; and
// 3×11s sequential would blow past Netlify's 26s function limit anyway. So we run
// all providers concurrently and give each attempt enough time to cover the slow
// host, bounded by a per-provider budget so a hang can't stack two long timeouts.
// usa.eat-peach.sbs answers working titles in ~11s; dead-end titles (e.g. holly
// 538858) hang until a ~31s upstream 502. There's a ~20s gateway timeout in FRONT
// of this Netlify function (it returns a Cloudflare "error code: 502" when we take
// ~20s), so we must respond well under that: 15s covers a real ~11s usa response
// with margin while aborting a dead-end provider early enough to return clean JSON.
const ATTEMPT_TIMEOUT_MS = 15000;
const PROVIDER_BUDGET_MS = 15000; // total per provider; each attempt is capped to
//                                   the remaining budget so retries can't overrun it.

function hasPlayableSources(raw) {
  return (raw?.sources ?? []).some((s) => typeof s.url === 'string');
}

function inferSourceType(url, apiType) {
  if (/\.m3u8(\?|$)/i.test(url)) return 'hls';
  if (/goodstream\.cc/i.test(url)) return 'hls';
  if (apiType === 'hls') return 'hls';
  return 'mp4';
}

function hlsHostScore(sources) {
  for (const s of sources) {
    try {
      if (/goodstream\.cc/i.test(new URL(s.url).hostname)) return 0;
    } catch {}
  }
  return 1;
}

export function collectProviderSources(raw, providerLabel) {
  const sources = [];
  for (const s of raw.sources ?? []) {
    if (typeof s.url !== 'string') continue;
    const { url, headers } = unwrap(s.url);
    sources.push({
      type: inferSourceType(url, s.type),
      url,
      headers,
      quality: typeof s.quality === 'number' ? s.quality : null,
      dub: typeof s.dub === 'string' ? s.dub : null,
      provider: providerLabel,
    });
  }
  const subtitles = Array.isArray(raw.subtitles)
    ? raw.subtitles
        .filter((s) => typeof s.url === 'string')
        .map((s) => {
          // Subtitles are wrapped in the same flaky eat-peach proxy (/ts-segment).
          // Unwrap to the real CDN URL + headers so the media proxy can fetch it —
          // the eat-peach hosts block Cloudflare's datacenter IPs (→ 403).
          const { url, headers } = unwrap(s.url);
          return {
            url,
            headers,
            label: s.label ?? s.language ?? null,
            lang: s.language ?? s.lang ?? null,
          };
        })
    : [];
  return { sources, subtitles };
}

export async function fetchProvider(p, type, id, season, episode) {
  let url = `${p.api}/${p.path}/${type}/${id}`;
  if (type === 'tv') url += `/${season}/${episode}`;

  const deadline = Date.now() + PROVIDER_BUDGET_MS;
  let lastStatus = 'fail';
  for (let attempt = 0; attempt < p.attempts; attempt++) {
    // Cap each attempt to the time left in the budget so retries (after a fast
    // 403/429/dead-proxy failure) can never stack into an overrun: a slow host
    // (~11s) gets one full attempt, fast failures get several within the budget.
    const remaining = deadline - Date.now();
    if (remaining < 1500) break; // not enough time left for a useful attempt
    // A fresh (random) proxy each attempt so a single bad/slow/blocked proxy
    // can't make a provider that HAS the title look empty.
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), Math.min(ATTEMPT_TIMEOUT_MS, remaining));
    try {
      const res = await uFetch(url, {
        headers: { Referer: REFERER, 'User-Agent': UA },
        dispatcher: pickProxyAgent(),
        signal: ac.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        // 403/429/5xx are typically proxy-side (blocked/rate-limited) → retry
        // with a different proxy. A genuine "no sources" is 200 + empty list.
        lastStatus = res.status;
        continue;
      }
      let json = await res.json();
      if (json.isEncrypted) json = await decrypt(json.data);
      return { status: 200, raw: json };
    } catch (e) {
      clearTimeout(timer);
      lastStatus =
        e?.name === 'AbortError' ? 'timeout' : e instanceof Error ? e.message : String(e);
    }
  }
  return { status: lastStatus, raw: null };
}

// ---- xpass provider (play.xpass.top) ------------------------------------
// A second, independent aggregator (NOT eat-peach). Simpler than Peachify: no
// encryption, no antibot — a JWPlayer embed that inlines a `backups` array of
// /playlist.json endpoints, each returning a `file` (HLS master or MP4) on a
// Referer-gated CDN with NO ACAO (so it must go through our media proxy, which
// the manifest-rewrite + #EXTM3U body-sniff already handle, incl. the .txt/.woff2
// segment disguises). Runs CONCURRENTLY with Peachify and its results are merged.
const XPASS_BASE = 'https://play.xpass.top';
// The CDN rejects an EMPTY Referer (403); any non-empty one works. The media proxy
// replays this on every upstream manifest/segment fetch (signed into the URL).
const XPASS_CDN_HEADERS = { referer: `${XPASS_BASE}/`, 'user-agent': UA };
const XPASS_TIMEOUT_MS = 7000;
const XPASS_MAX_BACKENDS = 18; // cap parallel playlist.json fetches / sources

async function xpassFetch(url, referer) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), XPASS_TIMEOUT_MS);
  try {
    const res = await uFetch(url, {
      headers: { 'User-Agent': UA, ...(referer ? { Referer: referer } : {}) },
      dispatcher: pickProxyAgent(),
      signal: ac.signal,
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Extract an inline `var name=<json>` value from the embed HTML. Each assignment
// is in its own <script> and is NOT `;`-terminated, so we scan a balanced
// {..}/[..]/"..." span (string-aware) rather than regex to a delimiter.
function xpassInlineVar(html, name) {
  const at = html.search(new RegExp(`var\\s+${name}\\s*=\\s*`));
  if (at < 0) return null;
  let i = html.indexOf('=', at) + 1;
  while (i < html.length && /\s/.test(html[i])) i++;
  const open = html[i];
  if (open === '"') {
    const end = html.indexOf('"', i + 1);
    return end < 0 ? null : html.slice(i + 1, end);
  }
  const close = open === '{' ? '}' : open === '[' ? ']' : null;
  if (!close) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(html.slice(i, j + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

// Returns { sources, subtitles } with RAW CDN urls + headers (unsigned) — the
// shared signing loop below signs them exactly like Peachify sources.
async function fetchXpass(type, id, season, episode) {
  const path = type === 'tv' ? `/e/tv/${id}/${season}/${episode}` : `/e/movie/${id}`;
  const html = await xpassFetch(`${XPASS_BASE}${path}`, `${XPASS_BASE}/`);
  if (!html) return { sources: [], subtitles: [], stage: 'embed' };

  const data = xpassInlineVar(html, 'data');
  const backups = xpassInlineVar(html, 'backups') ?? [];
  const suburl = xpassInlineVar(html, 'suburl');
  const entries = [];
  if (data?.playlist) entries.push(data.playlist);
  for (const b of backups) if (b?.url) entries.push(b.url);
  const seen = new Set();
  const urls = entries
    .filter((u) => typeof u === 'string' && !seen.has(u) && seen.add(u))
    .slice(0, XPASS_MAX_BACKENDS);

  const resolved = await Promise.all(
    urls.map(async (u) => {
      const abs = u.startsWith('http') ? u : `${XPASS_BASE}${u}`;
      const txt = await xpassFetch(abs, `${XPASS_BASE}${path}`);
      if (!txt) return null;
      try {
        const src = JSON.parse(txt)?.playlist?.[0]?.sources?.[0];
        if (src && typeof src.file === 'string' && /^https?:\/\//.test(src.file)) {
          return {
            type: src.type === 'hls' ? 'hls' : 'mp4',
            url: src.file,
            headers: XPASS_CDN_HEADERS,
            quality: null,
            // `label` is a backend name ("VID 1"/"VIP 1"), NOT an audio language —
            // leave dub null so it doesn't pollute the player's language menu. All
            // xpass sources collapse to one Xpass/Default/Auto entry; the player
            // still fails over across every backend by URL.
            dub: null,
            provider: 'Xpass',
          };
        }
      } catch {}
      return null;
    }),
  );
  const sources = resolved.filter(Boolean);

  let subtitles = [];
  if (typeof suburl === 'string') {
    const subTxt = await xpassFetch(suburl, `${XPASS_BASE}/`);
    if (subTxt) {
      try {
        const subOrigin = new URL(suburl).origin;
        subtitles = (JSON.parse(subTxt) || [])
          .filter((s) => typeof s?.url === 'string')
          .map((s) => ({
            url: s.url.startsWith('http') ? s.url : `${subOrigin}${s.url}`,
            headers: XPASS_CDN_HEADERS,
            label: s.label ?? s.language ?? null,
            lang: s.language ?? s.lang ?? null,
          }));
      } catch {}
    }
  }
  return { sources, subtitles, stage: 'ok' };
}

// Hard ceiling on the WHOLE extraction. There's a ~20s gateway in front of this
// function (Cloudflare returns a non-JSON "error code: 502" page if we exceed it,
// which the client then can't parse). Every internal step is already bounded
// (provider budget 15s + xpass, all parallel) so we normally finish in
// ~15s — but this guarantees we ALWAYS return clean JSON before the gateway
// gives up, so the user sees "no sources" or sources, never a raw 502 timeout.
const OVERALL_DEADLINE_MS = 18000;

export default async (req) => {
  const sp = new URL(req.url).searchParams;
  const type = sp.get('type') === 'tv' ? 'tv' : 'movie';
  const id = sp.get('id');
  const season = sp.get('season');
  const episode = sp.get('episode');

  if (!id) {
    return Response.json({ ok: false, error: 'missing id' }, { status: 400 });
  }

  const timedOut = Symbol('timeout');
  const result = await Promise.race([
    resolveStream(type, id, season, episode),
    new Promise((resolve) => setTimeout(() => resolve(timedOut), OVERALL_DEADLINE_MS)),
  ]);
  if (result === timedOut) {
    // Return HTTP 200 (not 502) with ok:false. A 502 STATUS gets replaced by
    // Cloudflare's own non-JSON "error code: 502" page on the way through the
    // Pages route, which makes the client's JSON.parse throw. 200 keeps our body
    // intact; the player keys off `ok`, and no-store lets a refresh re-attempt.
    return Response.json(
      { ok: false, error: 'No sources found', debug: { deadline: true } },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  return result;
};

async function resolveStream(type, id, season, episode) {
  const debug = {};
  const rawSources = [];
  let rawSubs = [];

  // Fire EVERY provider in parallel up front (eat-peach's usa host is ~11s, so
  // running them concurrently keeps total ≈ the slowest single provider — and the
  // lower-priority results are already in flight if we end up needing them).
  const tasks = new Map(
    PROVIDERS.map((p) => [
      p.label,
      fetchProvider(p, type, id, season, episode).then((r) => ({ p, r })),
    ]),
  );

  // xpass runs CONCURRENTLY with the Peachify providers and is MERGED into the
  // result (not just a fallback) — it's an independent aggregator with broad
  // coverage. Bounded by its own per-fetch timeouts; fail-open to empty.
  const xpassTask = fetchXpass(type, id, season, episode).catch((e) => ({
    sources: [],
    subtitles: [],
    stage: `throw:${e?.message || 'err'}`,
  }));

  // Collect one provider's playable sources (mp4 first — range-seekable and more
  // reliable — then hls as an auto-advance fallback), or null if it has none.
  // Records the outcome in `debug` either way.
  const take = ({ p, r }) => {
    if (!r.raw || !hasPlayableSources(r.raw)) {
      debug[p.label] = r.status;
      return null;
    }
    const { sources, subtitles } = collectProviderSources(r.raw, p.label);
    const mp4 = sources.filter((s) => s.type === 'mp4');
    const hls = sources.filter((s) => s.type === 'hls');
    debug[p.label] = { status: r.status, mp4: mp4.length, hls: hls.length };
    return { provider: p.label, sources: [...mp4, ...hls], subtitles };
  };

  // PREFERRED providers, in strict priority order. The first that returns playable
  // sources wins outright and we STOP — never waiting on anything below it. Because
  // we await them IN ORDER, Spider finishing first can't beat a still-pending Iron:
  // we only look at Spider once Iron has SETTLED without sources. If BOTH settle
  // empty, we fall through to the remaining providers.
  const PREFERRED = ['Iron', 'Spider'];
  let chosen = null;
  for (const label of PREFERRED) {
    chosen = take(await tasks.get(label));
    if (chosen) break;
  }

  if (chosen) {
    rawSources.push(...chosen.sources);
    rawSubs = chosen.subtitles;
    debug.winner = chosen.provider;
    debug.reason = 'preferred';
  } else {
    // Iron & Spider both came back empty → merge the remaining providers
    // (Wolf/Multi/Dark), preferring mp4 across all of them over hls (goodstream),
    // matching the original fallback behavior.
    const mp4Sources = [];
    /** @type {{ provider: string, sources: typeof rawSources, subtitles: typeof rawSubs } | null} */
    let hlsFallback = null;
    let hlsFallbackScore = -1;
    for (const p of PROVIDERS) {
      if (PREFERRED.includes(p.label)) continue;
      const { r } = await tasks.get(p.label);
      if (!r.raw || !hasPlayableSources(r.raw)) {
        debug[p.label] = r.status;
        continue;
      }
      const { sources, subtitles } = collectProviderSources(r.raw, p.label);
      const mp4Only = sources.filter((s) => s.type === 'mp4');
      const hlsOnly = sources.filter((s) => s.type === 'hls');
      debug[p.label] = { status: r.status, mp4: mp4Only.length, hls: hlsOnly.length };
      if (mp4Only.length > 0) {
        mp4Sources.push(...mp4Only);
        if (rawSubs.length === 0) rawSubs = subtitles;
      }
      if (hlsOnly.length > 0) {
        const score = hlsHostScore(hlsOnly);
        if (score > hlsFallbackScore) {
          hlsFallback = { provider: p.label, sources: hlsOnly, subtitles };
          hlsFallbackScore = score;
        }
      }
    }
    if (mp4Sources.length > 0) {
      rawSources.push(...mp4Sources);
      debug.winner = mp4Sources[0].provider;
      debug.reason = 'mp4';
      debug.providersWithMp4 = [...new Set(mp4Sources.map((s) => s.provider))];
    } else if (hlsFallback) {
      rawSources.push(...hlsFallback.sources);
      rawSubs = hlsFallback.subtitles;
      debug.winner = hlsFallback.provider;
      debug.reason = 'hls-fallback';
    }
  }

  // Merge the (already-running) xpass sources alongside Peachify's. Independent
  // aggregator, broad coverage — appended so the player has both to fail over
  // across; the player ranks by type (mp4 / proxied-hls) so the best plays first.
  const xpassResult = await xpassTask;
  rawSources.push(...xpassResult.sources);
  if (rawSubs.length === 0 && xpassResult.subtitles.length > 0) rawSubs = xpassResult.subtitles;
  debug.xpass =
    xpassResult.stage === 'ok' ? { sources: xpassResult.sources.length } : xpassResult.stage;

  if (rawSources.length === 0) {
    // HTTP 200 (not 502): a 502 STATUS gets swapped for Cloudflare's non-JSON
    // "error code: 502" page as it passes back through the Pages route, breaking
    // the client's JSON.parse. 200 + ok:false delivers "no sources" cleanly; the
    // player keys off `ok`. no-store so a transient miss isn't cached/replayed.
    return Response.json(
      { ok: false, error: 'No sources found', debug },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Server-side ordering (the player re-ranks by source TYPE on top of this).
  // xpass sits just after Spider: a strong, reliable co-primary ahead of the
  // weaker Peachify fallbacks (Wolf/Multi/Dark).
  const providerRank = { Iron: 0, Spider: 1, Xpass: 2, Wolf: 3, Multi: 4, Dark: 5 };
  rawSources.sort((a, b) => {
    const ra = providerRank[a.provider] ?? 99;
    const rb = providerRank[b.provider] ?? 99;
    if (ra !== rb) return ra - rb;
    return (b.quality ?? 0) - (a.quality ?? 0);
  });

  // mp4 URLs get &v=1 so the media proxy serves them as fixed-length bounded
  // chunks (Content-Length set) — required for Chrome to treat progressive mp4
  // as seekable. HLS is segment-based and doesn't need it.
  const sources = await Promise.all(
    rawSources.map(async ({ headers, ...s }) => {
      // CF-blocked CDN (keymi) → play it straight from the browser. Hand over the
      // RAW intake URL and let the BROWSER follow keymi's 302 to the rotating
      // `cdnNNNNN` edge: the browser's request carries a Referer (our origin),
      // which is all the edge requires (verified: any non-empty Referer → 200 +
      // ACAO:*; only a MISSING Referer → 404). We must NOT pre-resolve the redirect
      // server-side — the resolved edge URL is rejected for the browser (404/405),
      // which silently broke every keymi title. (Keep the app's default
      // Referrer-Policy so the browser sends ≥ the origin across the redirect.)
      if (isClientDirectHost(s.url)) {
        return { ...s, direct: true };
      }
      const signed = await signedMediaUrl(s.url, headers);
      return { ...s, url: s.type === 'mp4' ? `${signed}&v=1` : signed };
    }),
  );
  // `&sub=1` tells the media proxy to normalize the body to WebVTT (browsers
  // ignore SRT in <track>). It's outside the signed payload — just a render hint.
  const subtitles = await Promise.all(
    rawSubs.map(async ({ headers, ...s }) => ({
      ...s,
      url: `${await signedMediaUrl(s.url, headers)}&sub=1`,
    })),
  );

  return new Response(JSON.stringify({ ok: true, data: { sources, subtitles }, debug }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 's-maxage=300',
    },
  });
}
