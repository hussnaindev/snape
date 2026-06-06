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

const PROVIDERS = [
  { label: 'Iron', path: 'moviebox', api: 'https://uwu.eat-peach.sbs' },
  { label: 'Spider', path: 'holly', api: 'https://usa.eat-peach.sbs' },
  { label: 'Wolf', path: 'air', api: 'https://usa.eat-peach.sbs' },
  { label: 'Multi', path: 'multi', api: 'https://usa.eat-peach.sbs' },
  { label: 'Dark', path: 'net', api: 'https://uwu.eat-peach.sbs' },
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
      u.pathname.includes('proxy');
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
async function signedMediaUrl(absoluteUrl, headers) {
  const h = encodeHeaders(headers);
  const key = await getSignKey();
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${absoluteUrl}\n${h}`));
  const sig = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const hParam = h ? `&h=${encodeURIComponent(h)}` : '';
  return `/api/media-proxy?u=${encodeURIComponent(absoluteUrl)}${hParam}&s=${sig}`;
}

// ---- provider fetch -----------------------------------------------------
// Per-attempt timeout and attempt count are tuned so the worst case
// (ATTEMPTS × TIMEOUT) stays under Netlify's 10s function limit, even with a
// cold start. Providers run in parallel, so total time ≈ the slowest provider.
const ATTEMPTS = 2;
const ATTEMPT_TIMEOUT_MS = 3500;

async function fetchProvider(p, type, id, season, episode) {
  let url = `${p.api}/${p.path}/${type}/${id}`;
  if (type === 'tv') url += `/${season}/${episode}`;

  let lastStatus = 'fail';
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
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

  const results = await Promise.all(PROVIDERS.map((p) => fetchProvider(p, type, id, season, episode)));

  const debug = {};
  const rawSources = [];
  let rawSubs = [];
  results.forEach((r, i) => {
    debug[PROVIDERS[i].label] = r.status;
    if (!r.raw) return;
    for (const s of r.raw.sources ?? []) {
      if (typeof s.url !== 'string') continue;
      const { url, headers } = unwrap(s.url);
      rawSources.push({
        type: s.type === 'hls' ? 'hls' : 'mp4',
        url,
        headers,
        quality: typeof s.quality === 'number' ? s.quality : null,
        dub: typeof s.dub === 'string' ? s.dub : null,
        provider: PROVIDERS[i].label,
      });
    }
    if (rawSubs.length === 0 && Array.isArray(r.raw.subtitles)) {
      rawSubs = r.raw.subtitles
        .filter((s) => typeof s.url === 'string')
        .map((s) => ({ url: s.url, label: s.label ?? s.language ?? null, lang: s.language ?? s.lang ?? null }));
    }
  });

  if (rawSources.length === 0) {
    return Response.json({ ok: false, error: 'No sources found', debug }, { status: 502 });
  }

  rawSources.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'mp4' ? -1 : 1;
    return (b.quality ?? 0) - (a.quality ?? 0);
  });

  const sources = await Promise.all(
    rawSources.map(async ({ headers, ...s }) => ({ ...s, url: await signedMediaUrl(s.url, headers) })),
  );
  // `&sub=1` tells the media proxy to normalize the body to WebVTT (browsers
  // ignore SRT in <track>). It's outside the signed payload — just a render hint.
  const subtitles = await Promise.all(
    rawSubs.map(async (s) => ({ ...s, url: `${await signedMediaUrl(s.url)}&sub=1` })),
  );

  return new Response(JSON.stringify({ ok: true, data: { sources, subtitles } }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 's-maxage=300',
    },
  });
};
