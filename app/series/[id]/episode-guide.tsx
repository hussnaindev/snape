'use client';

import { DownloadModal } from '@/components/download-button';
import { apiFetch } from '@/lib/api';
import { tmdbResponsive } from '@/lib/tmdb-image';
import type { TMDBEpisode, TMDBSeason, TMDBSeasonSummary } from '@/types/tmdb';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

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
  variant?: 'carousel' | 'list';
  title?: string;
  posterPath?: string | null;
}

export function EpisodeGuide({
  seriesId,
  seasons,
  initialSeason,
  initialSelectedSeason,
  onSelect,
  variant = 'carousel',
  title,
  posterPath,
}: Props) {
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
      {variant === 'carousel' && (
        <h2 className="text-white font-chesna-grotesk font-semibold text-xs md:text-sm uppercase tracking-widest mb-4 px-4 md:px-8">
          EPISODES
        </h2>
      )}

      {/* Season tabs */}
      {allVisibleSeasons.length > 1 && (
        <div
          className={`flex gap-2 overflow-x-auto no-scrollbar pb-3 ${variant === 'carousel' ? 'px-4 md:px-8' : ''}`}
        >
          {allVisibleSeasons.map((s) => (
            <button
              key={s.season_number}
              type="button"
              onClick={() => {
                setSelectedSeason(s.season_number);
                if (s.season_number !== initialSeason.season_number) setLoading(true);
              }}
              className={`flex-none px-4 py-1.5 rounded-full text-[11px] font-chesna-grotesk font-medium uppercase tracking-widest border transition-colors whitespace-nowrap cursor-pointer ${
                selectedSeason === s.season_number
                  ? 'bg-white text-black border-white'
                  : 'bg-transparent text-white/60 border-white/20 hover:border-white/50 hover:text-white'
              }`}
            >
              {s.season_number === 0 ? 'SPECIALS' : `SEASON ${s.season_number}`}
            </button>
          ))}
        </div>
      )}

      {/* Episode list */}
      {loading ? (
        variant === 'carousel' ? (
          <div className="overflow-x-auto no-scrollbar">
            <div className="flex gap-2 px-4 md:px-8 pt-1 pb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-none w-[180px] sm:w-[240px] md:w-[260px] lg:w-[280px] xl:w-[300px]"
                >
                  <div className="rounded-2xl sm:rounded-[28px] bg-white/5 ring-1 sm:ring-2 ring-white/25 overflow-hidden animate-pulse shadow-[0_8px_24px_rgba(255,255,255,0.08),_0_2px_6px_rgba(255,255,255,0.05)]">
                    <div className="aspect-[4/3] bg-white/10" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
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
        )
      ) : episodes.length > 0 ? (
        variant === 'carousel' ? (
          <div className="overflow-x-auto no-scrollbar">
            <div className="flex gap-2 px-4 md:px-8 py-8">
              {episodes.map((ep) => (
                <div
                  key={ep.id}
                  className="flex-none w-[180px] sm:w-[240px] md:w-[260px] lg:w-[280px] xl:w-[300px]"
                >
                  <EpisodeCard
                    episode={ep}
                    seriesId={seriesId}
                    selectedSeason={selectedSeason}
                    {...(title ? { seriesTitle: title } : {})}
                    {...(posterPath ? { posterPath } : {})}
                    {...(onSelect ? { onSelect } : {})}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
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
        )
      ) : (
        <p
          className={`text-white/40 text-sm py-6 text-center ${variant === 'carousel' ? 'px-4 md:px-8' : ''}`}
        >
          No episodes available.
        </p>
      )}

      {upcomingCount > 0 && (
        <p className={`mt-4 text-white/40 text-xs ${variant === 'carousel' ? 'px-4 md:px-8' : ''}`}>
          {upcomingCount} upcoming episode{upcomingCount > 1 ? 's' : ''} not yet aired
        </p>
      )}
    </div>
  );
}

function EpisodeCard({
  episode,
  seriesId,
  selectedSeason,
  onSelect,
  seriesTitle,
  posterPath,
}: {
  episode: TMDBEpisode;
  seriesId: number;
  selectedSeason: number;
  onSelect?: (season: number, episode: number) => void;
  seriesTitle?: string;
  posterPath?: string | null;
}) {
  const still = tmdbResponsive(episode.still_path, 'w500', 'w500');
  const runtime = episode.runtime ? `${episode.runtime}m` : null;
  const rating = episode.vote_average;
  const [showDownload, setShowDownload] = useState(false);

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

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    setShowDownload(true);
  }

  // Detect long-press via pointer events for mobile.
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handlePointerDown() {
    longPressRef.current = setTimeout(() => {
      longPressRef.current = null;
      setShowDownload(true);
    }, 600);
  }
  function handlePointerUpOrLeave() {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  return (
    <>
      <div
        className="group relative block overflow-hidden rounded-2xl sm:rounded-[28px] bg-white/5 ring-1 sm:ring-2 ring-white/25 shadow-[0_8px_24px_rgba(255,255,255,0.08),_0_2px_6px_rgba(255,255,255,0.05)]"
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUpOrLeave}
        onPointerLeave={handlePointerUpOrLeave}
        onPointerCancel={handlePointerUpOrLeave}
      >
        <button
          type="button"
          onClick={handleClick}
          className="block h-full w-full text-left cursor-pointer"
        >
          <div className="aspect-[4/3] overflow-hidden relative">
            {still ? (
              <picture>
                <source srcSet={still.desktop} media="(min-width: 1024px)" />
                <Image
                  src={still.mobile}
                  alt={episode.name}
                  fill
                  sizes="(max-width: 640px) 180px, (max-width: 768px) 240px, (max-width: 1024px) 260px, (max-width: 1280px) 280px, 300px"
                  className="object-cover transition-transform duration-300 ease-out group-hover:scale-110"
                />
              </picture>
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-white/5 text-white/20 text-sm">
                No Image
              </div>
            )}

            {/* Play overlay on hover (desktop only) */}
            <div className="absolute inset-0 bg-black/50 opacity-0 flex items-center justify-center hidden">
              <div className="w-12 h-12 rounded-full border border-white/50 bg-black/30 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.12)]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                  <polygon points="6,4 20,12 6,20" />
                </svg>
              </div>
            </div>

            {/* Runtime chip top-left */}
            {runtime && (
              <span className="absolute top-1.5 left-2 lg:top-2 lg:left-3 z-10 inline-flex items-center text-[8px] sm:text-[9px] lg:text-[9px] font-semibold tracking-widest uppercase text-white/80 border border-white/40 rounded-full px-2 py-1 bg-black/60">
                {runtime}
              </span>
            )}

            {/* Rating chip top-right */}
            {rating > 0 && (
              <span className="absolute top-1.5 right-2 lg:top-2 lg:right-3 z-10 inline-flex items-center gap-1 rounded-full border border-white/40 px-2 py-1 text-[8px] sm:text-[9px] lg:text-[9px] font-semibold tabular-nums text-white bg-black/60">
                ★ {rating.toFixed(1)}
              </span>
            )}

            {/* Title bar at bottom */}
            <div className="absolute inset-x-0 bottom-0 flex items-center pointer-events-none z-0">
              <div className="w-full bg-gradient-to-t from-black/85 to-black/50 py-1 sm:py-1.5 rounded-t-md px-3">
                <p className="text-[9px] sm:text-[10px] font-chesna-grotesk uppercase truncate tracking-[0.2em] font-light text-white/90 text-center">
                  E{episode.episode_number}: {episode.name}
                </p>
              </div>
            </div>
          </div>
        </button>
      </div>
      {showDownload && seriesTitle && (
        <DownloadModal
          type="series"
          tmdbId={seriesId}
          title={seriesTitle}
          posterPath={posterPath ?? null}
          season={selectedSeason}
          episode={episode.episode_number}
          onClose={() => setShowDownload(false)}
        />
      )}
    </>
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
  const still = tmdbResponsive(episode.still_path, 'w300', 'w500');
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
          <picture>
            <source srcSet={still.desktop} media="(min-width: 1024px)" />
            <Image
              src={still.mobile}
              alt={episode.name}
              fill
              sizes="160px"
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-110"
            />
          </picture>
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
          <p className="text-white text-[11px] sm:text-sm font-chesna-grotesk font-medium leading-tight line-clamp-1">
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
