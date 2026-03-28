import { HeroSection } from '@/components/hero-section';
import { MovieCarousel } from '@/components/movie-carousel';
import { MovieGrid } from '@/components/movie-grid';
import { Topbar } from '@/components/topbar';
import { SectionDivider } from '@/components/ui/section-divider';
import {
  getNowPlayingMovies,
  getPopularMovies,
  getTopRatedMovies,
  getTrendingMovies,
} from '@/lib/tmdb';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Heroflix — Stream Movies Instantly',
};

export default async function HomePage() {
  const [trending, nowPlaying, topRated, popular] = await Promise.all([
    getTrendingMovies(),
    getNowPlayingMovies(),
    getTopRatedMovies(),
    getPopularMovies(1),
  ]);

  return (
    <>
      <Topbar />

      <div>
        {/* Hero */}
        <HeroSection movies={trending} />

        {/* Rails */}
        <div className="mt-6 flex flex-col gap-6">
          <MovieCarousel title="Trending This Week" movies={trending} />
          <MovieCarousel title="Now Playing" movies={nowPlaying} />
          <MovieCarousel title="Top Rated" movies={topRated} />
        </div>

        {/* Popular grid */}
        <div className="mt-6 mb-10">
          <div className="px-4 md:px-8 mb-4">
            <SectionDivider label="Popular on Heroflix" />
          </div>
          <MovieGrid movies={popular.results} />
        </div>
      </div>
    </>
  );
}
