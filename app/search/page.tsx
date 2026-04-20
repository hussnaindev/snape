import { InfiniteMovieGrid } from '@/components/infinite-movie-grid';
import { InfiniteSeriesGrid } from '@/components/infinite-series-grid';
import { SearchActorGrid } from '@/components/search-actor-grid';
import { SearchTabChips, parseSearchTab } from '@/components/search-tab-chips';
import { Topbar } from '@/components/topbar';
import { APP_NAME } from '@/lib/config';
import { searchMovies, searchPeople, searchTvShows } from '@/lib/tmdb';
import { filterHasImages } from '@/lib/tmdb-filters';
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
  let movieSearch: Awaited<ReturnType<typeof searchMovies>> | null = null;
  let seriesSearch: Awaited<ReturnType<typeof searchTvShows>> | null = null;

  if (query) {
    try {
      if (activeTab === 'movies') {
        movieSearch = await searchMovies(query);
        movies = filterHasImages(movieSearch.results);
      } else if (activeTab === 'series') {
        seriesSearch = await searchTvShows(query);
        series = filterHasImages(seriesSearch.results);
      } else {
        people = await searchPeople(query);
      }
    } catch {
      // TMDB failure — show empty state
    }
  }

  const totalHits =
    activeTab === 'movies'
      ? (movieSearch?.total_results ?? 0)
      : activeTab === 'series'
        ? (seriesSearch?.total_results ?? 0)
        : people.length;

  const showMovieGrid =
    activeTab === 'movies' && movieSearch !== null && movieSearch.total_results > 0;
  const showSeriesGrid =
    activeTab === 'series' && seriesSearch !== null && seriesSearch.total_results > 0;

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
            {showMovieGrid && movieSearch && (
              <InfiniteMovieGrid
                key={`${query}-movies`}
                mode="search"
                query={query}
                resolvedQuery={movieSearch.resolvedQuery}
                initialMovies={movies}
                totalPages={movieSearch.total_pages}
              />
            )}
            {showSeriesGrid && seriesSearch && (
              <InfiniteSeriesGrid
                key={`${query}-series`}
                query={query}
                resolvedQuery={seriesSearch.resolvedQuery}
                initialSeries={series}
                totalPages={seriesSearch.total_pages}
              />
            )}
            {totalHits > 0 && activeTab === 'actors' && <SearchActorGrid people={people} />}
          </>
        ) : (
          <p className="text-white/50 text-sm">Search movies, TV shows, or cast names.</p>
        )}
      </main>
    </>
  );
}
