import { getMoviesByGenre } from '@/lib/tmdb';
import { filterHasImages } from '@/lib/tmdb-filters';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

/** TMDB list endpoints cap at 500 pages. */
const MAX_PAGE = 500;

function parsePositivePageParam(raw: string | null): number {
  const n = Number(raw ?? '');
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), MAX_PAGE);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const genreId = Number(searchParams.get('genreId'));
  const page = parsePositivePageParam(searchParams.get('page'));

  if (!Number.isFinite(genreId) || genreId <= 0) {
    return NextResponse.json({ ok: false, error: 'Invalid genreId' }, { status: 400 });
  }

  try {
    const data = await getMoviesByGenre(genreId, page);
    const results = filterHasImages(data.results);
    return NextResponse.json({
      ok: true,
      page: data.page,
      total_pages: data.total_pages,
      total_results: data.total_results,
      results,
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'TMDB request failed' }, { status: 502 });
  }
}
