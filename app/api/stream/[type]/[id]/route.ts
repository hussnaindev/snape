import { type NextRequest, NextResponse } from 'next/server';

import { signedMediaUrl } from '@/lib/media-sign';
import { extractStreams } from '@/lib/peachify-extract';

export const runtime = 'edge';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;

  if (type !== 'movie' && type !== 'tv') {
    return NextResponse.json({ ok: false, error: 'Invalid type', code: 400 }, { status: 400 });
  }
  const tmdbId = Number.parseInt(id, 10);
  if (!Number.isFinite(tmdbId)) {
    return NextResponse.json({ ok: false, error: 'Invalid id', code: 400 }, { status: 400 });
  }

  const sp = req.nextUrl.searchParams;
  const season = type === 'tv' ? Number.parseInt(sp.get('season') ?? '', 10) : undefined;
  const episode = type === 'tv' ? Number.parseInt(sp.get('episode') ?? '', 10) : undefined;
  if (type === 'tv' && (!Number.isFinite(season) || !Number.isFinite(episode))) {
    return NextResponse.json(
      { ok: false, error: 'season and episode required for tv', code: 400 },
      { status: 400 },
    );
  }

  let result: Awaited<ReturnType<typeof extractStreams>>;
  try {
    result = await extractStreams(type, tmdbId, season, episode);
  } catch {
    return NextResponse.json({ ok: false, error: 'Extraction failed', code: 502 }, { status: 502 });
  }

  if (result.sources.length === 0) {
    return NextResponse.json({ ok: false, error: 'No sources found', code: 404 }, { status: 404 });
  }

  // Route every playable/subtitle URL through our media proxy (signed) so the
  // browser makes only same-origin, CORS-clean, referer-stripped requests.
  const data = {
    sources: await Promise.all(
      result.sources.map(async ({ headers, ...s }) => ({
        ...s,
        url: await signedMediaUrl(s.url, headers),
      })),
    ),
    subtitles: await Promise.all(
      result.subtitles.map(async (s) => ({ ...s, url: await signedMediaUrl(s.url) })),
    ),
  };

  return NextResponse.json(
    { ok: true, data },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } },
  );
}
