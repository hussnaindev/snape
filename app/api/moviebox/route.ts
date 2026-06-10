import { type NextRequest, NextResponse } from 'next/server';

import { movieboxAuthFromEnv, movieboxResolveSources } from '@/lib/moviebox';

export const runtime = 'edge';

// MovieBox rate-limits Cloudflare egress (HTTP 429). Delegate to the Netlify
// function (residential proxy) when configured — same split as /api/stream.
function netlifyMovieboxUrl(): string | undefined {
  const explicit = process.env.NETLIFY_MOVIEBOX_URL?.trim();
  if (explicit) return explicit;
  const extract = process.env.NETLIFY_EXTRACT_URL?.trim();
  if (extract?.endsWith('/extract')) return extract.replace(/\/extract$/, '/moviebox');
  return undefined;
}

async function delegateToNetlify(req: NextRequest, upstream: string): Promise<NextResponse> {
  const target = new URL(upstream);
  for (const [k, v] of req.nextUrl.searchParams) {
    target.searchParams.set(k, v);
  }

  let res: Response;
  try {
    res = await fetch(target.toString(), { headers: { Accept: 'application/json' } });
  } catch {
    return NextResponse.json({ ok: false, error: 'MovieBox extractor unreachable' }, { status: 502 });
  }

  const body = await res.text();
  let cacheControl =
    process.env.NODE_ENV === 'development' ? 'no-store' : 's-maxage=300, stale-while-revalidate=600';
  if (res.status >= 400) {
    cacheControl = 'no-store';
  } else {
    try {
      const parsed = JSON.parse(body) as { ok?: boolean; data?: { sources?: unknown[] } };
      if (!parsed.ok || !parsed.data?.sources?.length) cacheControl = 'no-store';
    } catch {
      cacheControl = 'no-store';
    }
  }

  return new NextResponse(body, {
    status: res.status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': cacheControl },
  });
}

export async function GET(req: NextRequest) {
  const netlify = netlifyMovieboxUrl();
  if (netlify) return delegateToNetlify(req, netlify);

  const auth = movieboxAuthFromEnv();
  const sp = req.nextUrl.searchParams;
  const keyword = sp.get('q') ?? sp.get('keyword') ?? undefined;
  const subjectId = sp.get('subjectId') ?? undefined;
  const detailPath = sp.get('detailPath') ?? undefined;
  const se = Number.parseInt(sp.get('se') ?? '0', 10);
  const ep = Number.parseInt(sp.get('ep') ?? '0', 10);

  if (!keyword && !(subjectId && detailPath)) {
    return NextResponse.json(
      { ok: false, error: 'Provide q or subjectId+detailPath', code: 400 },
      { status: 400 },
    );
  }

  try {
    const data = await movieboxResolveSources({
      auth,
      ...(keyword ? { keyword } : {}),
      ...(subjectId && detailPath ? { subjectId, detailPath } : {}),
      se,
      ep,
    });

    return NextResponse.json(
      { ok: true, data: { sources: data.sources, subtitles: data.subtitles, subject: data.subject } },
      {
        headers: {
          'Cache-Control':
            process.env.NODE_ENV === 'development' ? 'no-store' : 's-maxage=300, stale-while-revalidate=600',
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'MovieBox resolve failed';
    return NextResponse.json({ ok: false, error: message }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }
}
