import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { CastRail } from '@/components/cast-rail';
import { SeriesCarousel } from '@/components/series-carousel';
import {
  getEmbeddableTrailerKey,
  getSeriesCredits,
  getSeriesDetail,
  getSeriesImages,
  getSeriesRecommendations,
  getSeriesSeason,
  getSeriesVideos,
  getSeriesWatchProviders,
} from '@/lib/tmdb';
import { tmdbImage } from '@/lib/tmdb-image';
import { getSeriesEmbedUrl } from '@/lib/vsembed';
import { pickPreferredProvidersWithFallback } from '@/lib/watch-providers';

import { ParallaxContent } from '@/components/parallax-content';

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

  const series = await getSeriesDetail(seriesId).catch(() => null);
  if (!series) notFound();

  const genreIds = series.genres.map((g) => g.id);
  const [credits, recommendations, videos, providers, images] = await Promise.all([
    getSeriesCredits(seriesId).catch(() => ({ cast: [], crew: [] })),
    getSeriesRecommendations(seriesId, genreIds).catch(() => []),
    getSeriesVideos(seriesId).catch(() => ({ results: [] })),
    getSeriesWatchProviders(seriesId).catch(() => null),
    getSeriesImages(seriesId).catch(() => ({ id: 0, backdrops: [], logos: [], posters: [] })),
  ]);

  const logoPath = images.logos.find((l) => l.iso_639_1 === 'en')?.file_path
    ?? images.logos[0]?.file_path
    ?? null;
  const logoUrl = logoPath ? tmdbImage(logoPath, 'w500') : null;

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
          logoUrl={logoUrl}
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
          <section id="episode-guide" className="mt-10">
            <ParallaxContent direction="right" speed={120}>
              <EpisodeGuide
                seriesId={seriesId}
                seasons={series.seasons}
                initialSeason={initialSeason}
              />
            </ParallaxContent>
          </section>
        )}

        {/* CAST */}
        <section className="mt-10">
          <ParallaxContent direction="left" speed={120}>
            <CastRail cast={credits.cast} />
          </ParallaxContent>
        </section>

        {/* RECOMMENDATIONS */}
        {recommendations.length > 0 && (
          <section className="mt-10 mb-16">
            <ParallaxContent direction="right" speed={120}>
              <SeriesCarousel title="More Like This" series={recommendations} />
            </ParallaxContent>
          </section>
        )}
      </div>
    </>
  );
}
