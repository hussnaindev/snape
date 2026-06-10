import { type NextRequest, NextResponse } from 'next/server';

import { movieboxAuthFromEnv, movieboxResolveSources } from '@/lib/moviebox';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
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
