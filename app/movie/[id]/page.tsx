import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';

import { CastRail } from '@/components/cast-rail';
import { MovieCarousel } from '@/components/movie-carousel';
import { Topbar } from '@/components/topbar';
import { RatingBadge } from '@/components/ui/rating-badge';
import { TagChip } from '@/components/ui/tag-chip';
import {
  getEmbeddableTrailerKey,
  getMovieCredits,
  getMovieDetail,
  getMovieRecommendations,
  getMovieVideos,
} from '@/lib/tmdb';
import { tmdbImage } from '@/lib/tmdb-image';

import { ExpandableText } from '@/components/ui/expandable-text';

import { BackdropPlayer } from './backdrop-player';
import { WatchButtons } from './watch-buttons';

export const runtime = 'edge';

// Cache the rendered page at the edge for 1 hour.
// Without this, every bot/crawler hit triggers a full SSR function invocation
// even though the underlying TMDB fetch responses are already data-cached.
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

  const [movie, credits, recommendations, videos] = await Promise.all([
    getMovieDetail(movieId).catch(() => null),
    getMovieCredits(movieId).catch(() => ({ cast: [], crew: [] })),
    getMovieRecommendations(movieId).catch(() => []),
    getMovieVideos(movieId).catch(() => ({ results: [] })),
  ]);

  if (!movie) notFound();

  const watchHref = `/movie/${movieId}/watch`;

  const backdrop = tmdbImage(movie.backdrop_path, 'original');
  const trailerKey = await getEmbeddableTrailerKey(videos);
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
        <BackdropPlayer backdropUrl={backdrop} trailerKey={trailerKey} alt={movie.title} />

        {/* Info block */}
        <div className="px-4 md:px-8 -mt-36 md:-mt-60 relative z-10">
          <div className="flex gap-4 md:gap-8 h-36 md:h-60">
            {/* Poster */}
            <div className="flex-none w-24 md:w-40 rounded overflow-hidden shadow-2xl">
              {poster && (
                <div className="relative aspect-[2/3]">
                  <Image
                    src={poster}
                    alt={movie.title}
                    fill
                    sizes="(max-width: 768px) 96px, 160px"
                    className="object-cover"
                  />
                </div>
              )}
            </div>

            {/* Details */}
            <div className="flex-1 min-w-0 overflow-hidden flex flex-col">
              <h1 className="font-body text-xl md:text-4xl font-bold text-white leading-tight line-clamp-2">
                {movie.title}
              </h1>
              {movie.tagline && (
                <p className="hidden md:block md:mt-1 text-white/50 italic text-xs truncate">
                  {movie.tagline}
                </p>
              )}

              {/* Metadata row */}
              <div className="flex flex-wrap items-center gap-1 md:gap-2 mt-0.5 md:mt-2 text-[10px] md:text-sm text-white/60">
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
                    <RatingBadge
                      rating={movie.vote_average}
                      className="text-[10px] leading-none md:text-xs px-1 md:px-1.5 py-[1px] md:py-0.5"
                    />
                  </>
                )}
              </div>

              {/* Genre chips */}
              {movie.genres.length > 0 && (
                <div className="flex flex-wrap gap-1 md:gap-2 mt-0.5 md:mt-2">
                  {/* Show Max 3 Genres */}
                  {movie.genres.slice(0, 3).map((g) => (
                    <TagChip
                      key={g.id}
                      label={g.name}
                      className="text-[9px] md:text-xs px-1.5 md:px-3 py-px md:py-1"
                    />
                  ))}
                </div>
              )}

              {/* Watch button — pinned to bottom of column */}
              <div className="md:hidden mt-auto pt-1 w-full">
                <WatchButtons href={watchHref} fullWidth />
              </div>
              <div className="hidden md:block mt-auto pt-4">
                <WatchButtons href={watchHref} />
              </div>
            </div>
          </div>

          {/* Synopsis */}
          {movie.overview && (
            <div className="mt-5 md:mt-8 max-w-2xl">
              <ExpandableText text={movie.overview} />
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
