import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const UPSTREAM = 'https://peachify.top';

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
  const upstreamUrl = new URL(`${UPSTREAM}/${path.join('/')}`);
  for (const [k, v] of searchParams.entries()) {
    upstreamUrl.searchParams.set(k, v);
  }

  const forwardHeaders: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    Origin: UPSTREAM,
    Referer: `${UPSTREAM}/`,
  };

  const contentType = req.headers.get('content-type');
  if (contentType) forwardHeaders['Content-Type'] = contentType;

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
