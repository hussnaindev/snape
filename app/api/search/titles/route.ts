import { searchMovies, searchTvShows } from '@/lib/tmdb';
import { filterHasImages } from '@/lib/tmdb-filters';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const MAX_PAGE = 500;

function parsePositivePageParam(raw: string | null): number {
  const n = Number(raw ?? '');
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), MAX_PAGE);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();
  const type = searchParams.get('type');
  const page = parsePositivePageParam(searchParams.get('page'));
  const variant = searchParams.get('variant')?.trim() || undefined;
  const includeAdult = searchParams.get('adult') !== 'false';

  if (!q) {
    return NextResponse.json({ ok: false, error: 'Missing q' }, { status: 400 });
  }
  if (type !== 'movie' && type !== 'tv') {
    return NextResponse.json({ ok: false, error: 'Invalid type' }, { status: 400 });
  }
  if (page > 1 && !variant) {
    return NextResponse.json({ ok: false, error: 'Missing variant for page > 1' }, { status: 400 });
  }

  try {
    if (type === 'movie') {
      const data = await searchMovies(q, page, variant, includeAdult);
      const results = filterHasImages(data.results);
      return NextResponse.json({
        ok: true,
        page: data.page,
        total_pages: data.total_pages,
        total_results: data.total_results,
        resolvedQuery: data.resolvedQuery,
        results,
      });
    }
    const data = await searchTvShows(q, page, variant, includeAdult);
    const results = filterHasImages(data.results);
    return NextResponse.json({
      ok: true,
      page: data.page,
      total_pages: data.total_pages,
      total_results: data.total_results,
      resolvedQuery: data.resolvedQuery,
      results,
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'TMDB request failed' }, { status: 502 });
  }
}
