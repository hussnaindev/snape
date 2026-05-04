import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { BackdropPlayer } from '@/app/movie/[id]/backdrop-player';
import { CastRail } from '@/components/cast-rail';
import { SeriesCarousel } from '@/components/series-carousel';
import { Topbar } from '@/components/topbar';
import { ExpandableText } from '@/components/ui/expandable-text';
import { RatingBadge } from '@/components/ui/rating-badge';
import { TagChip } from '@/components/ui/tag-chip';
import { WatchProvidersRow } from '@/components/watch-providers-row';
import {
  getEmbeddableTrailerKey,
  getSeriesCredits,
  getSeriesDetail,
  getSeriesRecommendations,
  getSeriesSeason,
  getSeriesVideos,
  getSeriesWatchProviders,
} from '@/lib/tmdb';
import { tmdbImage } from '@/lib/tmdb-image';
import { cn } from '@/lib/utils';
import { pickPreferredProvidersWithFallback } from '@/lib/watch-providers';

import { WatchlistButton } from '@/components/watchlist-button';
import { EpisodeGuide } from './episode-guide';

export const runtime = 'edge';
export const revalidate = 3600;

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const seriesId = Number(id);
  if (Number.isNaN(seriesId)) return {};
  try {
    const series = await getSeriesDetail(seriesId);
    return { title: series.name };
  } catch {
    return {};
  }
}

const STATUS_COLORS: Record<string, string> = {
  'Returning Series': 'text-green-400 border-green-400/40 bg-green-400/10',
  'In Production': 'text-blue-400 border-blue-400/40 bg-blue-400/10',
  Ended: 'text-white/40 border-white/20 bg-white/5',
  Canceled: 'text-red-400 border-red-400/40 bg-red-400/10',
};

export default async function SeriesPage({ params }: Props) {
  const { id } = await params;
  const seriesId = Number(id);
  if (Number.isNaN(seriesId)) notFound();

  const country = 'US';

  const [series, credits, recommendations, videos, providers] = await Promise.all([
    getSeriesDetail(seriesId).catch(() => null),
    getSeriesCredits(seriesId).catch(() => ({ cast: [], crew: [] })),
    getSeriesRecommendations(seriesId).catch(() => []),
    getSeriesVideos(seriesId).catch(() => ({ results: [] })),
    getSeriesWatchProviders(seriesId).catch(() => null),
  ]);

  if (!series) notFound();

  const trailerKey = await getEmbeddableTrailerKey(videos);
  const backdrop = tmdbImage(series.backdrop_path, 'original');
  const poster = tmdbImage(series.poster_path, 'w342');

  const startYear = series.first_air_date?.slice(0, 4) ?? '';
  const endYear = series.last_air_date?.slice(0, 4) ?? '';
  const yearRange =
    startYear && endYear && endYear !== startYear
      ? `${startYear} – ${endYear}`
      : startYear && series.status === 'Returning Series'
        ? `${startYear} – Present`
        : startYear;

  const mainSeasons = series.seasons.filter(
    (s) => s.season_number !== 0 && s.episode_count > 0,
  );
  const firstSeason = mainSeasons[0] ?? series.seasons[0];

  const initialSeason = firstSeason
    ? await getSeriesSeason(seriesId, firstSeason.season_number).catch(() => null)
    : null;

  const firstEpisode =
    initialSeason?.episodes.find(
      (e) => e.air_date !== null && e.air_date <= new Date().toISOString().slice(0, 10),
    ) ?? initialSeason?.episodes[0];

  const watchHref = firstEpisode
    ? `/series/${seriesId}/watch?s=${firstEpisode.season_number}&e=${firstEpisode.episode_number}`
    : `/series/${seriesId}/watch?s=1&e=1`;

  const statusColor =
    STATUS_COLORS[series.status] ?? 'text-white/40 border-white/20 bg-white/5';

  const creators = series.created_by
    .slice(0, 3)
    .map((c) => c.name)
    .join(', ');

  const preferredProviders = pickPreferredProvidersWithFallback(providers?.results, country);

  return (
    <>
      <Topbar />

      <div>
        <BackdropPlayer backdropUrl={backdrop} trailerKey={trailerKey} alt={series.name} />

        <div className="px-4 md:px-8 -mt-36 md:-mt-60 relative z-10">
          {/* MAIN ROW */}
          <div className="flex gap-4 md:gap-8 items-stretch">
            {/* POSTER */}
            <div className="flex-none w-24 md:w-40">
              {poster && (
                <div className="relative aspect-[2/3] w-full h-full rounded overflow-hidden shadow-2xl">
                  <Image
                    src={poster}
                    alt={series.name}
                    fill
                    sizes="(max-width: 768px) 96px, 160px"
                    className="object-cover"
                  />
                </div>
              )}
            </div>

            {/* DETAILS */}
            <div className="flex-1 min-w-0 flex flex-col justify-between">
              {/* TOP */}
              <div className="min-w-0">
                <h1 className="font-body text-xl md:text-4xl font-bold text-white leading-tight line-clamp-2">
                  {series.name}
                </h1>

                {series.tagline && (
                  <p className="hidden md:block mt-1 text-white/50 italic text-xs truncate">
                    {series.tagline}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-1 md:gap-2 mt-1 text-[10px] md:text-sm text-white/60">
                  {yearRange && <span>{yearRange}</span>}
                  {series.number_of_seasons > 0 && (
                    <>
                      <span className="text-white/20">·</span>
                      <span>
                        {series.number_of_seasons}{' '}
                        {series.number_of_seasons === 1 ? 'Season' : 'Seasons'}
                      </span>
                    </>
                  )}
                  {series.vote_average > 0 && (
                    <>
                      <span className="text-white/20">·</span>
                      <RatingBadge rating={series.vote_average} />
                    </>
                  )}
                </div>

                <div className="flex flex-nowrap gap-1 md:gap-2 mt-2 overflow-x-auto no-scrollbar">
                  {series.status && (
                    <span
                      className={cn(
                        'inline-flex items-center justify-center text-center whitespace-nowrap text-[9px] md:text-xs px-1.5 md:px-2 py-px md:py-0.5 rounded border font-medium',
                        statusColor,
                      )}
                    >
                      {series.status}
                    </span>
                  )}
                  {series.genres.slice(0, 3).map((g) => (
                    <TagChip key={g.id} label={g.name} />
                  ))}
                </div>

                <WatchProvidersRow providers={preferredProviders} />
              </div>

              {/* BOTTOM */}
              <div className="pt-2 flex items-center gap-2 shrink-0">
                <Link
                  href={watchHref}
                  className="inline-flex items-center justify-center gap-2 flex-1 bg-white text-black font-semibold text-sm px-5 py-2 md:px-6 md:py-2.5 rounded-lg hover:bg-gray-200 transition-colors md:flex-none"
                >
                  <span>▶</span> Watch
                </Link>

                <WatchlistButton
                  tmdbId={seriesId}
                  mediaType="series"
                  iconOnly
                  className="md:hidden"
                />
                <WatchlistButton
                  tmdbId={seriesId}
                  mediaType="series"
                  className="hidden md:inline-flex"
                />
              </div>
            </div>
          </div>

          {/* SYNOPSIS */}
          {series.overview && (
            <div className="mt-5 md:mt-8 max-w-2xl">
              <ExpandableText text={series.overview} />
            </div>
          )}

          {/* CREATOR */}
          {creators && (
            <p className="mt-3 text-xs md:text-sm text-white/40">
              <span className="text-white/60">Created by</span>{' '}
              <span className="text-white/70">{creators}</span>
            </p>
          )}

          {/* NETWORKS */}
          {series.networks.length > 0 && (
            <p className="mt-1 text-xs text-white/40">
              {series.networks.map((n) => n.name).join(' · ')}
            </p>
          )}
        </div>

        {/* EPISODES */}
        {initialSeason && series.seasons.length > 0 && (
          <div className="mt-10 px-4 md:px-8">
            <h2 className="text-white font-body font-semibold text-base md:text-lg mb-4">
              Episodes
            </h2>
            <EpisodeGuide
              seriesId={seriesId}
              seasons={series.seasons}
              initialSeason={initialSeason}
            />
          </div>
        )}

        {/* CAST */}
        <div className="mt-10">
          <CastRail cast={credits.cast} />
        </div>

        {/* RECOMMENDATIONS */}
        {recommendations.length > 0 && (
          <div className="mt-10 mb-16">
            <SeriesCarousel title="More Like This" series={recommendations} />
          </div>
        )}
      </div>
    </>
  );
}