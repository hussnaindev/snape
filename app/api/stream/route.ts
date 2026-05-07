import type { NextRequest } from 'next/server';

export const runtime = 'edge';

const SCRAPER_URL = process.env.SCRAPER_URL ?? 'http://localhost:4000';

interface ScraperProviderResult {
  hls_url: string | null;
  subtitles: string[];
  error: string | null;
}

interface ScraperResponse {
  success: boolean;
  results: Record<string, ScraperProviderResult>;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');
  const tmdbId = searchParams.get('tmdb_id');
  const season = searchParams.get('season');
  const episode = searchParams.get('episode');

  if (!tmdbId || (type !== 'movie' && type !== 'tv')) {
    return Response.json({ ok: false, error: 'Invalid params', code: 400 }, { status: 400 });
  }

  if (type === 'tv' && (!season || !episode)) {
    return Response.json(
      { ok: false, error: 'season and episode required for tv', code: 400 },
      { status: 400 },
    );
  }

  const params = new URLSearchParams({ type: type === 'tv' ? 'tv' : 'movie', tmdb_id: tmdbId });
  if (type === 'tv' && season && episode) {
    params.set('season', season);
    params.set('episode', episode);
  }

  try {
    const res = await fetch(`${SCRAPER_URL}/extract?${params}`, { signal: AbortSignal.timeout(60_000) });
    if (!res.ok) {
      return Response.json({ ok: false, error: `Scraper HTTP ${res.status}`, code: 502 }, { status: 502 });
    }

    const data = (await res.json()) as ScraperResponse;

    const winner = Object.values(data.results).find((r) => r.hls_url);
    if (!winner?.hls_url) {
      return Response.json({ ok: false, error: 'No stream found', code: 502 }, { status: 502 });
    }

    return Response.json({
      ok: true,
      data: { hlsUrl: winner.hls_url, subtitles: winner.subtitles },
    });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : 'Scraper unreachable', code: 503 },
      { status: 503 },
    );
  }
}
