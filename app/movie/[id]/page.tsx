import type { Metadata } from 'next';
import Image from 'next/image';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { CastRail } from '@/components/cast-rail';
import { MovieCarousel } from '@/components/movie-carousel';
import { Topbar } from '@/components/topbar';
import { RatingBadge } from '@/components/ui/rating-badge';
import { TagChip } from '@/components/ui/tag-chip';
import { WatchProvidersRow } from '@/components/watch-providers-row';
import {
  getEmbeddableTrailerKey,
  getMovieCredits,
  getMovieDetail,
  getMovieRecommendations,
  getMovieVideos,
  getMovieWatchProviders,
} from '@/lib/tmdb';
import { tmdbImage } from '@/lib/tmdb-image';
import { pickPreferredProviders } from '@/lib/watch-providers';

import { ExpandableText } from '@/components/ui/expandable-text';
import { WatchlistButton } from '@/components/watchlist-button';

import { BackdropPlayer } from './backdrop-player';
import { WatchButtons } from './watch-buttons';

export const runtime = 'edge';
export const revalidate = 3600;

interface Props {
  params: Promise<{ id: string }>;
}

async function getRequestCountry(): Promise<string> {
  const h = await headers();
  const raw =
    h.get('cf-ipcountry') ??
    h.get('x-vercel-ip-country') ??
    h.get('x-country-code') ??
    h.get('x-country') ??
    '';
  const country = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(country) ? country : 'US';
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

  const country = await getRequestCountry();

  const [movie, credits, recommendations, videos, providers] = await Promise.all([
    getMovieDetail(movieId).catch(() => null),
    getMovieCredits(movieId).catch(() => ({ cast: [], crew: [] })),
    getMovieRecommendations(movieId).catch(() => []),
    getMovieVideos(movieId).catch(() => ({ results: [] })),
    getMovieWatchProviders(movieId).catch(() => null),
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

  const preferredProviders = pickPreferredProviders(providers?.results?.[country]);

  return (
    <>
      <Topbar />

      <div>
        <BackdropPlayer backdropUrl={backdrop} trailerKey={trailerKey} alt={movie.title} />

        <div className="px-4 md:px-8 -mt-36 md:-mt-60 relative z-10">
          {/* MAIN ROW */}
          <div className="flex gap-4 md:gap-8 items-stretch">
            {/* POSTER */}
            <div className="flex-none w-24 md:w-40">
              {poster && (
                <div className="relative aspect-[2/3] w-full h-full rounded overflow-hidden shadow-2xl">
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

            {/* DETAILS */}
            <div className="flex-1 min-w-0 flex flex-col justify-between">
              {/* TOP CONTENT */}
              <div className="min-w-0">
                <h1 className="font-body text-xl md:text-4xl font-bold text-white leading-tight line-clamp-2">
                  {movie.title}
                </h1>

                {movie.tagline && (
                  <p className="hidden md:block mt-1 text-white/50 italic text-xs truncate">
                    {movie.tagline}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-1 md:gap-2 mt-1 text-[10px] md:text-sm text-white/60">
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

                {movie.genres.length > 0 && (
                  <div className="flex flex-nowrap gap-1 md:gap-2 mt-2 overflow-x-auto no-scrollbar">
                    {movie.genres.slice(0, 3).map((g) => (
                      <TagChip key={g.id} label={g.name} />
                    ))}
                  </div>
                )}

                <WatchProvidersRow providers={preferredProviders} />
              </div>

              {/* BOTTOM ACTIONS */}
              <div className="pt-2 flex items-center gap-2 shrink-0">
                <WatchButtons href={watchHref} fullWidth className="md:hidden" />
                <WatchButtons href={watchHref} className="hidden md:flex" />

                <WatchlistButton
                  tmdbId={movieId}
                  mediaType="movie"
                  iconOnly
                  className="md:hidden"
                />
                <WatchlistButton
                  tmdbId={movieId}
                  mediaType="movie"
                  className="hidden md:inline-flex"
                />
              </div>
            </div>
          </div>

          {/* SYNOPSIS */}
          {movie.overview && (
            <div className="mt-5 md:mt-8 max-w-2xl">
              <ExpandableText text={movie.overview} />
            </div>
          )}
        </div>

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