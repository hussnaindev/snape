import type { Viewport } from 'next';
import { notFound } from 'next/navigation';

import { WatchHistoryRecorder } from '@/components/watch-history-recorder';
import { getSeriesDetail, getSeriesSeason } from '@/lib/tmdb';
import { getSeriesEmbedUrl } from '@/lib/vsembed';

import { EpisodePanel } from './episode-panel';
import { WatchControls } from './watch-controls';

export const runtime = 'edge';

export const viewport: Viewport = {
  viewportFit: 'cover',
};

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ s?: string; e?: string }>;
}

export default async function SeriesWatchPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { s, e } = await searchParams;

  const seriesId = Number(id);
  if (Number.isNaN(seriesId)) notFound();

  // Default to S1E1 if not provided or invalid
  const seasonNum = Math.max(1, Number(s) || 1);
  const episodeNum = Math.max(1, Number(e) || 1);

  // Fetch series info (for episode panel) + current season
  const [series, currentSeason] = await Promise.all([
    getSeriesDetail(seriesId).catch(() => null),
    getSeriesSeason(seriesId, seasonNum).catch(() => null),
  ]);

  if (!series) notFound();

  // If season doesn't exist, fall back to season 1
  const resolvedSeason = currentSeason ?? (await getSeriesSeason(seriesId, 1).catch(() => null));
  const resolvedSeasonNum = resolvedSeason?.season_number ?? seasonNum;

  // Validate episode number within season
  const maxEpisode = resolvedSeason?.episodes.length ?? episodeNum;
  const resolvedEpisodeNum = Math.min(Math.max(1, episodeNum), maxEpisode);

  const embedUrl = getSeriesEmbedUrl(seriesId, resolvedSeasonNum, resolvedEpisodeNum);

  return (
    <div className="fixed inset-0 bg-black">
      <div className="absolute inset-0 player-safe-area">
        <iframe
          key={embedUrl}
          src={embedUrl}
          className="w-full h-full"
          allowFullScreen
          allow="autoplay; fullscreen; accelerometer; gyroscope; picture-in-picture"
          sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
          title="Video player"
        />
      </div>

      {/* Back button + fullscreen toggle */}
      <WatchControls seriesId={seriesId} />

      {/* Episode switcher panel */}
      {resolvedSeason && (
        <EpisodePanel
          seriesId={seriesId}
          seriesName={series.name}
          seasons={series.seasons}
          initialSeason={resolvedSeason}
          currentSeasonNum={resolvedSeasonNum}
          currentEpisodeNum={resolvedEpisodeNum}
        />
      )}

      <WatchHistoryRecorder
        id={seriesId}
        type="series"
        title={series.name}
        posterPath={series.poster_path}
        backdropPath={series.backdrop_path}
        year={series.first_air_date?.slice(0, 4) ?? ''}
        season={resolvedSeasonNum}
        episode={resolvedEpisodeNum}
      />
    </div>
  );
}
