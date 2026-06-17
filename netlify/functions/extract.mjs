// MovieBox extraction on Netlify (AWS Lambda) — routes the source-API calls
// through a residential/Webshare HTTP proxy (MovieBox's CDN + BFF block
// datacenter IPs). Cloudflare Workers can't use HTTP proxies in fetch, so
// extraction lives here; media streaming stays on CF.
//
// Returns sources/subtitles whose URLs are pre-signed for the Cloudflare
// /api/media-proxy endpoint (HMAC must match lib/media-sign.ts, so the same
// MEDIA_PROXY_SECRET must be set on both Netlify and Cloudflare).
//
// Env vars (set in Netlify UI):
//   PROXY_LIST          comma/newline-separated  host:port:user:pass  entries
//   MEDIA_PROXY_SECRET  same value as on Cloudflare
//   TMDB_API_KEY        for MovieBox ↔ TMDB title matching
//   MOVIEBOX_*          optional guest-session overrides (see .env.example)
//
// GET ?type=movie&id=1022789   |   ?type=tv&id=1399&season=1&episode=1

import { fetchMoviebox } from '../lib/moviebox.mjs';

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
  const sigBuf = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${absoluteUrl}\n${h}`),
  );
  const sig = [...new Uint8Array(sigBuf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const hParam = h ? `&h=${encodeURIComponent(h)}` : '';
  return `${MEDIA_PROXY_BASE}/api/media-proxy?u=${encodeURIComponent(absoluteUrl)}${hParam}&s=${sig}`;
}

async function buildSignedResponse(rawSources, rawSubs, debug) {
  if (rawSources.length === 0) {
    return Response.json(
      { ok: false, error: 'No sources found', debug },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Highest quality first; HLS/unknown quality sinks to the bottom.
  rawSources.sort((a, b) => (b.quality ?? 0) - (a.quality ?? 0));

  const sources = await Promise.all(
    rawSources.map(async ({ headers, ...s }) => {
      const signed = await signedMediaUrl(s.url, headers);
      return { ...s, url: signed };
    }),
  );
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
      'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
    },
  });
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

  const moviebox = await fetchMoviebox(type, id, season, episode);
  const debug = { moviebox: moviebox.debug, winner: 'MovieBox' };
  return buildSignedResponse(moviebox.sources, moviebox.subtitles, debug);
};
