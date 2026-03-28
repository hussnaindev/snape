import type { TorrentioResponse } from '@/types/torrentio';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imdbId = searchParams.get('imdb_id');

  if (!imdbId) {
    return NextResponse.json(
      { ok: false, error: 'imdb_id query parameter is required', code: 400 },
      { status: 400 },
    );
  }

  const res = await fetch(`https://torrentio.strem.fun/stream/movie/${imdbId}.json`, {
    next: { revalidate: 3600 },
  });

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: 'Failed to fetch streams from Torrentio', code: res.status },
      { status: res.status },
    );
  }

  const data = (await res.json()) as TorrentioResponse;
  return NextResponse.json(
    { ok: true, data },
    { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' } },
  );
}
