import { HeroSection } from '@/components/hero-section';
import { MovieCarousel } from '@/components/movie-carousel';
import { SeriesCarousel } from '@/components/series-carousel';
import { Topbar } from '@/components/topbar';
import { APP_NAME } from '@/lib/config';
import {
  getBollywoodMovies,
  getEmbeddableTrailerKey,
  getMovieVideos,
  getMoviesByGenre,
  getNowPlayingMovies,
  getPopularSeries,
  getTopRatedMovies,
  getTopRatedSeries,
  getTrendingMovies,
  getTrendingSeries,
} from '@/lib/tmdb';
import type { Metadata } from 'next';

/** Max items shown per homepage movie/series rail. */
const CAROUSEL_LIMIT = 10;

export const metadata: Metadata = {
  title: `${APP_NAME} — Stream Movies Instantly`,
};

export default async function HomePage() {
  const [
    trending,
    nowPlaying,
    topRated,
    actionRaw,
    adventureRaw,
    thrillerRaw,
    scifiRaw,
    bollywoodRaw,
    trendingSeriesRaw,
    popularSeriesData,
    topRatedSeriesRaw,
  ] = await Promise.all([
    getTrendingMovies(),
    getNowPlayingMovies(),
    getTopRatedMovies(),
    getMoviesByGenre(28), // Action
    getMoviesByGenre(12), // Adventure
    getMoviesByGenre(53), // Thriller
    getMoviesByGenre(878), // Sci-Fi
    getBollywoodMovies(), // Bollywood
    getTrendingSeries(),
    getPopularSeries(1),
    getTopRatedSeries(),
  ]);

  // Filter out movies missing both backdrop and poster images
  function hasImages<T extends { backdrop_path: string | null; poster_path: string | null }>(
    movies: T[],
  ): T[] {
    return movies.filter((m) => m.backdrop_path !== null || m.poster_path !== null);
  }

  const [trendingFiltered, nowPlayingFiltered, topRatedFiltered] = [
    hasImages(trending),
    hasImages(nowPlaying),
    hasImages(topRated),
  ];

  // Deduplicate genre rails — exclude movies already shown in earlier sections
  const seen = new Set<number>([
    ...trendingFiltered.map((m) => m.id),
    ...nowPlayingFiltered.map((m) => m.id),
    ...topRatedFiltered.map((m) => m.id),
  ]);

  function dedupe<T extends { id: number }>(movies: T[]): T[] {
    return movies.filter((m) => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    });
  }

  const action = dedupe(hasImages(actionRaw));
  const adventure = dedupe(hasImages(adventureRaw));
  const thriller = dedupe(hasImages(thrillerRaw));
  const scifi = dedupe(hasImages(scifiRaw));
  const bollywood = dedupe(hasImages(bollywoodRaw));

  // Series — filtered for image presence
  const trendingSeries = hasImages(trendingSeriesRaw);
  const popularSeries = hasImages(popularSeriesData.results);
  const topRatedSeries = hasImages(topRatedSeriesRaw);

  // Fetch trailer keys for the 5 featured hero movies in parallel
  const featuredMovies = trendingFiltered.slice(0, 5);
  const trailerKeys = Object.fromEntries(
    await Promise.all(
      featuredMovies.map(async (m) => {
        const videos = await getMovieVideos(m.id).catch(() => ({ results: [] }));
        const key = await getEmbeddableTrailerKey(videos);
        return [m.id, key] as const;
      }),
    ),
  );

  return (
    <>
      <Topbar />

      <div>
        {/* Hero */}
        <HeroSection movies={trendingFiltered} trailerKeys={trailerKeys} />

        {/* Rails */}
        <div className="mt-6 mb-10 flex flex-col gap-3">
          <MovieCarousel
            title="Trending This Week"
            movies={trendingFiltered.slice(0, CAROUSEL_LIMIT)}
          />
          <MovieCarousel
            title="Now Playing"
            movies={nowPlayingFiltered.slice(0, CAROUSEL_LIMIT)}
          />

          {/* Series sections interleaved with movies */}
          {trendingSeries.length > 0 && (
            <SeriesCarousel
              title="Trending Series"
              series={trendingSeries.slice(0, CAROUSEL_LIMIT)}
            />
          )}

          <MovieCarousel title="Top Rated" movies={topRatedFiltered.slice(0, CAROUSEL_LIMIT)} />
          <MovieCarousel title="Action" movies={action.slice(0, CAROUSEL_LIMIT)} />

          {popularSeries.length > 0 && (
            <SeriesCarousel
              title="Popular Series"
              series={popularSeries.slice(0, CAROUSEL_LIMIT)}
            />
          )}

          <MovieCarousel title="Adventure" movies={adventure.slice(0, CAROUSEL_LIMIT)} />
          <MovieCarousel title="Thriller" movies={thriller.slice(0, CAROUSEL_LIMIT)} />

          {topRatedSeries.length > 0 && (
            <SeriesCarousel
              title="Top Rated Series"
              series={topRatedSeries.slice(0, CAROUSEL_LIMIT)}
            />
          )}

          <MovieCarousel title="Sci-Fi" movies={scifi.slice(0, CAROUSEL_LIMIT)} />
          <MovieCarousel title="Bollywood" movies={bollywood.slice(0, CAROUSEL_LIMIT)} />
        </div>
      </div>
    </>
  );
}
