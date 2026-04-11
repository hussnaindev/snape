'use client';

import { apiFetch } from '@/lib/api';
import { tmdbImage } from '@/lib/tmdb-image';
import type { TMDBEpisode, TMDBSeason, TMDBSeasonSummary } from '@/types/tmdb';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const TODAY = new Date().toISOString().slice(0, 10);

interface Props {
  seriesId: number;
  seriesName: string;
  seasons: TMDBSeasonSummary[];
  initialSeason: TMDBSeason;
  currentSeasonNum: number;
  currentEpisodeNum: number;
}

export function EpisodePanel({
  seriesId,
  seriesName,
  seasons,
  initialSeason,
  currentSeasonNum,
  currentEpisodeNum,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedSeason, setSelectedSeason] = useState(currentSeasonNum);
  const [seasonData, setSeasonData] = useState<TMDBSeason>(initialSeason);
  const [loading, setLoading] = useState(false);

  const mainSeasons = seasons.filter((s) => s.season_number !== 0 && s.episode_count > 0);
  const hasSpecials = seasons.some((s) => s.season_number === 0 && s.episode_count > 0);
  const allVisibleSeasons = hasSpecials
    ? [...mainSeasons, seasons.find((s) => s.season_number === 0)!]
    : mainSeasons;

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

  const airedEpisodes = seasonData.episodes.filter(
    (e) => e.air_date !== null && e.air_date <= TODAY,
  );

  function handleEpisodeClick(ep: TMDBEpisode) {
    setOpen(false);
    router.replace(
      `/series/${seriesId}/watch?s=${ep.season_number}&e=${ep.episode_number}`,
    );
  }

  const currentEp = seasonData.episodes.find(
    (e) => e.season_number === currentSeasonNum && e.episode_number === currentEpisodeNum,
  );

  return (
    <>
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="absolute z-20 flex items-center gap-1.5 bg-black/70 text-white text-xs font-medium px-3 py-1.5 rounded-full border border-white/20 hover:border-white/50 transition-colors"
        style={{
          top: 'max(12px, env(safe-area-inset-top))',
          right: 'max(12px, env(safe-area-inset-right))',
        }}
        aria-label="Episode list"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <line x1="3" y1="6" x2="3.01" y2="6" />
          <line x1="3" y1="12" x2="3.01" y2="12" />
          <line x1="3" y1="18" x2="3.01" y2="18" />
        </svg>
        <span className="hidden sm:inline">Episodes</span>
      </button>

      {/* Episode info overlay (bottom of screen) */}
      {!open && currentEp && (
        <div
          className="absolute z-10 left-0 right-0 pointer-events-none"
          style={{ bottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto max-w-lg px-4">
            <div className="bg-black/60 rounded-lg px-3 py-2 backdrop-blur-sm">
              <p className="text-white/50 text-[10px] font-medium uppercase tracking-wider">
                {seriesName}
              </p>
              <p className="text-white text-xs mt-0.5">
                S{String(currentSeasonNum).padStart(2, '0')} E{String(currentEpisodeNum).padStart(2, '0')}
                {currentEp.name ? ` · ${currentEp.name}` : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Panel */}
      {open && (
        <div
          className="absolute inset-0 z-30 flex"
          onClick={() => setOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" />

          {/* Drawer — right side on desktop, full-height on mobile */}
          <div
            className="relative ml-auto w-full max-w-sm h-full bg-[#111] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-none">
              <div>
                <p className="text-white font-semibold text-sm line-clamp-1">{seriesName}</p>
                <p className="text-white/40 text-xs mt-0.5">
                  {allVisibleSeasons.length > 1
                    ? `Season ${selectedSeason}`
                    : seasonData.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-white/50 hover:text-white transition-colors p-1"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Season selector */}
            {allVisibleSeasons.length > 1 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 py-2 border-b border-white/10 flex-none">
                {allVisibleSeasons.map((s) => (
                  <button
                    key={s.season_number}
                    type="button"
                    onClick={() => setSelectedSeason(s.season_number)}
                    className={`flex-none px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${
                      selectedSeason === s.season_number
                        ? 'bg-white text-black border-white'
                        : 'bg-transparent text-white/60 border-white/20 hover:border-white/40 hover:text-white/80'
                    }`}
                  >
                    {s.season_number === 0 ? 'Specials' : `S${s.season_number}`}
                  </button>
                ))}
              </div>
            )}

            {/* Episode list */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col gap-3 p-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex gap-3 animate-pulse">
                      <div className="flex-none w-20 aspect-video rounded bg-white/10" />
                      <div className="flex-1 space-y-1.5 py-0.5">
                        <div className="h-2.5 bg-white/10 rounded w-1/4" />
                        <div className="h-2 bg-white/10 rounded w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col">
                  {airedEpisodes.map((ep) => {
                    const isCurrent =
                      ep.season_number === currentSeasonNum &&
                      ep.episode_number === currentEpisodeNum;
                    const still = tmdbImage(ep.still_path, 'w300');

                    return (
                      <button
                        key={ep.id}
                        type="button"
                        onClick={() => handleEpisodeClick(ep)}
                        className={`flex gap-3 items-center px-4 py-2.5 text-left transition-colors hover:bg-white/5 ${
                          isCurrent ? 'bg-white/10' : ''
                        }`}
                      >
                        {/* Thumbnail */}
                        <div className="flex-none w-20 aspect-video rounded overflow-hidden bg-white/5 relative">
                          {still ? (
                            <Image src={still} alt={ep.name} fill sizes="80px" className="object-cover" />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-white/20">
                                <polygon points="5 3 19 12 5 21 5 3" />
                              </svg>
                            </div>
                          )}
                          {isCurrent && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                              <div className="w-2 h-2 rounded-full bg-white" />
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-white/40 text-[10px] font-mono tabular-nums">
                              E{String(ep.episode_number).padStart(2, '0')}
                            </span>
                            {isCurrent && (
                              <span className="text-white text-[10px] font-medium">▶ Playing</span>
                            )}
                          </div>
                          <p className={`text-xs leading-tight line-clamp-1 ${isCurrent ? 'text-white font-medium' : 'text-white/70'}`}>
                            {ep.name}
                          </p>
                          {ep.runtime && (
                            <p className="text-white/30 text-[10px] mt-0.5">{ep.runtime}m</p>
                          )}
                        </div>
                      </button>
                    );
                  })}

                  {airedEpisodes.length === 0 && (
                    <p className="text-white/40 text-sm text-center py-8 px-4">
                      No episodes available yet.
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
