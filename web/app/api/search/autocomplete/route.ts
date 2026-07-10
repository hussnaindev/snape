import { searchMovies, searchPeople, searchTvShows } from '@/lib/tmdb';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();

  if (!q || q.length < 2) {
    return NextResponse.json({ ok: true, results: { movies: [], series: [], people: [] } });
  }

  try {
    const [movies, series, people] = await Promise.all([
      searchMovies(q, 1, undefined, false),
      searchTvShows(q, 1, undefined, false),
      searchPeople(q, false),
    ]);

    return NextResponse.json({
      ok: true,
      results: {
        movies: movies.results.filter((m) => m.poster_path !== null).slice(0, 4),
        series: series.results.filter((s) => s.poster_path !== null).slice(0, 4),
        people: people.filter((p) => p.profile_path !== null).slice(0, 4),
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'TMDB request failed' }, { status: 502 });
  }
}
