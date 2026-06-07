import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

// Extraction can't run on Cloudflare: eat-peach.sbs blocks datacenter IPs and
// CF Workers can't route fetch through an HTTP proxy. So we delegate extraction
// to the Netlify function (which routes eat-peach through a residential proxy)
// and pass its already-signed media-proxy URLs straight back to the client.
// The media itself still streams through our own /api/media-proxy (free CF egress).
const EXTRACT_URL = process.env.NETLIFY_EXTRACT_URL;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;

  if (type !== 'movie' && type !== 'tv') {
    return NextResponse.json({ ok: false, error: 'Invalid type', code: 400 }, { status: 400 });
  }
  if (!EXTRACT_URL) {
    return NextResponse.json(
      { ok: false, error: 'NETLIFY_EXTRACT_URL not configured', code: 500 },
      { status: 500 },
    );
  }

  const sp = req.nextUrl.searchParams;
  const upstream = new URL(EXTRACT_URL);
  upstream.searchParams.set('type', type);
  upstream.searchParams.set('id', id);
  if (type === 'tv') {
    upstream.searchParams.set('season', sp.get('season') ?? '');
    upstream.searchParams.set('episode', sp.get('episode') ?? '');
  }

  let res: Response;
  try {
    res = await fetch(upstream.toString(), { headers: { Accept: 'application/json' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'Extractor unreachable', code: 502 }, { status: 502 });
  }

  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control':
        process.env.NODE_ENV === 'development' ? 'no-store' : 's-maxage=300, stale-while-revalidate=600',
    },
  });
}
