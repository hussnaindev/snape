import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CastRail } from '@/components/cast-rail';
import { MovieCarousel } from '@/components/movie-carousel';
import {
  getEmbeddableTrailerKey,
  getMovieCredits,
  getMovieDetail,
  getMovieImages,
  getMovieRecommendations,
  getMovieVideos,
  getMovieWatchProviders,
} from '@/lib/tmdb';
import { tmdbImage } from '@/lib/tmdb-image';
import { pickPreferredProvidersWithFallback } from '@/lib/watch-providers';

import { ParallaxContent } from '@/components/parallax-content';

import { MovieDetailHero } from './movie-detail-hero';

export const runtime = 'edge';
export const revalidate = 3600;

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const movieId = Number(id);
  if (Number.isNaN(movieId)) return {};
  try {
    const movie = await getMovieDetail(movieId);
    return { title: movie.title };
  } catch {
    return {};
  }
}

export default async function MoviePage({ params }: Props) {
  const { id } = await params;
  const movieId = Number(id);
  if (Number.isNaN(movieId)) notFound();

  const country = 'US';

  const movie = await getMovieDetail(movieId).catch(() => null);
  if (!movie) notFound();

  const genreIds = movie.genres.map((g) => g.id);
  const [credits, recommendations, videos, providers, images] = await Promise.all([
    getMovieCredits(movieId).catch(() => ({ cast: [], crew: [] })),
    getMovieRecommendations(movieId, genreIds).catch(() => []),
    getMovieVideos(movieId).catch(() => ({ results: [] })),
    getMovieWatchProviders(movieId).catch(() => null),
    getMovieImages(movieId).catch(() => ({ id: 0, backdrops: [], logos: [], posters: [] })),
  ]);

  const backdrop = tmdbImage(movie.backdrop_path, 'original');
  const trailerKey = await getEmbeddableTrailerKey(videos);
  const poster = tmdbImage(movie.poster_path, 'w500');
  const year = movie.release_date?.slice(0, 4) ?? '';
  const runtime = movie.runtime
    ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m`
    : null;

  const preferredProviders = pickPreferredProvidersWithFallback(providers?.results, country);

  const logoPath = images.logos.find((l) => l.iso_639_1 === 'en')?.file_path
    ?? images.logos[0]?.file_path
    ?? null;
  const logoUrl = logoPath ? tmdbImage(logoPath, 'w500') : null;

  return (
    <>
      <div>
        <MovieDetailHero
          backdropUrl={backdrop}
          trailerKey={trailerKey}
          alt={movie.title}
          movieId={movieId}
          poster={poster}
          posterPath={movie.poster_path}
          backdropPath={movie.backdrop_path}
          title={movie.title}
          logoUrl={logoUrl}
          tagline={movie.tagline}
          year={year}
          runtime={runtime}
          rating={movie.vote_average}
          genres={movie.genres}
          providers={preferredProviders}
          overview={movie.overview ?? null}
        />

        <section className="mt-10">
          <ParallaxContent direction="right" speed={120}>
            <CastRail cast={credits.cast} />
          </ParallaxContent>
        </section>

        {recommendations.length > 0 && (
          <section className="mt-10 mb-16">
            <ParallaxContent direction="left" speed={120}>
              <MovieCarousel title="More Like This" movies={recommendations} />
            </ParallaxContent>
          </section>
        )}
      </div>
    </>
  );
}
