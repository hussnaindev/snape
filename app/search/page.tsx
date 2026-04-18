import { MovieGrid } from '@/components/movie-grid';
import { SearchActorGrid } from '@/components/search-actor-grid';
import { SearchTabChips, parseSearchTab } from '@/components/search-tab-chips';
import { SeriesGrid } from '@/components/series-grid';
import { Topbar } from '@/components/topbar';
import { APP_NAME } from '@/lib/config';
import { searchMovies, searchPeople, searchTvShows } from '@/lib/tmdb';
import type { TMDBMovie, TMDBPersonSearchHit, TMDBSeries } from '@/types/tmdb';
import type { Metadata } from 'next';

export const runtime = 'edge';
/** New `?q=` / `?tab=` values must always hit the server. */
export const dynamic = 'force-dynamic';

interface Props {
  searchParams: Promise<{ q?: string; tab?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `"${q}" — ${APP_NAME}` : `Search — ${APP_NAME}` };
}

export default async function SearchPage({ searchParams }: Props) {
  const { q, tab } = await searchParams;
  const query = q?.trim() ?? '';
  const activeTab = parseSearchTab(tab);

  let movies: TMDBMovie[] = [];
  let series: TMDBSeries[] = [];
  let people: TMDBPersonSearchHit[] = [];

  if (query) {
    try {
      if (activeTab === 'movies') {
        movies = await searchMovies(query);
      } else if (activeTab === 'series') {
        series = await searchTvShows(query);
      } else {
        people = await searchPeople(query);
      }
    } catch {
      // TMDB failure — show empty state
    }
  }

  const totalHits =
    activeTab === 'movies' ? movies.length : activeTab === 'series' ? series.length : people.length;

  return (
    <>
      <Topbar />
      <main className="pt-24 pb-16 px-4 md:px-8">
        {query ? (
          <>
            <h1 className="text-white text-xl font-semibold mb-2">
              {totalHits > 0 ? `Results for "${query}"` : `No results for "${query}"`}
            </h1>
            <SearchTabChips query={query} active={activeTab} />
            {totalHits > 0 && activeTab === 'movies' && <MovieGrid movies={movies} />}
            {totalHits > 0 && activeTab === 'series' && <SeriesGrid series={series} />}
            {totalHits > 0 && activeTab === 'actors' && <SearchActorGrid people={people} />}
          </>
        ) : (
          <p className="text-white/50 text-sm">Search movies, TV shows, or cast names.</p>
        )}
      </main>
    </>
  );
}
