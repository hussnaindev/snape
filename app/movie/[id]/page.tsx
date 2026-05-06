import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CastRail } from '@/components/cast-rail';
import { MovieCarousel } from '@/components/movie-carousel';
import { Topbar } from '@/components/topbar';
import {
  getEmbeddableTrailerKey,
  getMovieCredits,
  getMovieDetail,
  getMovieRecommendations,
  getMovieVideos,
  getMovieWatchProviders,
} from '@/lib/tmdb';
import { tmdbImage } from '@/lib/tmdb-image';
import { getMovieEmbedUrl } from '@/lib/vsembed';
import { pickPreferredProvidersWithFallback } from '@/lib/watch-providers';

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

  const [movie, credits, recommendations, videos, providers] = await Promise.all([
    getMovieDetail(movieId).catch(() => null),
    getMovieCredits(movieId).catch(() => ({ cast: [], crew: [] })),
    getMovieRecommendations(movieId).catch(() => []),
    getMovieVideos(movieId).catch(() => ({ results: [] })),
    getMovieWatchProviders(movieId).catch(() => null),
  ]);

  if (!movie) notFound();

  const backdrop = tmdbImage(movie.backdrop_path, 'original');
  const trailerKey = await getEmbeddableTrailerKey(videos);
  const poster = tmdbImage(movie.poster_path, 'w342');
  const year = movie.release_date?.slice(0, 4) ?? '';
  const runtime = movie.runtime
    ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m`
    : null;

  const preferredProviders = pickPreferredProvidersWithFallback(providers?.results, country);
  const embedUrl = getMovieEmbedUrl(movieId);

  return (
    <>
      <Topbar />

      <div>
        <MovieDetailHero
          backdropUrl={backdrop}
          trailerKey={trailerKey}
          alt={movie.title}
          embedUrl={embedUrl}
          movieId={movieId}
          poster={poster}
          posterPath={movie.poster_path}
          backdropPath={movie.backdrop_path}
          title={movie.title}
          tagline={movie.tagline}
          year={year}
          runtime={runtime}
          rating={movie.vote_average}
          genres={movie.genres}
          providers={preferredProviders}
          overview={movie.overview ?? null}
        />

        <div className="mt-10">
          <CastRail cast={credits.cast} />
        </div>

        {recommendations.length > 0 && (
          <div className="mt-10 mb-16">
            <MovieCarousel title="More Like This" movies={recommendations} />
          </div>
        )}
      </div>
    </>
  );
}
