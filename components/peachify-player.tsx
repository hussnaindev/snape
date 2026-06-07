'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

interface StreamSource {
  type: 'mp4' | 'hls';
  url: string;
  quality: number | null;
  dub: string | null;
  provider: string;
}
interface StreamSubtitle {
  url: string;
  label: string | null;
  lang: string | null;
}
interface StreamResponse {
  ok: boolean;
  data?: { sources: StreamSource[]; subtitles: StreamSubtitle[] };
  error?: string;
}
export interface PlayerEpisode {
  season: number;
  episode: number;
  name?: string;
  still?: string;
}

interface Props {
  type: 'movie' | 'tv';
  tmdbId: number;
  season?: number;
  episode?: number;
  className?: string;
  autoPlay?: boolean;
  title?: string;
  logoUrl?: string;
  episodes?: PlayerEpisode[];
  onSelectEpisode?: (season: number, episode: number) => void;
  onReady?: () => void;
}

const DEFAULT_LABEL = 'Default';
const PROVIDER_ORDER = ['Iron', 'Spider', 'Wolf', 'Multi', 'Dark'];
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const qLabel = (s: StreamSource) => (s.type === 'hls' ? 'Auto' : s.quality ? `${s.quality}p` : 'Auto');
const dubLabel = (s: StreamSource) => s.dub ?? DEFAULT_LABEL;

type OrientationLock = ScreenOrientation & {
  lock?: (o: string) => Promise<void>;
  unlock?: () => void;
};

function fmt(t: number): string {
  if (!Number.isFinite(t) || t < 0) return '0:00';
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

export function PeachifyPlayer({
  type,
  tmdbId,
  season,
  episode,
  className,
  autoPlay = true,
  title,
  logoUrl,
  episodes,
  onSelectEpisode,
  onReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsApiRef = useRef<{ destroy: () => void; levels: { height: number }[]; currentLevel: number } | null>(null);
  const failedRef = useRef<Set<string>>(new Set());
  const startedRef = useRef(false);
  const resumeRef = useRef<{ time: number; playing: boolean } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ t: number; x: number }>({ t: 0, x: 0 });

  const [sources, setSources] = useState<StreamSource[]>([]);
  const [subs, setSubs] = useState<StreamSubtitle[]>([]);
  const [lang, setLang] = useState('');
  const [quality, setQuality] = useState('');
  const [server, setServer] = useState('');
  const [active, setActive] = useState<StreamSource | null>(null);
  const [hlsLevels, setHlsLevels] = useState<number[]>([]);
  const [hlsLevel, setHlsLevel] = useState(-1);
  const [subIndex, setSubIndex] = useState(-1);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [fit, setFit] = useState<'contain' | 'cover'>('cover'); // fill-to-screen by default
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsShown, setControlsShown] = useState(true);
  const [menu, setMenu] = useState<null | 'settings' | 'quality' | 'speed' | 'server' | 'audio' | 'captions'>(null);
  const [showEpisodes, setShowEpisodes] = useState(false);

  // ---------- data ----------
  const languages = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of sources) {
      const l = dubLabel(s);
      if (!seen.has(l)) {
        seen.add(l);
        out.push(l);
      }
    }
    out.sort((a, b) => (/(original|orig)/i.test(a) ? -1 : 0) - (/(original|orig)/i.test(b) ? -1 : 0));
    return out;
  }, [sources]);

  const qualitiesFor = useCallback(
    (l: string) => {
      const labels = new Set<string>();
      for (const s of sources) if (dubLabel(s) === l) labels.add(qLabel(s));
      return [...labels].sort((a, b) => {
        const na = Number.parseInt(a, 10);
        const nb = Number.parseInt(b, 10);
        if (Number.isNaN(na)) return 1;
        if (Number.isNaN(nb)) return -1;
        return nb - na;
      });
    },
    [sources],
  );
  const qualities = useMemo(() => qualitiesFor(lang), [qualitiesFor, lang]);

  const servers = useMemo(() => {
    const present = new Set(sources.map((s) => s.provider));
    return PROVIDER_ORDER.filter((p) => present.has(p));
  }, [sources]);

  const pickSource = useCallback(
    (l: string, q: string, srv: string): StreamSource | null => {
      const inLang = sources.filter((s) => dubLabel(s) === l);
      return (
        inLang.find((s) => qLabel(s) === q && s.provider === srv) ??
        inLang.find((s) => s.provider === srv) ??
        inLang.find((s) => qLabel(s) === q) ??
        inLang[0] ??
        sources[0] ??
        null
      );
    },
    [sources],
  );

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setSources([]);
    setActive(null);
    failedRef.current = new Set();
    startedRef.current = false;
    resumeRef.current = null;

    const qs = type === 'tv' ? `?season=${season}&episode=${episode}` : '';
    fetch(`/api/stream/${type}/${tmdbId}${qs}`)
      .then((r) => r.json() as Promise<StreamResponse>)
      .then((json) => {
        if (cancelled) return;
        if (!json.ok || !json.data || json.data.sources.length === 0) {
          setStatus('error');
          setErrorMsg(json.error ?? 'No playable sources found');
          return;
        }
        setSources(json.data.sources);
        setSubs(json.data.subtitles);
      })
      .catch(() => {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg('Failed to load sources');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [type, tmdbId, season, episode]);

  useEffect(() => {
    if (sources.length === 0) return;
    const first = sources[0]!;
    setLang(dubLabel(first));
    setQuality(qLabel(first));
    setServer(first.provider);
    const en = subs.findIndex((s) => /^en|english/i.test(s.lang ?? '') || /english/i.test(s.label ?? ''));
    setSubIndex(en);
    // biome-ignore lint/correctness/useExhaustiveDependencies: run once per source set
  }, [sources]);

  useEffect(() => {
    if (sources.length === 0 || !lang) return;
    const s = pickSource(lang, quality, server);
    if (s && s.url !== active?.url) {
      const v = videoRef.current;
      if (v && startedRef.current) resumeRef.current = { time: v.currentTime, playing: !v.paused };
      setActive(s);
    }
  }, [sources, lang, quality, server, pickSource, active?.url]);

  // attach source
  useEffect(() => {
    const video = videoRef.current;
    const s = active;
    if (!video || !s) return;
    let destroyed = false;
    let hls: import('hls.js').default | null = null;
    setHlsLevels([]);
    setHlsLevel(-1);

    const applyResume = () => {
      const r = resumeRef.current;
      if (r) {
        try {
          video.currentTime = r.time;
        } catch {}
        if (r.playing) video.play().catch(() => {});
        resumeRef.current = null;
      }
      setStatus('ready');
      startedRef.current = true;
      onReady?.();
    };
    const fallback = () => {
      if (startedRef.current || destroyed) return;
      failedRef.current.add(s.url);
      const next = sources.find((c) => !failedRef.current.has(c.url));
      if (next) {
        setLang(dubLabel(next));
        setQuality(qLabel(next));
        setServer(next.provider);
        setActive(next);
      } else {
        setStatus('error');
        setErrorMsg('All sources failed to play');
      }
    };

    video.addEventListener('loadedmetadata', applyResume);

    const useHls = s.type === 'hls' && !video.canPlayType('application/vnd.apple.mpegurl');
    let onError: (() => void) | null = null;

    if (useHls) {
      import('hls.js')
        .then(({ default: Hls }) => {
          if (destroyed) return;
          if (!Hls.isSupported()) {
            video.src = s.url;
            return;
          }
          const instance = new Hls({ enableWorker: true, abrEwmaDefaultEstimate: 8_000_000 });
          hls = instance;
          hlsApiRef.current = instance;
          instance.loadSource(s.url);
          instance.attachMedia(video);
          instance.on(Hls.Events.MANIFEST_PARSED, () => {
            if (destroyed) return;
            setHlsLevels(instance.levels.map((l) => l.height || 0));
            const top = instance.levels.length - 1;
            instance.currentLevel = top;
            setHlsLevel(top);
          });
          instance.on(Hls.Events.ERROR, (_e, data) => {
            if (!data.fatal) return;
            if (data.type === 'networkError') instance.startLoad();
            else if (data.type === 'mediaError') instance.recoverMediaError();
            else fallback();
          });
        })
        .catch(fallback);
    } else {
      video.src = s.url;
      onError = () => {
        if (destroyed) return;
        if (!startedRef.current) fallback();
      };
      video.addEventListener('error', onError);
    }

    return () => {
      destroyed = true;
      if (hls) {
        hls.destroy();
        if (hlsApiRef.current === hls) hlsApiRef.current = null;
      }
      video.removeEventListener('loadedmetadata', applyResume);
      if (onError) video.removeEventListener('error', onError);
    };
    // biome-ignore lint/correctness/useExhaustiveDependencies: attach only on URL change
  }, [active?.url]);

  // media element <-> state sync
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrent(v.currentTime);
    const onDur = () => setDuration(v.duration || 0);
    const onProg = () => {
      if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onCanPlay = () => setBuffering(false);
    const onVol = () => {
      setVolume(v.volume);
      setMuted(v.muted);
    };
    const onRate = () => setRate(v.playbackRate);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('durationchange', onDur);
    v.addEventListener('progress', onProg);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    v.addEventListener('waiting', onWaiting);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('canplay', onCanPlay);
    v.addEventListener('volumechange', onVol);
    v.addEventListener('ratechange', onRate);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('durationchange', onDur);
      v.removeEventListener('progress', onProg);
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('waiting', onWaiting);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('canplay', onCanPlay);
      v.removeEventListener('volumechange', onVol);
      v.removeEventListener('ratechange', onRate);
    };
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const tracks = v.textTracks;
    for (let i = 0; i < tracks.length; i++) tracks[i]!.mode = i === subIndex ? 'showing' : 'disabled';
  }, [subIndex, subs, active?.url, status]);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  // ---------- controls ----------
  const showControls = useCallback(() => {
    setControlsShown(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!videoRef.current?.paused) setControlsShown(false);
    }, 3200);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const seekTo = useCallback((t: number) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(v.duration)) return;
    v.currentTime = Math.max(0, Math.min(t, v.duration));
  }, []);
  const skip = useCallback(
    (d: number) => {
      const v = videoRef.current;
      if (v) seekTo(v.currentTime + d);
    },
    [seekTo],
  );

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (v) v.muted = !v.muted;
  }, []);
  const changeVolume = useCallback((val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    v.muted = val === 0;
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
      (screen.orientation as OrientationLock)?.unlock?.();
    } else {
      el.requestFullscreen()
        .then(() => (screen.orientation as OrientationLock)?.lock?.('landscape')?.catch(() => {}))
        .catch(() => {});
    }
  }, []);

  // tap / double-tap gestures on the video surface
  const onSurfaceTap = useCallback(
    (e: React.MouseEvent) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const now = Date.now();
      const isDouble = now - lastTapRef.current.t < 300;
      lastTapRef.current = { t: now, x };
      showControls();
      if (isDouble) {
        const third = rect.width / 3;
        if (x < third) skip(-10);
        else if (x > third * 2) skip(10);
        else togglePlay();
      }
    },
    [showControls, skip, togglePlay],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          skip(-10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          skip(10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(Math.min(1, (videoRef.current?.volume ?? 1) + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(Math.max(0, (videoRef.current?.volume ?? 0) - 0.1));
          break;
        case 'f':
          toggleFullscreen();
          break;
        case 'm':
          toggleMute();
          break;
        default:
          return;
      }
      showControls();
    },
    [togglePlay, skip, changeVolume, toggleFullscreen, toggleMute, showControls],
  );

  const scrubRef = useRef<HTMLDivElement>(null);
  const scrubToClient = useCallback(
    (clientX: number) => {
      const el = scrubRef.current;
      if (!el || !duration) return;
      const rect = el.getBoundingClientRect();
      const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      seekTo(frac * duration);
    },
    [duration, seekTo],
  );

  const pct = (v: number) => (duration ? `${(v / duration) * 100}%` : '0%');
  const closePanels = () => {
    setMenu(null);
    setShowEpisodes(false);
  };
  const qualityValue =
    active?.type === 'hls'
      ? hlsLevel >= 0 && hlsLevels[hlsLevel]
        ? `${hlsLevels[hlsLevel]}p`
        : 'Auto'
      : quality;
  const hasEpisodes = type === 'tv' && !!episodes && episodes.length > 0;

  return (
    <div
      ref={containerRef}
      className={cn('relative bg-black overflow-hidden select-none outline-none', className)}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: needed for keyboard shortcuts
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseMove={showControls}
    >
      {/* biome-ignore lint/a11y/useMediaCaption: subtitle tracks added dynamically */}
      <video
        ref={videoRef}
        className={cn('absolute inset-0 h-full w-full bg-black', fit === 'cover' ? 'object-cover' : 'object-contain')}
        autoPlay={autoPlay}
        playsInline
        preload="auto"
        crossOrigin="anonymous"
      >
        {subs.map((s, i) => (
          <track
            key={s.url}
            kind="subtitles"
            src={s.url}
            label={s.label ?? s.lang ?? `Subtitle ${i + 1}`}
            srcLang={s.lang ?? 'en'}
          />
        ))}
      </video>

      {/* gesture surface (tap = controls, double-tap sides = ±10s) */}
      {status === 'ready' && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled on container
        <div className="absolute inset-0 z-10" onClick={onSurfaceTap} aria-hidden="true" />
      )}

      {/* loading / buffering spinner */}
      {(status === 'loading' || buffering) && status !== 'error' && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <span className="relative flex h-16 w-16 items-center justify-center">
            <span className="absolute inset-0 rounded-full border-4 border-white/10" />
            <span className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#e50914] animate-spin" />
          </span>
        </div>
      )}

      {/* controls overlay (pointer-events only on the actual controls) */}
      {status === 'ready' && (
        <div
          className={cn(
            'absolute inset-0 z-20 flex flex-col justify-between pointer-events-none transition-opacity duration-300',
            controlsShown || !playing ? 'opacity-100' : 'opacity-0',
          )}
        >
          {/* top: title logo — only in fullscreen */}
          <div className="bg-gradient-to-b from-black/70 to-transparent px-4 pt-4 pb-10 pointer-events-auto">
            {fullscreen && logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={title ?? ''}
                loading="lazy"
                className="max-h-8 md:max-h-14 w-auto max-w-[45%] object-contain object-left drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              />
            ) : null}
          </div>

          {/* center play/pause */}
          {(controlsShown || !playing) && (
            <button
              type="button"
              onClick={togglePlay}
              aria-label={playing ? 'Pause' : 'Play'}
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto flex h-14 w-14 md:h-20 md:w-20 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur-sm hover:bg-black/60 transition-colors"
            >
              {playing ? (
                <svg width="30" height="30" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              )}
            </button>
          )}

          {/* episodes carousel */}
          {showEpisodes && hasEpisodes && (
            <div className="absolute bottom-[68px] md:bottom-[76px] left-0 right-0 pointer-events-auto px-3 md:px-5">
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {episodes!.map((ep, i) => {
                  const isCur = ep.season === season && ep.episode === episode;
                  return (
                    <button
                      key={`${ep.season}-${ep.episode}-${i}`}
                      type="button"
                      onClick={() => {
                        onSelectEpisode?.(ep.season, ep.episode);
                        setShowEpisodes(false);
                      }}
                      className={cn(
                        'shrink-0 w-32 md:w-44 rounded-md overflow-hidden border bg-black/60 text-left transition-colors',
                        isCur ? 'border-[#e50914]' : 'border-white/15 hover:border-white/40',
                      )}
                    >
                      <div className="relative aspect-video bg-white/5">
                        {ep.still ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={ep.still} alt="" loading="lazy" className="h-full w-full object-cover" />
                        ) : null}
                        <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 text-[10px] font-semibold text-white">
                          E{ep.episode}
                        </span>
                      </div>
                      <div className="px-2 py-1 text-[11px] text-white/80 line-clamp-1">
                        {ep.name ?? `Episode ${ep.episode}`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* bottom bar */}
          <div className="bg-gradient-to-t from-black/85 to-transparent px-3 md:px-5 pb-3 pt-12 pointer-events-auto">
            {/* scrubber */}
            <div
              ref={scrubRef}
              className="group/scrub relative h-4 flex items-center cursor-pointer"
              onPointerDown={(e) => {
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                scrubToClient(e.clientX);
              }}
              onPointerMove={(e) => {
                if (e.buttons === 1) scrubToClient(e.clientX);
              }}
            >
              <div className="absolute left-0 right-0 h-1 group-hover/scrub:h-1.5 rounded-full bg-white/25 transition-all">
                <div className="absolute h-full rounded-full bg-white/40" style={{ width: pct(buffered) }} />
                <div className="absolute h-full rounded-full bg-[#e50914]" style={{ width: pct(current) }} />
              </div>
              <div
                className="absolute h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-[#e50914] opacity-0 group-hover/scrub:opacity-100 transition-opacity"
                style={{ left: pct(current) }}
              />
            </div>

            <div className="mt-1 flex flex-nowrap items-center gap-2 md:gap-4 text-white">
              <Ctrl onClick={togglePlay} label={playing ? 'Pause' : 'Play'}>
                {playing ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                )}
              </Ctrl>

              {/* skip — hidden on compact (mobile, non-fullscreen) */}
              <Ctrl onClick={() => skip(-10)} label="Back 10s" className={fullscreen ? 'inline-flex' : 'hidden md:inline-flex'}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 4 4 11l7 7" /><path d="M4 11h11a5 5 0 0 1 0 10h-1" /></svg>
              </Ctrl>
              <Ctrl onClick={() => skip(10)} label="Forward 10s" className={fullscreen ? 'inline-flex' : 'hidden md:inline-flex'}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m13 4 7 7-7 7" /><path d="M20 11H9a5 5 0 0 0 0 10h1" /></svg>
              </Ctrl>

              {/* volume */}
              <div className="group/vol flex items-center gap-1">
                <Ctrl onClick={toggleMute} label={muted ? 'Unmute' : 'Mute'}>
                  {muted || volume === 0 ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="m22 9-6 6M16 9l6 6" /></svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" /><path d="M16 9a5 5 0 0 1 0 6M19 7a8 8 0 0 1 0 10" /></svg>
                  )}
                </Ctrl>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => changeVolume(Number(e.target.value))}
                  className="hidden md:block w-0 opacity-0 group-hover/vol:w-20 group-hover/vol:opacity-100 transition-all duration-200 h-1 cursor-pointer accent-[#e50914]"
                  aria-label="Volume"
                />
              </div>

              <span className="shrink-0 whitespace-nowrap text-xs md:text-sm tabular-nums text-white/90">
                {fmt(current)} <span className="text-white/40">/ {fmt(duration)}</span>
              </span>

              <div className="ml-auto flex flex-nowrap items-center gap-2 md:gap-4 shrink-0">
                {hasEpisodes && (
                  <Ctrl onClick={() => { setMenu(null); setShowEpisodes((s) => !s); }} label="Episodes" active={showEpisodes}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="4" width="14" height="12" rx="2" /><path d="M20 8v10a2 2 0 0 1-2 2H8" /></svg>
                  </Ctrl>
                )}

                {/* captions (CC) — dedicated button */}
                {subs.length > 0 && (
                  <Ctrl
                    onClick={() => { setShowEpisodes(false); setMenu(menu === 'captions' ? null : 'captions'); }}
                    label="Subtitles"
                    active={subIndex >= 0}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                      <rect x="2.5" y="5" width="19" height="14" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
                      <text x="12" y="15.5" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="currentColor" fontFamily="system-ui, sans-serif">CC</text>
                    </svg>
                  </Ctrl>
                )}

                {/* audio (dub) — dedicated button */}
                {languages.length > 1 && (
                  <Ctrl
                    onClick={() => { setShowEpisodes(false); setMenu(menu === 'audio' ? null : 'audio'); }}
                    label="Audio"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 14v-3a9 9 0 0 1 18 0v3" /><path d="M3 14a2 2 0 0 1 2-2h1v6H5a2 2 0 0 1-2-2zM21 14a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2z" /></svg>
                  </Ctrl>
                )}

                {/* settings (quality / speed / server) */}
                <Ctrl onClick={() => { setShowEpisodes(false); setMenu(menu === 'settings' || menu === 'quality' || menu === 'speed' || menu === 'server' ? null : 'settings'); }} label="Settings">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                </Ctrl>

                {/* fill-to-screen */}
                <Ctrl onClick={() => setFit((f) => (f === 'cover' ? 'contain' : 'cover'))} label="Fill to screen" active={fit === 'cover'}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="2.5" y="6" width="19" height="12" rx="1.5" />
                    <rect x="7.5" y="9.5" width="9" height="5" rx="1" fill={fit === 'cover' ? 'currentColor' : 'none'} stroke="none" />
                  </svg>
                </Ctrl>

                {/* fullscreen — diagonal expand (top-left + bottom-right) */}
                <Ctrl onClick={toggleFullscreen} label="Fullscreen">
                  {fullscreen ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 4v6H4" /><path d="m10 10-6-6" /><path d="M14 20v-6h6" /><path d="m14 14 6 6" /></svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4H4v5" /><path d="m4 4 6 6" /><path d="M15 20h5v-5" /><path d="m20 20-6-6" /></svg>
                  )}
                </Ctrl>
              </div>
            </div>
          </div>

          {/* menu panel */}
          {menu && (
            <div className="absolute bottom-[68px] md:bottom-[76px] right-3 md:right-5 min-w-44 max-h-[55vh] overflow-y-auto rounded-lg bg-black/95 border border-white/15 py-1 text-sm text-white shadow-2xl pointer-events-auto">
              {menu === 'settings' && (
                <>
                  {servers.length > 1 && <Row label="Server" value={server} onClick={() => setMenu('server')} />}
                  <Row label="Quality" value={qualityValue} onClick={() => setMenu('quality')} />
                  <Row label="Speed" value={`${rate}x`} onClick={() => setMenu('speed')} />
                </>
              )}
              {menu === 'server' &&
                servers.map((srv) => (
                  <Opt
                    key={srv}
                    label={srv}
                    active={srv === server}
                    onClick={() => {
                      setServer(srv);
                      const has = sources.filter((s) => s.provider === srv);
                      if (!has.some((s) => dubLabel(s) === lang)) {
                        const first = has[0];
                        if (first) {
                          setLang(dubLabel(first));
                          setQuality(qLabel(first));
                        }
                      }
                      setMenu(null);
                    }}
                  />
                ))}
              {menu === 'audio' &&
                languages.map((l) => (
                  <Opt
                    key={l}
                    label={l}
                    active={l === lang}
                    onClick={() => {
                      setLang(l);
                      const qs = qualitiesFor(l);
                      if (!qs.includes(quality)) setQuality(qs[0] ?? '');
                      setMenu(null);
                    }}
                  />
                ))}
              {menu === 'quality' &&
                (active?.type === 'hls' && hlsLevels.length > 0 ? (
                  <>
                    <Opt
                      label="Auto"
                      active={hlsLevel === -1}
                      onClick={() => {
                        setHlsLevel(-1);
                        if (hlsApiRef.current) hlsApiRef.current.currentLevel = -1;
                        setMenu(null);
                      }}
                    />
                    {hlsLevels
                      .map((h, i) => ({ h, i }))
                      .sort((a, b) => b.h - a.h)
                      .map(({ h, i }) => (
                        <Opt
                          key={i}
                          label={`${h}p`}
                          active={hlsLevel === i}
                          onClick={() => {
                            setHlsLevel(i);
                            if (hlsApiRef.current) hlsApiRef.current.currentLevel = i;
                            setMenu(null);
                          }}
                        />
                      ))}
                  </>
                ) : (
                  qualities.map((q) => (
                    <Opt key={q} label={q} active={q === quality} onClick={() => { setQuality(q); setMenu(null); }} />
                  ))
                ))}
              {menu === 'speed' &&
                SPEEDS.map((sp) => (
                  <Opt
                    key={sp}
                    label={`${sp}x`}
                    active={sp === rate}
                    onClick={() => {
                      if (videoRef.current) videoRef.current.playbackRate = sp;
                      setMenu(null);
                    }}
                  />
                ))}
              {menu === 'captions' && (
                <>
                  <Opt label="Off" active={subIndex === -1} onClick={() => { setSubIndex(-1); setMenu(null); }} />
                  {subs.map((s, i) => (
                    <Opt
                      key={s.url}
                      label={s.label ?? s.lang ?? `Subtitle ${i + 1}`}
                      active={i === subIndex}
                      onClick={() => { setSubIndex(i); setMenu(null); }}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black px-4 text-center">
          <div className="text-sm font-semibold uppercase tracking-[0.14em] text-white">Unable to play</div>
          <div className="text-xs text-white/50">{errorMsg}</div>
        </div>
      )}

      {/* close panels when tapping elsewhere */}
      {(menu || showEpisodes) && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: dismiss layer
        <div className="absolute inset-0 z-[19]" onClick={closePanels} aria-hidden="true" />
      )}
    </div>
  );
}

function Ctrl({
  onClick,
  label,
  active,
  className,
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn('text-white/90 hover:text-white transition-colors', active && 'text-[#e50914] hover:text-[#e50914]', className)}
    >
      {children}
    </button>
  );
}

function Row({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-6 px-3 py-2 hover:bg-white/10">
      <span>{label}</span>
      <span className="text-white/50 text-xs">{value} ›</span>
    </button>
  );
}

function Opt({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-2 px-3 py-2 hover:bg-white/10">
      <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-[#e50914]' : 'bg-transparent')} />
      <span className={cn(active ? 'text-white' : 'text-white/70')}>{label}</span>
    </button>
  );
}
