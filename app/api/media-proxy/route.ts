import { type NextRequest, NextResponse } from 'next/server';

import {
  decodeHeaders,
  signedMediaUrl,
  type UpstreamHeaders,
  verifyMediaUrl,
} from '@/lib/media-sign';
import { PEACHIFY_REFERER, PEACHIFY_UA } from '@/lib/peachify-config';

export const runtime = 'edge';

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

  const resolve = async (uri: string): Promise<string> => {
    try {
      return await signedMediaUrl(new URL(uri, baseUrl).toString(), headers);
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
  const raw = req.nextUrl.searchParams.get('u');
  const headersBlob = req.nextUrl.searchParams.get('h') ?? '';
  const sig = req.nextUrl.searchParams.get('s') ?? '';
  if (!raw) return new NextResponse('Missing u', { status: 400, headers: CORS });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new NextResponse('Bad url', { status: 400, headers: CORS });
  }

  // Only serve URLs we minted — prevents open-proxy abuse while still allowing
  // the arbitrary CDN hosts that appear inside HLS manifests.
  if (!(await verifyMediaUrl(raw, headersBlob, sig))) {
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
  if (range) upstreamHeaders.Range = range;

  let res: Response;
  try {
    res = await fetch(target.toString(), { headers: upstreamHeaders, redirect: 'follow' });
  } catch {
    return new NextResponse('Bad gateway', { status: 502, headers: CORS });
  }

  const contentType = res.headers.get('content-type');

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

  // Everything else (mp4 byte ranges, ts segments, vtt subs): stream through.
  const headers = new Headers(CORS);
  for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control']) {
    const v = res.headers.get(h);
    if (v !== null) headers.set(h, v);
  }
  return new NextResponse(res.body, { status: res.status, headers });
}
