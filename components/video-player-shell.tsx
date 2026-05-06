'use client';

import type { SubtitleTrack } from '@/lib/stream-extractor';
import { cn } from '@/lib/utils';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { HlsPlayerHandle, QualityLevel } from './hls-player';

const HlsPlayer = dynamic(() => import('./hls-player').then((m) => m.HlsPlayer), { ssr: false });

interface StreamData {
  streamUrl: string;
  subtitles: SubtitleTrack[];
  provider: string;
}

interface VideoPlayerShellProps {
  streamApiUrl: string;
  fallbackEmbedUrl: string;
  autoPlay?: boolean;
  className?: string;
}

type Mode = 'loading' | 'hls' | 'fallback';

export function VideoPlayerShell({
  streamApiUrl,
  fallbackEmbedUrl,
  autoPlay,
  className,
}: VideoPlayerShellProps) {
  const [mode, setMode] = useState<Mode>('loading');
  const [streamData, setStreamData] = useState<StreamData | null>(null);
  const [qualityLevels, setQualityLevels] = useState<QualityLevel[]>([]);
  const [currentQuality, setCurrentQuality] = useState(-1); // -1 = auto
  const [activeSubtitle, setActiveSubtitle] = useState(-1); // -1 = off
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [showQualMenu, setShowQualMenu] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const playerRef = useRef<HlsPlayerHandle>(null);
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch stream URL when streamApiUrl changes
  useEffect(() => {
    setMode('loading');
    setStreamData(null);
    setQualityLevels([]);
    setCurrentQuality(-1);
    setActiveSubtitle(-1);
    let cancelled = false;

    fetch(streamApiUrl)
      .then((r) => r.json())
      .then((res: unknown) => {
        if (cancelled) return;
        const typed = res as { ok: boolean; data?: StreamData };
        if (typed.ok && typed.data?.streamUrl) {
          setStreamData(typed.data);
          setMode('hls');
        } else {
          setMode('fallback');
        }
      })
      .catch(() => {
        if (!cancelled) setMode('fallback');
      });

    return () => {
      cancelled = true;
    };
  }, [streamApiUrl]);

  // Auto-hide controls after 3 s of inactivity
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, [resetControlsTimer]);

  // Sync playing / time / duration from the video element via polling
  useEffect(() => {
    if (mode !== 'hls') return;
    const video = playerRef.current?.getVideoElement();
    if (!video) return;

    // Capture as non-null; TypeScript can't narrow inside nested function declarations.
    const v = video;
    function onPlay() {
      setPlaying(true);
    }
    function onPause() {
      setPlaying(false);
    }
    function onTimeUpdate() {
      setCurrentTime(v.currentTime);
    }
    function onDurationChange() {
      setDuration(v.duration);
    }
    function onVolumeChange() {
      setVolume(v.volume);
    }

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('volumechange', onVolumeChange);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('volumechange', onVolumeChange);
    };
  }, [mode]);

  // Apply subtitle track selection to the native video element
  useEffect(() => {
    const video = playerRef.current?.getVideoElement();
    if (!video) return;
    const tracks = Array.from(video.textTracks);
    for (const [i, t] of tracks.entries()) {
      t.mode = i === activeSubtitle ? 'showing' : 'disabled';
    }
  }, [activeSubtitle]);

  function handlePlayPause() {
    if (playing) {
      playerRef.current?.pause();
    } else {
      playerRef.current?.play();
    }
    resetControlsTimer();
  }

  function handleSeek(e: React.ChangeEvent<HTMLInputElement>) {
    const t = Number(e.target.value);
    playerRef.current?.seek(t);
    setCurrentTime(t);
    resetControlsTimer();
  }

  function handleVolume(e: React.ChangeEvent<HTMLInputElement>) {
    const v = Number(e.target.value);
    playerRef.current?.setVolume(v);
    setVolume(v);
    resetControlsTimer();
  }

  function handleQuality(index: number) {
    setCurrentQuality(index);
    playerRef.current?.setQuality(index);
    setShowQualMenu(false);
    resetControlsTimer();
  }

  function handleSubtitle(index: number) {
    setActiveSubtitle(index);
    setShowSubMenu(false);
    resetControlsTimer();
  }

  function formatTime(s: number): string {
    if (!Number.isFinite(s)) return '0:00';
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    const mm = String(m).padStart(h > 0 ? 2 : 1, '0');
    const ss = String(sec).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
  }

  function qualityLabel(level: QualityLevel): string {
    if (level.height >= 2160) return '4K';
    if (level.height > 0) return `${level.height}p`;
    return `${Math.round(level.bitrate / 1000)}k`;
  }

  if (mode === 'loading') {
    return (
      <div className={cn('relative bg-black flex items-center justify-center', className)}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
          <span className="text-white/40 text-xs">Loading video…</span>
        </div>
      </div>
    );
  }

  if (mode === 'fallback') {
    return (
      <iframe
        src={fallbackEmbedUrl}
        className={className}
        allowFullScreen
        allow="autoplay; fullscreen; accelerometer; gyroscope; picture-in-picture"
        title="Video player"
      />
    );
  }

  // mode === 'hls'
  return (
    <div
      className={cn('relative bg-black overflow-hidden', className)}
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
      onClick={() => {
        if (showSubMenu || showQualMenu) {
          setShowSubMenu(false);
          setShowQualMenu(false);
        } else {
          handlePlayPause();
        }
      }}
      onKeyDown={(e) => {
        if (e.key === ' ') {
          e.preventDefault();
          handlePlayPause();
        }
        if (e.key === 'Escape') {
          setShowSubMenu(false);
          setShowQualMenu(false);
        }
      }}
      role="presentation"
    >
      {/* Video element */}
      <HlsPlayer
        ref={playerRef}
        streamUrl={streamData?.streamUrl ?? ''}
        subtitles={streamData?.subtitles ?? []}
        autoPlay={autoPlay ?? false}
        className="w-full h-full"
        onError={() => setMode('fallback')}
        onQualityLevels={setQualityLevels}
      />

      {/* Control bar */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 z-10 transition-opacity duration-300 select-none',
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none',
        )}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        {/* Gradient fade behind controls */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

        <div className="relative px-3 pb-3 pt-8 flex flex-col gap-2">
          {/* Seek bar */}
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 appearance-none bg-white/20 rounded-full cursor-pointer accent-white"
            aria-label="Seek"
          />

          {/* Bottom row */}
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <button
              type="button"
              onClick={handlePlayPause}
              className="flex-none text-white hover:text-white/70 transition-colors"
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <rect x="6" y="4" width="4" height="16" rx="1" />
                  <rect x="14" y="4" width="4" height="16" rx="1" />
                </svg>
              ) : (
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              )}
            </button>

            {/* Time */}
            <span className="text-white/60 text-xs tabular-nums whitespace-nowrap">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>

            {/* Volume */}
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={handleVolume}
              className="w-16 h-1 appearance-none bg-white/20 rounded-full cursor-pointer accent-white hidden sm:block"
              aria-label="Volume"
            />

            <div className="flex-1" />

            {/* Subtitle selector */}
            {(streamData?.subtitles?.length ?? 0) > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowSubMenu((v) => !v);
                    setShowQualMenu(false);
                  }}
                  className={cn(
                    'text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer',
                    activeSubtitle >= 0
                      ? 'border-white/60 text-white bg-white/10'
                      : 'border-white/20 text-white/60 hover:border-white/50 hover:text-white',
                  )}
                  aria-label="Subtitles"
                >
                  CC
                </button>
                {showSubMenu && (
                  <div className="absolute bottom-full right-0 mb-2 w-36 bg-black/90 border border-white/10 rounded-lg py-1 shadow-xl z-20">
                    <button
                      type="button"
                      onClick={() => handleSubtitle(-1)}
                      className={cn(
                        'w-full text-left px-3 py-1.5 text-xs transition-colors',
                        activeSubtitle === -1 ? 'text-white' : 'text-white/50 hover:text-white',
                      )}
                    >
                      Off
                    </button>
                    {(streamData?.subtitles ?? []).map((track, i) => (
                      <button
                        key={track.src}
                        type="button"
                        onClick={() => handleSubtitle(i)}
                        className={cn(
                          'w-full text-left px-3 py-1.5 text-xs transition-colors',
                          activeSubtitle === i ? 'text-white' : 'text-white/50 hover:text-white',
                        )}
                      >
                        {track.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quality selector */}
            {qualityLevels.length > 1 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setShowQualMenu((v) => !v);
                    setShowSubMenu(false);
                  }}
                  className="text-xs px-2.5 py-1 rounded-full border border-white/20 text-white/60 hover:border-white/50 hover:text-white transition-colors cursor-pointer"
                  aria-label="Quality"
                >
                  {currentQuality === -1
                    ? 'Auto'
                    : qualityLabel(
                        qualityLevels[currentQuality] ?? { index: 0, height: 0, bitrate: 0 },
                      )}
                </button>
                {showQualMenu && (
                  <div className="absolute bottom-full right-0 mb-2 w-24 bg-black/90 border border-white/10 rounded-lg py-1 shadow-xl z-20">
                    <button
                      type="button"
                      onClick={() => handleQuality(-1)}
                      className={cn(
                        'w-full text-left px-3 py-1.5 text-xs transition-colors',
                        currentQuality === -1 ? 'text-white' : 'text-white/50 hover:text-white',
                      )}
                    >
                      Auto
                    </button>
                    {qualityLevels.map((level) => (
                      <button
                        key={level.index}
                        type="button"
                        onClick={() => handleQuality(level.index)}
                        className={cn(
                          'w-full text-left px-3 py-1.5 text-xs transition-colors',
                          currentQuality === level.index
                            ? 'text-white'
                            : 'text-white/50 hover:text-white',
                        )}
                      >
                        {qualityLabel(level)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
