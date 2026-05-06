import { extractSeriesStream } from '@/lib/stream-extractor';

export const runtime = 'edge';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string; season: string; episode: string }> },
) {
  const { id, season, episode } = await params;
  const seriesId = Number(id);
  const seasonNum = Number(season);
  const episodeNum = Number(episode);

  if (Number.isNaN(seriesId) || Number.isNaN(seasonNum) || Number.isNaN(episodeNum)) {
    return Response.json({ ok: false, error: 'Invalid params', code: 400 }, { status: 400 });
  }

  const result = await extractSeriesStream(seriesId, seasonNum, episodeNum);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error, code: 502 }, { status: 502 });
  }

  return Response.json(
    { ok: true, data: result },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
      },
    },
  );
}
