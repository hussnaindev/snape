'use client';

import { cn } from '@/lib/utils';
import type { Channel } from '@/types/channels';
import { useCallback, useEffect, useRef, useState } from 'react';

interface TvPlayerProps {
  channel: Channel;
  className?: string;
}

type PlayerState = 'loading' | 'playing' | 'paused' | 'buffering' | 'error';

export function TvPlayer({ channel, className }: TvPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<import('hls.js').default | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playerState, setPlayerState] = useState<PlayerState>('loading');
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3000);
  }, []);

  const revealControls = useCallback(() => {
    setShowControls(true);
    scheduleHide();
  }, [scheduleHide]);

  // Load the stream whenever the channel changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setPlayerState('loading');
    setErrorMessage('');

    let hlsInstance: import('hls.js').default | null = null;
    let cancelled = false;

    async function setupPlayer() {
      if (!video || cancelled) return;

      // Tear down the previous HLS instance
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute('src');
      video.load();

      const Hls = (await import('hls.js')).default;
      if (cancelled) return;

      const looksLikeHls =
        channel.streamUrl.includes('.m3u8') || channel.streamUrl.includes('.m3u');

      if (Hls.isSupported() && looksLikeHls) {
        hlsInstance = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
          maxBufferLength: 30,
        });
        hlsRef.current = hlsInstance;

        hlsInstance.on(Hls.Events.ERROR, (_evt, data) => {
          if (data.fatal && !cancelled) {
            setPlayerState('error');
            setErrorMessage('Stream unavailable');
          }
        });

        hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!cancelled && video) {
            video.play().catch(() => {
              if (!cancelled) setPlayerState('paused');
            });
          }
        });

        hlsInstance.loadSource(channel.streamUrl);
        hlsInstance.attachMedia(video);
      } else if (video.canPlayType('application/vnd.apple.mpegurl') || !looksLikeHls) {
        // Native HLS (Safari) or direct video URL
        video.src = channel.streamUrl;
        video.play().catch(() => {
          if (!cancelled) setPlayerState('paused');
        });
      } else {
        if (!cancelled) {
          setPlayerState('error');
          setErrorMessage('HLS not supported in this browser');
        }
      }
    }

    setupPlayer().catch(() => {
      if (!cancelled) {
        setPlayerState('error');
        setErrorMessage('Failed to initialise player');
      }
    });

    return () => {
      cancelled = true;
      if (hlsInstance) {
        hlsInstance.destroy();
        if (hlsRef.current === hlsInstance) hlsRef.current = null;
      }
    };
  }, [channel.streamUrl]);

  // Sync video events → playerState
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlaying = () => setPlayerState('playing');
    const onPause = () => setPlayerState('paused');
    const onWaiting = () => setPlayerState('buffering');
    const onError = () => {
      setPlayerState('error');
      setErrorMessage('Stream unavailable');
    };

    video.addEventListener('playing', onPlaying);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('error', onError);
    return () => {
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('error', onError);
    };
  }, []);

  // Sync fullscreen state
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Cleanup hide timer on unmount
  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  // Sync volume / mute to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    video.volume = volume;
  }, [muted, volume]);

  // Start hiding controls once playing
  useEffect(() => {
    if (playerState === 'playing') scheduleHide();
    else {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setShowControls(true);
    }
  }, [playerState, scheduleHide]);

  function togglePlayPause() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
    } else {
      video.pause();
    }
    revealControls();
  }

  function toggleMute() {
    setMuted((prev) => !prev);
    revealControls();
  }

  async function toggleFullscreen() {
    if (!document.fullscreenElement) {
      await containerRef.current?.requestFullscreen().catch(() => {});
      // Lock to landscape on mobile browsers that support it
      try {
        const orient = screen.orientation as unknown as {
          lock?: (o: string) => Promise<void>;
        };
        await orient.lock?.('landscape');
      } catch {
        // Not supported or denied — ignore
      }
    } else {
      document.exitFullscreen().catch(() => {});
      // Release orientation lock
      try {
        const orient = screen.orientation as unknown as { unlock?: () => void };
        orient.unlock?.();
      } catch {
        // ignore
      }
    }
    revealControls();
  }

  function retry() {
    const video = videoRef.current;
    if (!video) return;
    setPlayerState('loading');
    setErrorMessage('');
    if (hlsRef.current) {
      hlsRef.current.startLoad(-1);
      video.play().catch(() => {});
    } else {
      const src = video.src;
      video.src = '';
      video.load();
      video.src = src;
      video.play().catch(() => {});
    }
  }

  const isLoading = playerState === 'loading' || playerState === 'buffering';
  const isPlaying = playerState === 'playing';
  const isError = playerState === 'error';

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative bg-black w-full h-full overflow-hidden select-none group',
        className,
      )}
      onMouseMove={revealControls}
      onMouseLeave={() => {
        if (isPlaying) scheduleHide();
      }}
      onTouchStart={revealControls}
      onClick={togglePlayPause}
    >
      {/* Video */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain"
        playsInline
        autoPlay
        muted={muted}
      />

      {/* Buffering spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
          <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          <span className="text-white/50 text-sm">Buffering…</span>
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70">
          <div className="flex flex-col items-center gap-3 text-center px-8 max-w-sm">
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-white/30"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p className="text-white/80 font-semibold text-base">
              {errorMessage || 'Stream unavailable'}
            </p>
            <p className="text-white/40 text-sm leading-relaxed">
              This channel may be temporarily offline or blocked by CORS policy.
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                retry();
              }}
              className="mt-1 px-6 py-2 bg-white text-black text-sm font-semibold rounded-lg hover:bg-white/90 active:bg-white/80 transition-colors cursor-pointer"
            >
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Top-left channel badge — fades with controls */}
      <div
        className={cn(
          'absolute top-4 left-4 flex items-center gap-2.5 pointer-events-none transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0',
        )}
      >
        {channel.logo && (
          <div className="bg-black/50 rounded-md p-1 backdrop-blur-sm">
            <img
              src={channel.logo}
              alt=""
              className="h-6 w-10 object-contain"
            />
          </div>
        )}
        <div>
          <p className="text-white text-sm font-semibold drop-shadow-md leading-tight">
            {channel.name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="inline-flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-1.5 py-px rounded leading-none">
              <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
            {channel.country && (
              <span className="text-white/50 text-xs">{channel.country}</span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom controls bar */}
      <div
        className={cn(
          'absolute bottom-0 inset-x-0 transition-opacity duration-300',
          showControls ? 'opacity-100' : 'opacity-0',
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent pointer-events-none" />

        <div className="relative flex items-center gap-2 px-4 pb-4 pt-10">
          {/* Play / Pause */}
          <button
            type="button"
            onClick={togglePlayPause}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            className="text-white hover:text-white/80 transition-colors p-1.5 cursor-pointer shrink-0"
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </button>

          {/* Mute + volume */}
          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? 'Unmute' : 'Mute'}
            className="text-white hover:text-white/80 transition-colors p-1.5 cursor-pointer shrink-0"
          >
            {muted || volume === 0 ? <MuteIcon /> : volume < 0.5 ? <VolumeLowIcon /> : <VolumeHighIcon />}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={muted ? 0 : volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setVolume(v);
              if (v > 0) setMuted(false);
              else setMuted(true);
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Volume"
            className="w-20 accent-white cursor-pointer shrink-0 hidden sm:block"
          />

          {/* Channel name + live badge */}
          <div className="flex-1 min-w-0 ml-1 flex items-center gap-2">
            <span className="text-white text-sm font-medium truncate">{channel.name}</span>
            <span className="shrink-0 text-[10px] font-bold bg-red-600 text-white px-1.5 py-px rounded">
              LIVE
            </span>
          </div>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            className="text-white hover:text-white/80 transition-colors p-1.5 cursor-pointer shrink-0"
          >
            {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Icon components                                                     */
/* ------------------------------------------------------------------ */

function PlayIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="4" width="4" height="16" rx="1" />
      <rect x="14" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function MuteIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

function VolumeLowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function VolumeHighIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function FullscreenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3H5a2 2 0 0 0-2 2v3" />
      <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
      <path d="M3 16v3a2 2 0 0 0 2 2h3" />
      <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3v3a2 2 0 0 1-2 2H3" />
      <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
      <path d="M3 16h3a2 2 0 0 1 2 2v3" />
      <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
    </svg>
  );
}
