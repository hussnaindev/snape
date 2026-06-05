import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const UPSTREAM = 'https://peachify.top';

// External proxy hosts allowed in addition to peachify.top.
// Peachify's video-source APIs (eat-peach.sbs) lock CORS to peachify.top;
// the browser is served from our domain and gets 403 when fetching directly.
// rw() in the embed injection encodes these as /~eph/{hostname}/path so we
// can proxy them server-side with Origin: https://peachify.top.
const EPH_SUFFIXES = ['.eat-peach.sbs', '.peachify.top'];

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function proxy(req: NextRequest, path: string[]): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;

  // ~eph prefix signals an external proxy host encoded by rw() in the embed injection.
  // Path shape: ["~eph", "{hostname}.eat-peach.sbs", ...rest]
  let upstreamBase = UPSTREAM;
  let upstreamPath = path;
  if (path[0] === '~eph') {
    const hostname = path[1] ?? '';
    if (!EPH_SUFFIXES.some((s) => hostname.endsWith(s))) {
      return new NextResponse('Forbidden', { status: 403 });
    }
    upstreamBase = `https://${hostname}`;
    upstreamPath = path.slice(2);
  }

  const upstreamUrl = new URL(`${upstreamBase}/${upstreamPath.join('/')}`);
  for (const [k, v] of searchParams.entries()) {
    upstreamUrl.searchParams.set(k, v);
  }

  const forwardHeaders: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    Origin: UPSTREAM,
    Referer: `${UPSTREAM}/`,
  };

  // Forward Next.js RSC protocol headers so RSC refetch requests work correctly
  // when Next.js router makes them during hydration or client-side navigation.
  const FORWARD = [
    'content-type', 'accept', 'accept-language', 'accept-encoding',
    'rsc', 'next-router-state-tree', 'next-router-prefetch', 'next-url',
    'range', 'authorization',
  ];
  for (const h of FORWARD) {
    const v = req.headers.get(h);
    if (v !== null) forwardHeaders[h] = v;
  }

  const body = req.method !== 'GET' && req.method !== 'HEAD' ? await req.arrayBuffer() : undefined;

  let res: Response;
  try {
    res = await fetch(upstreamUrl.toString(), {
      method: req.method,
      headers: forwardHeaders,
      body: body ?? null,
    });
  } catch {
    return new NextResponse('Bad Gateway', { status: 502, headers: CORS_HEADERS });
  }

  const responseBody = await res.arrayBuffer();
  const responseHeaders = new Headers(CORS_HEADERS);

  const upstreamContentType = res.headers.get('content-type');
  if (upstreamContentType) responseHeaders.set('Content-Type', upstreamContentType);

  const cacheControl = res.headers.get('cache-control');
  if (cacheControl) responseHeaders.set('Cache-Control', cacheControl);

  return new NextResponse(responseBody, { status: res.status, headers: responseHeaders });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxy(req, (await params).path);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  return proxy(req, (await params).path);
}
