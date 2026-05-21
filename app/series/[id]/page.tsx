import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CastRail } from '@/components/cast-rail';
import { SeriesCarousel } from '@/components/series-carousel';
import { Topbar } from '@/components/topbar';
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
import { getSeriesEmbedUrl } from '@/lib/vsembed';
import { pickPreferredProvidersWithFallback } from '@/lib/watch-providers';

import { EpisodeGuide } from './episode-guide';
import { SeriesDetailHero } from './series-detail-hero';

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
  const poster = tmdbImage(series.poster_path, 'w500');

  const startYear = series.first_air_date?.slice(0, 4) ?? '';
  const endYear = series.last_air_date?.slice(0, 4) ?? '';
  const yearRange =
    startYear && endYear && endYear !== startYear
      ? `${startYear} – ${endYear}`
      : startYear && series.status === 'Returning Series'
        ? `${startYear} – Present`
        : startYear;

  const mainSeasons = series.seasons.filter((s) => s.season_number !== 0 && s.episode_count > 0);
  const firstSeason = mainSeasons[0] ?? series.seasons[0];

  const initialSeason = firstSeason
    ? await getSeriesSeason(seriesId, firstSeason.season_number).catch(() => null)
    : null;

  const firstEpisode =
    initialSeason?.episodes.find(
      (e) => e.air_date !== null && e.air_date <= new Date().toISOString().slice(0, 10),
    ) ?? initialSeason?.episodes[0];

  const firstEpisodeSeason = firstEpisode?.season_number ?? 1;
  const firstEpisodeNumber = firstEpisode?.episode_number ?? 1;
  const embedUrl = getSeriesEmbedUrl(seriesId, firstEpisodeSeason, firstEpisodeNumber);

  const statusColor = STATUS_COLORS[series.status] ?? 'text-white/40 border-white/20 bg-white/5';

  const creators = series.created_by
    .slice(0, 3)
    .map((c) => c.name)
    .join(', ');

  const networks = series.networks.map((n) => n.name).join(' · ');

  const preferredProviders = pickPreferredProvidersWithFallback(providers?.results, country);

  return (
    <>
      <Topbar />

      <div>
        <SeriesDetailHero
          backdropUrl={backdrop}
          trailerKey={trailerKey}
          alt={series.name}
          embedUrl={embedUrl}
          seriesId={seriesId}
          poster={poster}
          posterPath={series.poster_path}
          backdropPath={series.backdrop_path}
          name={series.name}
          tagline={series.tagline}
          yearRange={yearRange}
          numberOfSeasons={series.number_of_seasons}
          rating={series.vote_average}
          genres={series.genres}
          status={series.status}
          statusColor={statusColor}
          providers={preferredProviders}
          creators={creators}
          networks={networks}
          overview={series.overview ?? null}
          firstEpisodeSeason={firstEpisodeSeason}
          firstEpisodeNumber={firstEpisodeNumber}
          seasons={series.seasons}
          initialSeason={initialSeason}
        />

        {/* EPISODES */}
        {initialSeason && series.seasons.length > 0 && (
          <div id="episode-guide" className="mt-10 px-4 md:px-8">
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
