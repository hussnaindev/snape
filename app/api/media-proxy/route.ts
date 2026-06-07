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

// Size of each mp4 chunk window. Keep modest — buffering multi-MB responses in
// the Worker on every scrub/seek burns CPU and triggers Cloudflare Error 1102.
const MP4_CHUNK = 1024 * 1024;

// Fetch with a short backoff on 429 / 5xx. CDNs (esp. goodstream for HLS) can
// rate-limit Cloudflare's egress under load; a couple of quick retries smooths
// transient limits.
async function fetchRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let last: Response | null = null;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, init);
    if (res.status !== 429 && res.status < 500) return res;
    last = res;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 250 * (i + 1)));
  }
  return last as Response;
}

async function readUpTo(body: ReadableStream<Uint8Array>, max: number): Promise<Uint8Array> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < max) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      const room = max - total;
      const slice = value.byteLength <= room ? value : value.subarray(0, room);
      chunks.push(slice);
      total += slice.byteLength;
      if (slice.byteLength < value.byteLength) break;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.byteLength;
  }
  return out;
}

// Serve a progressive mp4 as a fixed-length, range-correct partial response.
// The browser sends `Range: bytes=N-`; we fetch a bounded window from the CDN
// and stream it back with explicit Content-Length + Content-Range so scrubbing
// works without buffering the whole chunk into Worker memory.
async function serveRangedMp4(
  target: string,
  baseHeaders: Record<string, string>,
  rangeHeader: string | null,
): Promise<NextResponse> {
  let start = 0;
  let reqEnd: number | null = null;
  if (rangeHeader) {
    const m = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
    if (m) {
      start = Number(m[1]);
      reqEnd = m[2] ? Number(m[2]) : null;
    }
  }
  const end = reqEnd != null ? Math.min(reqEnd, start + MP4_CHUNK - 1) : start + MP4_CHUNK - 1;

  let res: Response;
  try {
    res = await fetchRetry(
      target,
      { headers: { ...baseHeaders, Range: `bytes=${start}-${end}` }, redirect: 'follow' },
      2,
    );
  } catch {
    return new NextResponse('Bad gateway', { status: 502, headers: CORS });
  }

  // If the CDN ignored the range (200), never pipe the whole file through the
  // Worker — read at most one chunk (common cause of Error 1102 on seek).
  if (res.status === 200) {
    const h = new Headers(CORS);
    h.set('Content-Type', res.headers.get('content-type') ?? 'video/mp4');
    h.set('Accept-Ranges', 'bytes');
    h.set('Cache-Control', 'no-store');
    if (rangeHeader && res.body) {
      const limited = await readUpTo(res.body, MP4_CHUNK);
      h.set('Content-Length', String(limited.byteLength));
      h.set('Content-Range', `bytes ${start}-${start + limited.byteLength - 1}/*`);
      return new NextResponse(limited as unknown as BodyInit, { status: 206, headers: h });
    }
    const cl = res.headers.get('content-length');
    if (cl) h.set('Content-Length', cl);
    return new NextResponse(res.body, { status: 200, headers: h });
  }

  const h = new Headers(CORS);
  h.set('Content-Type', res.headers.get('content-type') ?? 'video/mp4');
  h.set('Accept-Ranges', 'bytes');
  h.set('Cache-Control', 'no-store');
  const upstreamCl = res.headers.get('content-length');
  const upstreamCr = res.headers.get('content-range');
  if (upstreamCl) {
    h.set('Content-Length', upstreamCl);
  } else if (upstreamCr) {
    const m = /bytes\s+(\d+)-(\d+)\//.exec(upstreamCr);
    if (m) h.set('Content-Length', String(Number(m[2]) - Number(m[1]) + 1));
  }
  if (upstreamCr) h.set('Content-Range', upstreamCr);
  else h.set('Content-Range', `bytes ${start}-${end}/*`);

  // Stream through when we can derive Content-Length — avoids arrayBuffer CPU.
  if (h.has('Content-Length') && res.body) {
    return new NextResponse(res.body, { status: 206, headers: h });
  }

  const buf = await res.arrayBuffer();
  h.set('Content-Length', String(buf.byteLength));
  return new NextResponse(buf, { status: 206, headers: h });
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

  // mp4 video: serve fixed-length bounded chunks so Chrome can seek.
  if (req.nextUrl.searchParams.get('v') === '1') {
    return serveRangedMp4(target.toString(), upstreamHeaders, range);
  }

  if (range) upstreamHeaders.Range = range;

  let res: Response;
  try {
    res = await fetchRetry(target.toString(), { headers: upstreamHeaders, redirect: 'follow' });
  } catch {
    return new NextResponse('Bad gateway', { status: 502, headers: CORS });
  }

  const contentType = res.headers.get('content-type');

  // Subtitle: normalize to WebVTT so <track> renders it.
  if (req.nextUrl.searchParams.get('sub') === '1') {
    const text = await res.text();
    const vtt = /-->/.test(text) && !/^\s*WEBVTT/.test(text) ? srtToVtt(text) : text;
    return new NextResponse(vtt, {
      status: res.status === 206 ? 200 : res.status,
      headers: { ...CORS, 'Content-Type': 'text/vtt; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }

  // HLS manifest: buffer + rewrite (and sign) child URIs through the proxy.
  if (looksLikeManifest(target.toString(), contentType)) {
    const text = await res.text();
    const rewritten = await rewriteManifest(text, target.toString(), cdnHeaders);
    return new NextResponse(rewritten, {
      status: res.status === 206 ? 200 : res.status,
      headers: {
        ...CORS,
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Cache-Control': 'no-store',
      },
    });
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

  // Content-Length is essential: if it's missing the response goes out
  // chunked, and Chrome's media stack treats a length-less stream as
  // non-seekable (fast-forward/scrub silently fail). The runtime can drop the
  // upstream Content-Length when we re-stream the body, so derive it from the
  // Content-Range (end - start + 1) and set it explicitly.
  const cl = res.headers.get('content-length');
  const cr = res.headers.get('content-range');
  if (cl) {
    headers.set('Content-Length', cl);
  } else if (cr) {
    const m = /bytes\s+(\d+)-(\d+)\//.exec(cr);
    if (m) headers.set('Content-Length', String(Number(m[2]) - Number(m[1]) + 1));
  }

  return new NextResponse(res.body, { status: res.status, headers });
}
