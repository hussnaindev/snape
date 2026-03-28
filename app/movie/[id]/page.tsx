import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { CastRail } from '@/components/cast-rail';
import { MovieCarousel } from '@/components/movie-carousel';
import { Topbar } from '@/components/topbar';
import { RatingBadge } from '@/components/ui/rating-badge';
import { TagChip } from '@/components/ui/tag-chip';
import {
  getMovieCredits,
  getMovieDetail,
  getMovieRecommendations,
} from '@/lib/tmdb';
import { tmdbImage } from '@/lib/tmdb-image';

import { WatchButtons } from './watch-buttons';

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

  const [movie, credits, recommendations] = await Promise.all([
    getMovieDetail(movieId).catch(() => null),
    getMovieCredits(movieId).catch(() => ({ cast: [], crew: [] })),
    getMovieRecommendations(movieId).catch(() => []),
  ]);

  if (!movie) notFound();

  const watchHref = `/movie/${movieId}/watch`;

  const backdrop = tmdbImage(movie.backdrop_path, 'original');
  const poster = tmdbImage(movie.poster_path, 'w342');
  const year = movie.release_date?.slice(0, 4) ?? '';
  const runtime = movie.runtime
    ? `${Math.floor(movie.runtime / 60)}h ${movie.runtime % 60}m`
    : null;

  return (
    <>
      <Topbar />
      <div>
        {/* Backdrop hero */}
        <div className="relative h-[55vh] min-h-[320px] overflow-hidden">
          {backdrop ? (
            <Image
              src={backdrop}
              alt={movie.title}
              fill
              priority
              sizes="100vw"
              className="object-cover object-top"
            />
          ) : (
            <div className="absolute inset-0 bg-white/5" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

          {/* Back button */}
          <Link
            href="/"
            className="absolute top-20 left-4 md:left-8 text-white/70 hover:text-white text-sm flex items-center gap-1 transition-colors"
          >
            ← Back
          </Link>
        </div>

        {/* Info block */}
        <div className="px-4 md:px-8 -mt-24 relative z-10">
          <div className="flex gap-5 md:gap-8">
            {/* Poster + mobile watch button */}
            <div className="flex-none flex flex-col">
              {poster && (
                <div className="w-28 md:w-40 rounded overflow-hidden shadow-2xl">
                  <div className="relative aspect-[2/3]">
                    <Image
                      src={poster}
                      alt={movie.title}
                      fill
                      sizes="(max-width: 768px) 112px, 160px"
                      className="object-cover"
                    />
                  </div>
                </div>
              )}
              <div className="md:hidden mt-4 w-28">
                <WatchButtons href={watchHref} fullWidth />
              </div>
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0 pt-4 md:pt-16">
              <h1 className="font-display text-3xl md:text-5xl font-semibold text-white leading-tight">
                {movie.title}
              </h1>
              {movie.tagline && (
                <p className="mt-1 text-white/50 italic text-sm">{movie.tagline}</p>
              )}

              {/* Metadata row */}
              <div className="flex flex-wrap items-center gap-2 mt-3 text-sm text-white/60">
                {year && <span>{year}</span>}
                {runtime && (
                  <>
                    <span className="text-white/20">·</span>
                    <span>{runtime}</span>
                  </>
                )}
                {movie.vote_average > 0 && (
                  <>
                    <span className="text-white/20">·</span>
                    <RatingBadge rating={movie.vote_average} />
                  </>
                )}
              </div>

              {/* Genre chips */}
              {movie.genres.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {movie.genres.map((g) => (
                    <TagChip key={g.id} label={g.name} />
                  ))}
                </div>
              )}

              {/* Action buttons — desktop only */}
              <div className="hidden md:block mt-5">
                <WatchButtons href={watchHref} />
              </div>
            </div>
          </div>

          {/* Synopsis */}
          {movie.overview && (
            <div className="mt-8 max-w-2xl">
              <p className="text-white/70 text-sm leading-relaxed">{movie.overview}</p>
            </div>
          )}
        </div>

        {/* Cast */}
        <div className="mt-10">
          <CastRail cast={credits.cast} />
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="mt-10 mb-16">
            <MovieCarousel title="More Like This" movies={recommendations} />
          </div>
        )}
      </div>
    </>
  );
}
