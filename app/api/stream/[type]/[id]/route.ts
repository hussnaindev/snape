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
  let body: string;
  try {
    res = await fetch(upstream.toString(), { headers: { Accept: 'application/json' } });
    body = await res.text();
  } catch {
    // Network failure reaching the extractor → clean JSON, NOT a 502 (a 502 status
    // would be served as Cloudflare's non-JSON "error code: 502" page, which the
    // player can't parse). The player keys off `ok`, so 200 + ok:false is correct.
    return NextResponse.json(
      { ok: false, error: 'Extractor unreachable' },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  // Always hand the client a parseable JSON envelope at HTTP 200. The extractor
  // already returns 200 for both success and "no sources", but if it (or a gateway
  // in front of it) ever returns a non-2xx / non-JSON body — a cold-start blip, an
  // upstream 502 page — passing that through as-is makes the player's JSON.parse
  // throw. So we validate the body and, when it isn't a clean envelope, synthesize
  // an ok:false one. Only a genuine success WITH sources is cacheable; everything
  // else is no-store so a refresh re-attempts extraction.
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(body);
  } catch {
    // unparseable upstream body
  }
  const isEnvelope =
    typeof parsed === 'object' &&
    parsed !== null &&
    typeof (parsed as { ok?: unknown }).ok === 'boolean';
  const okWithSources =
    isEnvelope &&
    (parsed as { ok: boolean }).ok === true &&
    Array.isArray((parsed as { data?: { sources?: unknown } }).data?.sources) &&
    (parsed as { data: { sources: unknown[] } }).data.sources.length > 0;

  const outBody = isEnvelope ? body : JSON.stringify({ ok: false, error: 'No sources found' });
  const cacheable = res.ok && okWithSources;
  return new NextResponse(outBody, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control':
        process.env.NODE_ENV === 'development' || !cacheable
          ? 'no-store'
          : 's-maxage=300, stale-while-revalidate=600',
    },
  });
}
