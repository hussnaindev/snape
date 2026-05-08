'use client';

import { apiFetch } from '@/lib/api';
import { tmdbImage } from '@/lib/tmdb-image';
import type { TMDBEpisode, TMDBSeason, TMDBSeasonSummary } from '@/types/tmdb';
import Image from 'next/image';
import { useEffect, useState } from 'react';

const TODAY = new Date().toISOString().slice(0, 10);

function isAired(episode: TMDBEpisode): boolean {
  return episode.air_date !== null && episode.air_date <= TODAY;
}

interface Props {
  seriesId: number;
  seasons: TMDBSeasonSummary[];
  initialSeason: TMDBSeason;
  initialSelectedSeason?: number;
  onSelect?: (season: number, episode: number) => void;
}

export function EpisodeGuide({ seriesId, seasons, initialSeason, initialSelectedSeason, onSelect }: Props) {
  // Filter out specials (season 0) unless it's the only season
  const mainSeasons = seasons.filter((s) => s.season_number !== 0 && s.episode_count > 0);
  const hasSpecials = seasons.some((s) => s.season_number === 0 && s.episode_count > 0);
  const allVisibleSeasons = hasSpecials
    ? [...mainSeasons, seasons.find((s) => s.season_number === 0)!]
    : mainSeasons;

  const defaultSeasonNum = initialSelectedSeason ?? initialSeason.season_number;
  const [selectedSeason, setSelectedSeason] = useState(defaultSeasonNum);
  const [seasonData, setSeasonData] = useState<TMDBSeason>(
    initialSelectedSeason === initialSeason.season_number ? initialSeason : ({} as TMDBSeason),
  );
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedSeason === initialSeason.season_number) {
      setSeasonData(initialSeason);
      return;
    }
    let cancelled = false;
    setLoading(true);

    apiFetch<TMDBSeason>(`/api/tmdb/tv/${seriesId}/season/${selectedSeason}`)
      .then((res) => {
        if (cancelled) return;
        if (res.ok) setSeasonData(res.data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedSeason, seriesId, initialSeason]);

  useEffect(() => {
    if (!initialized && initialSelectedSeason !== undefined) {
      setInitialized(true);
      if (initialSelectedSeason !== initialSeason.season_number) {
        setSelectedSeason(initialSelectedSeason);
      }
    }
  }, [initialized, initialSelectedSeason, initialSeason.season_number]);

  const episodes = seasonData.episodes?.filter(isAired) ?? [];
  const upcomingCount = (seasonData.episodes?.length ?? 0) - episodes.length;

  return (
    <div>
      {/* Season tabs */}
      {allVisibleSeasons.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3">
          {allVisibleSeasons.map((s) => (
              <button
                key={s.season_number}
                type="button"
                onClick={() => {
                  setSelectedSeason(s.season_number);
                  if (s.season_number !== initialSeason.season_number) setLoading(true);
                }}
                className={`flex-none px-4 py-1.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap cursor-pointer ${
                  selectedSeason === s.season_number
                    ? 'bg-white text-black border-white'
                    : 'bg-transparent text-white/60 border-white/20 hover:border-white/50 hover:text-white'
                }`}
              >
              {s.season_number === 0 ? 'Specials' : `Season ${s.season_number}`}
            </button>
          ))}
        </div>
      )}

      {/* Episode list */}
      {loading ? (
        <div className="flex flex-col gap-2 sm:gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex gap-2 sm:gap-3 animate-pulse">
              <div className="flex-none w-20 sm:w-[160px] aspect-video rounded bg-white/10" />
              <div className="flex-1 space-y-1.5 sm:space-y-2 py-0.5 sm:py-1">
                <div className="h-2.5 sm:h-3 bg-white/10 rounded w-1/3" />
                <div className="h-2 sm:h-2.5 bg-white/10 rounded w-2/3" />
                <div className="h-2 bg-white/10 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-0.5">
            {episodes.map((ep) => (
              <EpisodeRow
                key={ep.id}
                episode={ep}
                seriesId={seriesId}
                selectedSeason={selectedSeason}
                {...(onSelect ? { onSelect } : {})}
              />
            ))}
          </div>

          {upcomingCount > 0 && (
            <p className="mt-4 text-white/40 text-xs">
              {upcomingCount} upcoming episode{upcomingCount > 1 ? 's' : ''} not yet aired
            </p>
          )}

          {episodes.length === 0 && upcomingCount === 0 && (
            <p className="text-white/40 text-sm py-6 text-center">No episodes available.</p>
          )}
        </>
      )}
    </div>
  );
}

function EpisodeRow({
  episode,
  seriesId,
  selectedSeason,
  onSelect,
}: {
  episode: TMDBEpisode;
  seriesId: number;
  selectedSeason: number;
  onSelect?: (season: number, episode: number) => void;
}) {
  const still = tmdbImage(episode.still_path, 'w300');
  const runtime = episode.runtime ? `${episode.runtime}m` : null;

  function handleClick() {
    if (onSelect) {
      onSelect(selectedSeason, episode.episode_number);
    } else {
      window.scrollTo({ top: 0, behavior: 'instant' });
      window.dispatchEvent(
        new CustomEvent('heroflix:play-episode', {
          detail: { season: selectedSeason, episode: episode.episode_number },
        }),
      );
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="group flex gap-2 sm:gap-3 rounded-lg p-1.5 sm:p-2 -mx-1.5 sm:-mx-2 hover:bg-white/5 transition-colors text-left w-full cursor-pointer"
    >
      {/* Thumbnail */}
      <div className="flex-none w-20 sm:w-[160px] aspect-video rounded overflow-hidden bg-white/5 relative">
        {still ? (
          <Image src={still} alt={episode.name} fill sizes="160px" className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-white/20"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        )}
        {/* Play overlay on hover */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 py-0.5 sm:py-1">
        <div className="flex items-baseline gap-1 sm:gap-2">
          <span className="text-white/40 text-[10px] sm:text-xs font-mono tabular-nums flex-none">
            E{String(episode.episode_number).padStart(2, '0')}
          </span>
          <p className="text-white text-[11px] sm:text-sm font-medium leading-tight line-clamp-1">
            {episode.name}
          </p>
        </div>
        {runtime && <p className="text-white/40 text-[10px] sm:text-xs mt-0.5">{runtime}</p>}
        {episode.overview && (
          <p className="text-white/50 text-[10px] sm:text-xs mt-1 leading-relaxed line-clamp-2">
            {episode.overview}
          </p>
        )}
      </div>
    </button>
  );
}
