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
// Up to `max` DISTINCT proxy agents in random order — so a one-per-proxy parallel
// sweep covers the whole pool (and is guaranteed to include any good IP when the
// pool is small) instead of random draws that can repeat or miss it.
function distinctProxyAgents(max) {
  const arr = [...PROXIES];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, max).map((url) => new ProxyAgent(url));
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
// vsembed runs CONCURRENTLY with the providers (see handler) — it overlaps the
// up-to-20s provider wait instead of adding to it, so total stays under Netlify's
// 26s limit and a slow/hanging provider can never starve the fallback.

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

// ---- vsembed fallback provider (vidsrc / cloudnestra clone) -------------
// Independent of eat-peach. Used as a LAST-resort source (appended after every
// Peachify source) so the player auto-advances to it when a Peachify CDN token
// is dead (e.g. an expired keymi URL on a Multi-only title). Chain:
//   1. GET vsembed.ru/embed/{movie/<tmdbId> | tv/<tmdbId>/<s>/<e>}
//      → the "CloudStream Pro" player_iframe: //<rcpDomain>/rcp/<hash>
//        (rcpDomain rotates — cloudnestra/cloudorchestranova/… — so read it
//         from the page, never hardcode it).
//   2. GET <rcpDomain>/rcp/<hash>      → `src: '/prorcp/<id>'`
//   3. GET <rcpDomain>/prorcp/<id>     → Playerjs `file: "<m3u8> or <m3u8>"`
// The resolved m3u8 lives on a rotating `*.space` CDN that sends `ACAO: *` and
// needs no Referer, so we play it CLIENT-DIRECT (raw URL, no media proxy).
const VSEMBED_BASE = 'https://vsembed.ru';
const VSEMBED_TIMEOUT_MS = 4000;
// Hard ceiling on the whole vsembed chain. It runs CONCURRENTLY with the providers
// and is only awaited when they yield no mp4, so keep it <= PROVIDER_BUDGET_MS — it
// then never extends the total beyond the provider wait, while still giving the
// multi-hop chain (embed → rcp → CF-gated prorcp sweep, ~6-8s) room to finish.
const VSEMBED_DEADLINE_MS = 13000;
// cloudnestra's /prorcp endpoint is Cloudflare-protected: it 403s datacenter IPs
// (so a direct Netlify fetch fails) and serves a small CF challenge page to most
// proxy IPs — only a fraction of residential-proxy IPs pass. The embed/rcp hops
// pass on most IPs, and the /prorcp LINK is portable across IPs, so we fetch
// embed+rcp once, then fire the prorcp fetch through one-per-DISTINCT-proxy in
// parallel and take the first that returns the real player (failures are tiny
// ~3KB CF challenge pages, so sweeping the whole pool is cheap).
const VSEMBED_PRORCP_MAX_PROXIES = 24;
const VSEMBED_HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function vsFetch(url, referer, dispatcher) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), VSEMBED_TIMEOUT_MS);
  try {
    const res = await uFetch(url, {
      headers: { ...VSEMBED_HEADERS, ...(referer ? { Referer: referer } : {}) },
      ...(dispatcher ? { dispatcher } : {}),
      signal: ac.signal,
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// embed/rcp pass on most IPs — try direct (works in dev where there's no proxy),
// then a couple of random proxy attempts.
async function vsFetchPage(url, referer) {
  let r = await vsFetch(url, referer);
  for (let i = 0; !r && i < 2; i++) r = await vsFetch(url, referer, pickProxyAgent());
  return r;
}

// Returns { sources, stage } — `stage` is the last hop reached, surfaced in the
// response `debug` so a prod failure is diagnosable without guessing.
export async function fetchVsembed(type, id, season, episode) {
  const embedUrl =
    type === 'tv'
      ? `${VSEMBED_BASE}/embed/tv/${id}/${season}/${episode}`
      : `${VSEMBED_BASE}/embed/movie/${id}`;
  const embed = await vsFetchPage(embedUrl, VSEMBED_BASE);
  if (!embed) return { sources: [], stage: 'embed' };
  // CloudStream Pro = the iframe's own rcp hash (the other listed servers are
  // separate, less reliable embed chains we don't follow).
  const iframe = embed.match(/id="player_iframe"\s+src="\/\/([^/"]+)\/rcp\/([^"]+)"/);
  if (!iframe) return { sources: [], stage: 'iframe' };
  const rcpDomain = iframe[1];
  const rcp = await vsFetchPage(`https://${rcpDomain}/rcp/${iframe[2]}`, `${VSEMBED_BASE}/`);
  if (!rcp) return { sources: [], stage: 'rcp' };
  const pro = rcp.match(/src:\s*'(\/prorcp\/[^']+)'/);
  if (!pro) return { sources: [], stage: 'prorcp-link' };
  const proUrl = `https://${rcpDomain}${pro[1]}`;
  const proRef = `https://${rcpDomain}/`;
  // Sweep the CF-gated prorcp across distinct proxies in parallel; first proxy
  // that returns a player exposing a `file:` m3u8 wins. (The link is IP-portable,
  // and trying each proxy once guarantees a small pool's good IP is included.)
  const attempt = (dispatcher) => async () => {
    const player = await vsFetch(proUrl, proRef, dispatcher);
    const file = player?.match(/file:\s*"([^"]+)"/);
    // `file` can be "<url1> or <url2>" (mirrors) — take the first valid m3u8.
    const url = file?.[1]
      .split(/\s+or\s+/)
      .map((s) => s.trim())
      .find((u) => /^https?:\/\/\S+\.m3u8/i.test(u));
    if (!url) throw new Error('no-file');
    return url;
  };
  const agents = distinctProxyAgents(VSEMBED_PRORCP_MAX_PROXIES);
  const sweep = (agents.length ? agents : [undefined]).map((a) => attempt(a)());
  let url;
  try {
    url = await Promise.any(sweep);
  } catch {
    return { sources: [], stage: 'prorcp-cf' };
  }
  return {
    sources: [
      { type: 'hls', url, headers: {}, quality: null, dub: null, provider: 'Bolt', direct: true },
    ],
    stage: 'ok',
  };
}

// Hard ceiling on the WHOLE extraction. There's a ~20s gateway in front of this
// function (Cloudflare returns a non-JSON "error code: 502" page if we exceed it,
// which the client then can't parse). Every internal step is already bounded
// (provider budget 15s, vsembed 13s, all parallel) so we normally finish in
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
    // Bounded so this is rare; return clean JSON (not a gateway 502) so the player
    // shows "no sources" cleanly and a refresh re-attempts (no-store).
    return Response.json(
      { ok: false, error: 'No sources found', debug: { deadline: true } },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
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

  // Kick vsembed off NOW, in parallel with the providers, so a slow/hanging
  // Peachify provider (e.g. usa's holly backend hangs >30s for some titles) can't
  // starve this last-resort chain. It's bounded by VSEMBED_DEADLINE_MS and overlaps
  // the provider wait; we only AWAIT/use its result below when the providers yield
  // no mp4, so healthy titles return immediately and pay no latency for it.
  const vsembedTask = Promise.race([
    fetchVsembed(type, id, season, episode).catch((e) => ({
      sources: [],
      stage: `throw:${e?.message || 'err'}`,
    })),
    new Promise((resolve) =>
      setTimeout(() => resolve({ sources: [], stage: 'deadline' }), VSEMBED_DEADLINE_MS),
    ),
  ]);

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

  // Use the (already-running) vsembed result ONLY as a true fallback — when the
  // Peachify providers produced no mp4 (dead/weak, or all timed out/hung). It ran
  // concurrently above, so awaiting it here adds no latency beyond its own
  // deadline; healthy mp4 titles ignore its result and return immediately. It's
  // appended last (providerRank 99) so the player reaches it only after any
  // Peachify sources, or uses it as the sole source when Peachify found nothing.
  if (!rawSources.some((s) => s.type === 'mp4')) {
    const vsembedResult = await vsembedTask;
    rawSources.push(...vsembedResult.sources);
    debug.vsembed = vsembedResult.stage;
  } else {
    debug.vsembed = 'skipped(mp4)';
  }

  if (rawSources.length === 0) {
    // no-store so a transient "no sources" isn't cached and replayed on refresh.
    return Response.json(
      { ok: false, error: 'No sources found', debug },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const providerRank = Object.fromEntries(PROVIDERS.map((p, i) => [p.label, i]));
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
    rawSources.map(async ({ headers, direct, ...s }) => {
      // vsembed's CDN (pre-marked direct) sends ACAO:* and needs no Referer →
      // load the raw URL straight from the browser, no media proxy / signing.
      if (direct) return { ...s, direct: true };
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
