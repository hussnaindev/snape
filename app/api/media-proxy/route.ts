import { type NextRequest, NextResponse } from 'next/server';

import {
  decodeHeaders,
  manifestScopedProxyUrl,
  signedMediaUrl,
  signManifestScope,
  type UpstreamHeaders,
  verifyManifestChild,
  verifyMediaUrl,
} from '@/lib/media-sign';

export const runtime = 'edge';

// Default upstream headers when a signed URL carries none of its own.
const PEACHIFY_REFERER = 'https://peachify.top/';
const PEACHIFY_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

function looksLikeManifest(url: string, contentType: string | null): boolean {
  if (contentType && /mpegurl/i.test(contentType)) return true;
  return /\.m3u8(\?|$)/i.test(url);
}

// goodstream (and similar HLS CDNs) serve playlists at extension-less URLs with a
// non-HLS Content-Type (`text/html`), so neither the URL nor the Content-Type
// flags them — and an un-rewritten manifest leaks its raw cross-origin segment
// URLs straight to the browser, which can't fetch them (no CORS) → hls.js dies
// with DEMUXER_ERROR_COULD_NOT_PARSE. So we also body-SNIFF for the `#EXTM3U`
// magic, but ONLY when the response could plausibly be a small text playlist:
// binary media (segments are image/png / video / multi-MB) must stream through
// untouched — sniffing would buffer them into memory.
const MANIFEST_SNIFF_MAX = 256 * 1024;
function couldBeManifest(contentType: string | null, contentLength: number | null): boolean {
  if (contentType && /mpegurl/i.test(contentType)) return true;
  if (contentType && /^(video|audio|image)\//i.test(contentType)) return false;
  if (contentLength != null && contentLength > MANIFEST_SNIFF_MAX) return false;
  return true;
}

// Peek the first bytes of a response for the `#EXTM3U` magic WITHOUT buffering a
// (possibly binary) full body: read the first chunk, then hand back a stream that
// replays it followed by the remainder.
async function peekManifest(
  res: Response,
): Promise<{ isHls: boolean; body: ReadableStream<Uint8Array> | null }> {
  const reader = res.body?.getReader();
  if (!reader) return { isHls: false, body: null };
  const { value } = await reader.read();
  const first = value ?? new Uint8Array();
  const head = new TextDecoder().decode(first.subarray(0, 16)).replace(/^﻿/, '').trimStart();
  const isHls = head.startsWith('#EXTM3U');
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      if (first.length) c.enqueue(first);
    },
    async pull(c) {
      const { value, done } = await reader.read();
      if (done) c.close();
      else if (value) c.enqueue(value);
    },
    cancel(reason) {
      reader.cancel(reason).catch(() => {});
    },
  });
  return { isHls, body };
}

// Stream a CDN response body through to the browser with CORS + seekability
// headers. Used for segments, mp4 byte ranges, and candidate-manifest bodies that
// turned out not to be manifests.
function streamMedia(body: ReadableStream<Uint8Array> | null, res: Response): NextResponse {
  const headers = new Headers(CORS);
  for (const h of ['content-type', 'content-range', 'cache-control']) {
    const v = res.headers.get(h);
    if (v !== null) headers.set(h, v);
  }
  headers.set('Accept-Ranges', 'bytes');
  const cl = res.headers.get('content-length');
  const cr = res.headers.get('content-range');
  if (cl) {
    headers.set('Content-Length', cl);
  } else if (cr) {
    const m = /bytes\s+(\d+)-(\d+)\//.exec(cr);
    if (m) headers.set('Content-Length', String(Number(m[2]) - Number(m[1]) + 1));
  }
  return new NextResponse(body, { status: res.status, headers });
}

// Cloudflare's edge cache. Caching the *rewritten* HLS manifest means the
// O(segments) URL-parsing/signing in rewriteManifest() runs at most once per
// manifest URL per TTL instead of on every fetch — that recompute was the main
// CPU cause of Error 1102 on the HLS path. Absent in `next dev` (returns null).
function edgeCache(): Cache | null {
  try {
    return (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default ?? null;
  } catch {
    return null;
  }
}

// Follow redirects MANUALLY, re-attaching our upstream headers on every hop.
// With redirect:'follow' the edge runtime applies the default referrer policy
// and DROPS the Referer on cross-origin redirects, which breaks referer-gated
// CDNs (e.g. keymi417exx's `i-arch-400` 302-redirects to a `cdnXXXXX` node that
// 404s without a Referer). Re-issuing each Location with the same headers keeps
// every hop authenticated.
async function fetchFollow(url: string, init: RequestInit, maxRedirects = 5): Promise<Response> {
  let current = url;
  for (let i = 0; i <= maxRedirects; i++) {
    const res = await fetch(current, { ...init, redirect: 'manual' });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location');
      if (!loc) return res;
      current = new URL(loc, current).toString();
      continue;
    }
    return res;
  }
  return fetch(current, { ...init, redirect: 'manual' });
}

// Fetch with backoff on 429 / 5xx. Goodstream's HLS CDN frequently 503s requests
// from Cloudflare's egress IPs under load (rate-limited) — that surfaced as a
// mid-playback segment 503 → hls.js DEMUXER_ERROR. A few spaced retries ride out
// the transient window; we discard the failed body between tries so it can't leak.
async function fetchRetry(url: string, init: RequestInit, attempts = 4): Promise<Response> {
  let last: Response | null = null;
  for (let i = 0; i < attempts; i++) {
    const res = await fetchFollow(url, init);
    if (res.status !== 429 && res.status < 500) return res;
    last = res;
    if (i < attempts - 1) {
      res.body?.cancel().catch(() => {});
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  return last as Response;
}

// Convert SubRip (SRT) to WebVTT — browsers only render VTT in <track>.
function srtToVtt(input: string): string {
  const body = input
    .replace(/^﻿/, '')
    .replace(/\r\n/g, '\n')
    // SRT cue timestamps use a comma for millis; VTT uses a dot.
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${body}`;
}

/**
 * Rewrite every URI in an HLS manifest so segments, keys, sub-playlists and
 * maps are fetched back through this proxy (resolved to absolute against the
 * manifest's own URL, then signed). The same upstream headers are propagated to
 * every child request.
 */
async function rewriteManifest(
  text: string,
  baseUrl: string,
  headers: UpstreamHeaders,
): Promise<string> {
  const lines = text.split('\n');
  const out: string[] = [];
  const scope = await signManifestScope(baseUrl, headers);
  const baseOrigin = new URL(baseUrl).origin;
  const crossOriginCache = new Map<string, string>();

  const resolve = async (uri: string): Promise<string> => {
    try {
      const abs = new URL(uri, baseUrl).toString();
      if (new URL(abs).origin === baseOrigin) {
        return manifestScopedProxyUrl(abs, scope);
      }
      const cached = crossOriginCache.get(abs);
      if (cached) return cached;
      const signed = await signedMediaUrl(abs, headers);
      crossOriginCache.set(abs, signed);
      return signed;
    } catch {
      return uri;
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      out.push(line);
      continue;
    }
    if (trimmed.startsWith('#')) {
      // Rewrite any URI="..." attribute (EXT-X-KEY / MEDIA / MAP / I-FRAME).
      const matches = [...line.matchAll(/URI="([^"]+)"/g)];
      let rewritten = line;
      for (const m of matches) {
        const signed = await resolve(m[1] as string);
        rewritten = rewritten.replace(`URI="${m[1]}"`, `URI="${signed}"`);
      }
      out.push(rewritten);
    } else {
      out.push(await resolve(trimmed));
    }
  }

  return out.join('\n');
}

export async function GET(req: NextRequest) {
  const scopedMu = req.nextUrl.searchParams.get('mu');
  const scopedMb = req.nextUrl.searchParams.get('mb');
  const scopedMs = req.nextUrl.searchParams.get('ms') ?? '';
  const scopedMh = req.nextUrl.searchParams.get('mh') ?? '';

  const raw = scopedMu ?? req.nextUrl.searchParams.get('u');
  const headersBlob = scopedMu ? scopedMh : (req.nextUrl.searchParams.get('h') ?? '');
  const sig = scopedMu ? scopedMs : (req.nextUrl.searchParams.get('s') ?? '');
  if (!raw) return new NextResponse('Missing u', { status: 400, headers: CORS });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new NextResponse('Bad url', { status: 400, headers: CORS });
  }

  if (scopedMu && scopedMb) {
    if (!(await verifyManifestChild(raw, scopedMb, scopedMh, scopedMs))) {
      return new NextResponse('Bad signature', { status: 403, headers: CORS });
    }
  } else if (!(await verifyMediaUrl(raw, headersBlob, sig))) {
    return new NextResponse('Bad signature', { status: 403, headers: CORS });
  }

  // Apply the per-source upstream headers the CDN requires (referer/origin/UA),
  // falling back to the Peachify defaults.
  const cdnHeaders = decodeHeaders(headersBlob);
  const upstreamHeaders: Record<string, string> = {
    Referer: cdnHeaders.referer ?? PEACHIFY_REFERER,
    'User-Agent': cdnHeaders['user-agent'] ?? PEACHIFY_UA,
  };
  if (cdnHeaders.origin) upstreamHeaders.Origin = cdnHeaders.origin;
  const range = req.headers.get('range');

  // mp4 video + ts segments: forward the browser's Range verbatim and stream the
  // CDN response straight through (constant Worker memory, no windowing). The
  // previous 1 MB chunking forced Chrome into a request storm on every seek
  // (each 1 MB = one Worker invocation) — the recurring Error 1102 trigger.
  if (range) upstreamHeaders.Range = range;

  // Serve a cached, already-rewritten HLS manifest if we have one. Manifests are
  // the only thing we cache and are always fetched without a Range, so gate the
  // lookup on that. (The old `.m3u8`-only check skipped extension-less goodstream
  // manifests, so they were never cache-hit.) The signed child URLs baked into it
  // never expire, so the cache entry stays valid.
  const cache = edgeCache();
  if (cache && !range) {
    const hit = await cache.match(req.url);
    if (hit) return hit;
  }

  let res: Response;
  try {
    res = await fetchRetry(target.toString(), { headers: upstreamHeaders, redirect: 'follow' });
  } catch {
    return new NextResponse('Bad gateway', { status: 502, headers: CORS });
  }

  const contentType = res.headers.get('content-type');
  const contentLength = Number(res.headers.get('content-length')) || null;

  // Subtitle: normalize to WebVTT so <track> renders it.
  if (req.nextUrl.searchParams.get('sub') === '1') {
    const text = await res.text();
    const vtt = /-->/.test(text) && !/^\s*WEBVTT/.test(text) ? srtToVtt(text) : text;
    return new NextResponse(vtt, {
      status: res.status === 206 ? 200 : res.status,
      headers: { ...CORS, 'Content-Type': 'text/vtt; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  // HLS manifest: detect by body-sniffing #EXTM3U (URL/Content-Type are unreliable
  // — goodstream serves extension-less manifests as text/html). On a genuine
  // manifest, rewrite (and sign) every child URI through the proxy and cache the
  // result so the per-segment signing isn't recomputed on every fetch (the
  // HLS-path Error 1102 cause). Anything else streams straight through — a dead
  // stream URL answering with an HTML error page sniffs as non-HLS and streams
  // through with its own status, so the player advances to the next source.
  if (couldBeManifest(contentType, contentLength)) {
    const { isHls, body } = await peekManifest(res);
    if (isHls && res.ok) {
      const text = await new Response(body).text();
      const rewritten = await rewriteManifest(text, target.toString(), cdnHeaders);
      const status = res.status === 206 ? 200 : res.status;
      const headers = {
        ...CORS,
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'public, max-age=300',
      };
      if (cache && status === 200) {
        await cache.put(req.url, new Response(rewritten, { status, headers })).catch(() => {});
      }
      return new NextResponse(rewritten, { status, headers });
    }
    return streamMedia(body, res);
  }

  // Binary media (mp4 byte ranges, ts segments): stream through.
  return streamMedia(res.body, res);
}
