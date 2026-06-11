// Standalone Cloudflare Worker that proxies video bytes from the upstream CDNs
// to the browser. This is the same logic as the Next.js `app/api/media-proxy`
// route, but running as a *plain* Worker — no `@cloudflare/next-on-pages`
// adapter in the path. The adapter buffers/streams differently and was the
// residual cause of Error 1102 a few seconds into playback; a raw Worker streams
// `res.body` natively with constant memory and minimal CPU.

// See docs/STREAMING-ARCHITECTURE.md. Extraction (Netlify) mints the signed URLs
// pointing at this Worker (MEDIA_PROXY_BASE); this Worker verifies them.

import {
  decodeHeaders,
  initSecret,
  manifestScopedProxyUrl,
  signedMediaUrl,
  signManifestScope,
  type UpstreamHeaders,
  verifyManifestChild,
  verifyMediaUrl,
} from './sign';

interface Env {
  MEDIA_PROXY_SECRET: string;
}

// Default upstream headers when a signed URL carries none of its own.
const DEFAULT_REFERER = 'https://movie-box.co/';
const DEFAULT_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Range, Content-Type',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
};

function looksLikeManifest(url: string, contentType: string | null): boolean {
  if (contentType && /mpegurl/i.test(contentType)) return true;
  return /\.m3u8(\?|$)/i.test(url);
}

// Cloudflare's edge cache. Caching the *rewritten* HLS manifest means the
// O(segments) URL signing in rewriteManifest() runs at most once per manifest
// URL per TTL instead of on every fetch.
function edgeCache(): Cache | null {
  try {
    return (globalThis as unknown as { caches?: { default?: Cache } }).caches?.default ?? null;
  } catch {
    return null;
  }
}

// Follow redirects MANUALLY, re-attaching our upstream headers on every hop.
// With redirect:'follow' the edge runtime applies the default referrer policy
// and DROPS the Referer on cross-origin redirects. That breaks referer-gated
// CDNs: e.g. keymi417exx's `i-arch-400` host 302-redirects to a `cdnXXXXX` node
// that returns 404 unless a Referer is present, so playback dies on the very
// first manifest. Re-issuing the request to each Location with the same headers
// keeps every hop authenticated. (Other CDNs serve directly, so they were fine —
// which is why only redirecting hosts like keymi417exx broke.)
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
  // Too many redirects: do one final non-following fetch so the caller sees a real status.
  return fetch(current, { ...init, redirect: 'manual' });
}

// Fetch with a short backoff on 429 / 5xx. CDNs (esp. goodstream for HLS) can
// rate-limit Cloudflare's egress under load; a couple of quick retries smooths
// transient limits.
async function fetchRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let last: Response | null = null;
  for (let i = 0; i < attempts; i++) {
    const res = await fetchFollow(url, init);
    if (res.status !== 429 && res.status < 500) return res;
    last = res;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 250 * (i + 1)));
  }
  return last as Response;
}

// --- Parallel range accelerator for progressive MP4 -----------------------
// MovieBox's CDN throttles each TCP connection to ~130 KB/s — far below the
// video bitrate — but allows many parallel connections from the same egress IP,
// and they aggregate ~linearly (measured: 8 conns ≈ 10 Mbps, 12 ≈ 14 Mbps). So
// we serve each window as a sliding pipeline of small sub-ranges fetched
// concurrently and emitted in strict byte order, feeding the browser's single
// connection at the aggregate rate. Small chunks keep head-of-line latency low:
// the old 4 MB lead chunk streamed at one connection's rate (~1 Mbps) and timed
// out the whole window. The window is bounded so per-response memory + subrequest
// count stay small; the browser requests the next window as it plays.
const ACCEL_WINDOW = 16 * 1024 * 1024; // bytes served per response
const ACCEL_CHUNK = 1 * 1024 * 1024; // size of each parallel sub-range
const ACCEL_CONCURRENCY = 8; // sub-ranges in flight at once (→ ~8x throughput)

function parseRange(h: string | null): { start: number; end: number | null } {
  const m = /bytes=(\d+)-(\d*)/.exec(h ?? '');
  if (!m) return { start: 0, end: null };
  return { start: Number(m[1]), end: m[2] ? Number(m[2]) : null };
}

async function serveAcceleratedMp4(
  target: string,
  baseHeaders: Record<string, string>,
  rangeHeader: string,
): Promise<Response> {
  const { start, end: reqEnd } = parseRange(rangeHeader);
  const fetchChunk = (s: number, e: number) =>
    fetchRetry(target, { headers: { ...baseHeaders, Range: `bytes=${s}-${e}` } }, 2);

  // First sub-chunk also reveals the total size + whether ranges are honored.
  const firstEnd = reqEnd != null ? Math.min(reqEnd, start + ACCEL_CHUNK - 1) : start + ACCEL_CHUNK - 1;
  let first: Response;
  try {
    first = await fetchChunk(start, firstEnd);
  } catch {
    return new Response('Bad gateway', { status: 502, headers: CORS });
  }
  const contentType = first.headers.get('content-type') ?? 'video/mp4';

  // CDN ignored the range (200) → no acceleration possible; stream straight through.
  if (first.status !== 206) {
    const h = new Headers(CORS);
    h.set('Content-Type', contentType);
    h.set('Accept-Ranges', 'bytes');
    const cl = first.headers.get('content-length');
    if (cl) h.set('Content-Length', cl);
    h.set('Cache-Control', 'no-store');
    return new Response(first.body, { status: first.status, headers: h });
  }

  const cr = first.headers.get('content-range') ?? '';
  const total = (() => {
    const m = /\/(\d+)\s*$/.exec(cr);
    return m ? Number(m[1]) : null;
  })();

  // End of the window this response serves.
  let end = reqEnd != null ? reqEnd : total != null ? total - 1 : firstEnd;
  if (total != null) end = Math.min(end, total - 1);
  end = Math.min(end, start + ACCEL_WINDOW - 1);

  // Sub-range boundaries across [start, end]; chunk 0 is the response in hand.
  const ranges: Array<[number, number]> = [];
  for (let s = start; s <= end; s += ACCEL_CHUNK) {
    ranges.push([s, Math.min(s + ACCEL_CHUNK - 1, end)]);
  }

  // Each chunk resolves to its full bytes. A sliding window keeps at most
  // ACCEL_CONCURRENCY fetches in flight: a chunk is only started once the emit
  // pointer is within CONCURRENCY of it, bounding open connections + memory.
  const bodies: Array<Promise<Uint8Array> | null> = new Array(ranges.length).fill(null);
  bodies[0] = first.arrayBuffer().then((b) => new Uint8Array(b));
  let started = 1;
  const startUpTo = (emitIdx: number) => {
    const limit = Math.min(ranges.length, emitIdx + ACCEL_CONCURRENCY);
    for (; started < limit; started++) {
      const [s, e] = ranges[started] as [number, number];
      bodies[started] = fetchChunk(s, e)
        .then((r) => {
          // A stray 200 mid-window would make arrayBuffer() pull the whole file
          // (and misalign the bytes) — fail this chunk cleanly so the player
          // fails over instead.
          if (r.status !== 206) throw new Error(`range not honored: ${r.status}`);
          return r.arrayBuffer();
        })
        .then((b) => new Uint8Array(b));
    }
  };
  startUpTo(0);

  // Emit chunks in strict byte order; refill the window after each so the next
  // sub-ranges are already downloading by the time the browser reaches them.
  let emit = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (emit >= ranges.length) {
        controller.close();
        return;
      }
      try {
        const bytes = await (bodies[emit] as Promise<Uint8Array>);
        bodies[emit] = null; // release for GC
        controller.enqueue(bytes);
        emit++;
        startUpTo(emit);
        if (emit >= ranges.length) controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  const h = new Headers(CORS);
  h.set('Content-Type', contentType);
  h.set('Accept-Ranges', 'bytes');
  h.set('Content-Range', total != null ? `bytes ${start}-${end}/${total}` : `bytes ${start}-${end}/*`);
  h.set('Content-Length', String(end - start + 1));
  h.set('Cache-Control', 'no-store');
  return new Response(stream, { status: 206, headers: h });
}

// Convert SubRip (SRT) to WebVTT — browsers only render VTT in <track>.
function srtToVtt(input: string): string {
  const body = input
    .replace(/^﻿/, '')
    .replace(/\r\n/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return `WEBVTT\n\n${body}`;
}

/**
 * Rewrite every URI in an HLS manifest so segments, keys, sub-playlists and
 * maps are fetched back through this proxy (resolved to absolute against the
 * manifest's own URL, then signed). Child URLs are relative paths, which the
 * browser/hls.js resolves against the manifest URL — i.e. this Worker's origin.
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

async function handle(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  initSecret(env.MEDIA_PROXY_SECRET ?? '');

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: CORS });

  const url = new URL(req.url);
  const sp = url.searchParams;

  const scopedMu = sp.get('mu');
  const scopedMb = sp.get('mb');
  const scopedMs = sp.get('ms') ?? '';
  const scopedMh = sp.get('mh') ?? '';

  const raw = scopedMu ?? sp.get('u');
  const headersBlob = scopedMu ? scopedMh : (sp.get('h') ?? '');
  const sig = scopedMu ? scopedMs : (sp.get('s') ?? '');
  if (!raw) return new Response('Missing u', { status: 400, headers: CORS });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response('Bad url', { status: 400, headers: CORS });
  }

  if (scopedMu && scopedMb) {
    if (!(await verifyManifestChild(raw, scopedMb, scopedMh, scopedMs))) {
      return new Response('Bad signature', { status: 403, headers: CORS });
    }
  } else if (!(await verifyMediaUrl(raw, headersBlob, sig))) {
    return new Response('Bad signature', { status: 403, headers: CORS });
  }

  // Apply the per-source upstream headers the CDN requires (referer/origin/UA),
  // falling back to the MovieBox defaults.
  const cdnHeaders = decodeHeaders(headersBlob);
  const upstreamHeaders: Record<string, string> = {
    Referer: cdnHeaders.referer ?? DEFAULT_REFERER,
    'User-Agent': cdnHeaders['user-agent'] ?? DEFAULT_UA,
  };
  if (cdnHeaders.origin) upstreamHeaders.Origin = cdnHeaders.origin;

  const range = req.headers.get('range');

  // Progressive MP4 (Iron/MovieBox): the CDN throttles each connection to
  // ~6 Mbps, below the 1080p bitrate, so a single-connection download buffers.
  // Serve it via parallel sub-ranges to multiply throughput. Only mp4 sources
  // carry v=1 (HLS segments/manifests don't), so this never touches HLS.
  if (sp.get('v') === '1' && range) {
    return serveAcceleratedMp4(target.toString(), upstreamHeaders, range);
  }

  // ts segments + mp4 without a Range: forward Range verbatim and stream through.
  if (range) upstreamHeaders.Range = range;

  // Serve a cached, already-rewritten HLS manifest if we have one.
  const cache = edgeCache();
  const maybeManifest = looksLikeManifest(target.toString(), null);
  if (cache && maybeManifest) {
    const hit = await cache.match(req.url);
    if (hit) return hit;
  }

  let res: Response;
  try {
    res = await fetchRetry(target.toString(), { headers: upstreamHeaders, redirect: 'follow' });
  } catch {
    return new Response('Bad gateway', { status: 502, headers: CORS });
  }

  const contentType = res.headers.get('content-type');

  // Subtitle: normalize to WebVTT so <track> renders it.
  if (sp.get('sub') === '1') {
    const text = await res.text();
    const vtt = /-->/.test(text) && !/^\s*WEBVTT/.test(text) ? srtToVtt(text) : text;
    return new Response(vtt, {
      status: res.status === 206 ? 200 : res.status,
      headers: { ...CORS, 'Content-Type': 'text/vtt; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  // HLS manifest: buffer + rewrite (and sign) child URIs through the proxy, then
  // stash the rewritten result in the edge cache.
  if (looksLikeManifest(target.toString(), contentType)) {
    const text = await res.text();
    // A dead/expired stream URL often answers with an HTML error page (e.g. an
    // nginx "404 Not Found") while the URL still ends in .m3u8. Rewriting that as
    // a manifest turns every HTML line into a bogus segment URL, which the player
    // tries to load and dies on with "Format error" instead of cleanly advancing
    // to the next source — and an upstream 200-with-HTML would even get cached for
    // 5 min. Only rewrite a genuine manifest; otherwise fail clean and uncached.
    const isHls = text.replace(/^﻿/, '').trimStart().startsWith('#EXTM3U');
    if (!res.ok || !isHls) {
      return new Response('Upstream manifest unavailable', {
        status: res.ok ? 502 : res.status,
        headers: { ...CORS, 'Cache-Control': 'no-store' },
      });
    }
    const rewritten = await rewriteManifest(text, target.toString(), cdnHeaders);
    const status = res.status === 206 ? 200 : res.status;
    const headers = {
      ...CORS,
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'public, max-age=300',
    };
    if (cache && status === 200) {
      ctx.waitUntil(cache.put(req.url, new Response(rewritten, { status, headers })));
    }
    return new Response(rewritten, { status, headers });
  }

  // Everything else (mp4 byte ranges, ts segments): stream through.
  const headers = new Headers(CORS);
  for (const h of ['content-type', 'content-range', 'cache-control']) {
    const v = res.headers.get(h);
    if (v !== null) headers.set(h, v);
  }

  // Always advertise byte-range support so the browser treats the resource as
  // seekable.
  headers.set('Accept-Ranges', 'bytes');

  // Content-Length is essential: if it's missing the response goes out chunked,
  // and Chrome's media stack treats a length-less stream as non-seekable. Derive
  // it from Content-Range when the upstream drops it.
  const cl = res.headers.get('content-length');
  const cr = res.headers.get('content-range');
  if (cl) {
    headers.set('Content-Length', cl);
  } else if (cr) {
    const m = /bytes\s+(\d+)-(\d+)\//.exec(cr);
    if (m) headers.set('Content-Length', String(Number(m[2]) - Number(m[1]) + 1));
  }

  return new Response(res.body, { status: res.status, headers });
}

export default {
  fetch: handle,
};
