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

  if (rawSources.length === 0) {
    return Response.json({ ok: false, error: 'No sources found', debug }, { status: 502 });
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
    rawSources.map(async ({ headers, ...s }) => {
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
