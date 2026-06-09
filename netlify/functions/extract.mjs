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

import { fetch as uFetch, ProxyAgent } from 'undici';

const AES_KEY_HEX = 'a8f2a1b5e9c470814f6b2c3a5d8e7f9c1a2b3c4d5e3f7a8b8cad1e2d0a4d5c5b';
const REFERER = 'https://peachify.top/';
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// Queried sequentially; mp4 from any provider beats hls-only from an earlier one.
const PROVIDERS = [
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
  const key = await crypto.subtle.importKey('raw', hexToBytes(AES_KEY_HEX), { name: 'AES-GCM' }, false, [
    'decrypt',
  ]);
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
// NOTE on the redirect (see resolveClientDirectUrl): keymi's intake host
// (`i-arch-*`) 302-redirects the playlist to a CDN edge (`cdnNNNNN`). The edge
// REQUIRES a `Referer` header — with one it returns 200 + ACAO:*, without one it
// 404s (and a 404 carries no ACAO, which the browser surfaces as a CORS error →
// hls.js DEMUXER_ERROR_COULD_NOT_PARSE). Browsers reliably send our origin as the
// Referer on a *direct* cross-origin request, but can DROP it across a *cross-
// origin redirect* (varies by browser/service-worker) → intermittent failures.
// The CDN is NOT IP-locked and tolerates a stale token, so we pre-follow the
// redirect server-side and hand the browser the already-resolved edge URL; it
// then makes one direct request (Referer present) and the redirect can't strip it.
const CLIENT_DIRECT_HOSTS = ['keymi417exx.com'];
function isClientDirectHost(rawUrl) {
  try {
    const h = new URL(rawUrl).hostname.toLowerCase();
    return CLIENT_DIRECT_HOSTS.some((d) => h === d || h.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

// Follow client-direct redirects server-side so the browser fetches the terminal
// edge URL directly (no cross-origin redirect that could strip the Referer the
// CDN requires). Manual hops; we never read the body (just the Location), so no
// segment tokens are consumed. Fail-open: on any error/timeout return the input
// URL unchanged (the browser will still try the redirecting URL, as before).
const REDIRECT_RESOLVE_TIMEOUT_MS = 4000;
async function resolveClientDirectUrl(rawUrl) {
  let url = rawUrl;
  try {
    for (let hop = 0; hop < 3; hop++) {
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), REDIRECT_RESOLVE_TIMEOUT_MS);
      try {
        const res = await uFetch(url, {
          method: 'GET',
          headers: { Referer: REFERER, 'User-Agent': UA },
          dispatcher: pickProxyAgent(),
          redirect: 'manual',
          signal: ac.signal,
        });
        // Don't download the playlist body — we only need the redirect target.
        res.body?.cancel?.();
        const loc = res.headers.get('location');
        if (res.status >= 300 && res.status < 400 && loc) {
          url = new URL(loc, url).toString();
          continue;
        }
        break; // terminal (2xx/4xx): `url` is what the browser should fetch.
      } finally {
        clearTimeout(timer);
      }
    }
  } catch {
    return rawUrl;
  }
  return url;
}

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

async function signedMediaUrl(absoluteUrl, headers) {
  const h = encodeHeaders(headers);
  const key = await getSignKey();
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${absoluteUrl}\n${h}`));
  const sig = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const hParam = h ? `&h=${encodeURIComponent(h)}` : '';
  return `${MEDIA_PROXY_BASE}/api/media-proxy?u=${encodeURIComponent(absoluteUrl)}${hParam}&s=${sig}`;
}

// ---- provider fetch -----------------------------------------------------
// Providers are queried sequentially (Iron → Spider → Wolf → Multi → Dark).
// Per-attempt timeout is kept short so several providers can be tried within
// Netlify's 10s function limit when earlier ones fail quickly.
const ATTEMPT_TIMEOUT_MS = 1800;

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

function collectProviderSources(raw, providerLabel) {
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

async function fetchProvider(p, type, id, season, episode) {
  let url = `${p.api}/${p.path}/${type}/${id}`;
  if (type === 'tv') url += `/${season}/${episode}`;

  let lastStatus = 'fail';
  for (let attempt = 0; attempt < p.attempts; attempt++) {
    // A fresh (random) proxy each attempt so a single bad/slow/blocked proxy
    // can't make a provider that HAS the title look empty.
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), ATTEMPT_TIMEOUT_MS);
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
      lastStatus = e?.name === 'AbortError' ? 'timeout' : e instanceof Error ? e.message : String(e);
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
// Hard ceiling on the whole vsembed chain. It runs sequentially after the
// Peachify loop (only when Peachify has no mp4), so this is kept tight to keep
// total extraction under Netlify's ~10s function limit.
const VSEMBED_DEADLINE_MS = 5000;
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
async function fetchVsembed(type, id, season, episode) {
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
  return { sources: [{ type: 'hls', url, headers: {}, quality: null, dub: null, provider: 'Bolt', direct: true }], stage: 'ok' };
}

export default async (req) => {
  const sp = new URL(req.url).searchParams;
  const type = sp.get('type') === 'tv' ? 'tv' : 'movie';
  const id = sp.get('id');
  const season = sp.get('season');
  const episode = sp.get('episode');

  if (!id) {
    return Response.json({ ok: false, error: 'missing id' }, { status: 400 });
  }

  const debug = {};
  const rawSources = [];
  let rawSubs = [];
  const mp4Sources = [];
  /** @type {{ provider: string, sources: typeof rawSources, subtitles: typeof rawSubs } | null} */
  let hlsFallback = null;
  let hlsFallbackScore = -1;

  // Walk Iron → Spider → Wolf → Multi → Dark. Collect mp4 from every provider;
  // only fall back to hls (goodstream) when none of them offer mp4.
  for (const p of PROVIDERS) {
    const r = await fetchProvider(p, type, id, season, episode);
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

  // vsembed runs ONLY as a true fallback — when Peachify has no mp4 (dead/weak,
  // e.g. a Multi-only title whose keymi token is dead). Healthy titles (mp4
  // present) skip it entirely, so they're never delayed by the CF-gated, possibly
  // slow vsembed chain. Appended last so the player reaches it only after the
  // Peachify sources, or uses it as the sole source when Peachify found nothing.
  if (mp4Sources.length === 0) {
    const vsembedResult = await Promise.race([
      fetchVsembed(type, id, season, episode).catch((e) => ({ sources: [], stage: `throw:${e?.message || 'err'}` })),
      new Promise((resolve) => setTimeout(() => resolve({ sources: [], stage: 'deadline' }), VSEMBED_DEADLINE_MS)),
    ]);
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
      // CF-blocked CDN → play it straight from the browser (see isClientDirectHost).
      // Pre-resolve its redirect so the browser hits the terminal edge directly,
      // avoiding the cross-origin redirect that can strip the Referer keymi needs.
      // No signing/headers: the raw CDN URL is loaded directly by our player.
      if (isClientDirectHost(s.url)) {
        return { ...s, url: await resolveClientDirectUrl(s.url), direct: true };
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
};
