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

interface Props {
  type: 'movie' | 'tv';
  tmdbId: number;
  season?: number;
  episode?: number;
  className?: string;
  autoPlay?: boolean;
  title?: string;
  logoUrl?: string;
  onReady?: () => void;
}

const DEFAULT_LABEL = 'Default';
const PROVIDER_ORDER = ['Iron', 'Spider', 'Wolf', 'Multi', 'Dark'];
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const qLabel = (s: StreamSource) => (s.type === 'hls' ? 'Auto' : s.quality ? `${s.quality}p` : 'Auto');
const dubLabel = (s: StreamSource) => s.dub ?? DEFAULT_LABEL;

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
  onReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const failedRef = useRef<Set<string>>(new Set());
  const startedRef = useRef(false);
  const resumeRef = useRef<{ time: number; playing: boolean } | null>(null);
  const retryRef = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sources, setSources] = useState<StreamSource[]>([]);
  const [subs, setSubs] = useState<StreamSubtitle[]>([]);
  const [lang, setLang] = useState('');
  const [quality, setQuality] = useState('');
  const [server, setServer] = useState('');
  const [active, setActive] = useState<StreamSource | null>(null);
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
  const [fit, setFit] = useState<'contain' | 'cover'>('contain');
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsShown, setControlsShown] = useState(true);
  const [menu, setMenu] = useState<
    null | 'main' | 'server' | 'audio' | 'quality' | 'speed' | 'subs'
  >(null);

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

  // defaults: take the top of the (HLS-first, provider-ordered) list so the
  // default stream is the preferred server/type; English subtitles on.
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
    retryRef.current = 0;

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
    const onError = () => {
      if (destroyed) return;
      if (!startedRef.current) return fallback();
      if (retryRef.current < 1) {
        retryRef.current += 1;
        resumeRef.current = { time: video.currentTime, playing: !video.paused };
        video.load();
      } else fallback();
    };

    video.addEventListener('loadedmetadata', applyResume);
    video.addEventListener('error', onError);

    const useHls = s.type === 'hls' && !video.canPlayType('application/vnd.apple.mpegurl');
    if (useHls) {
      import('hls.js')
        .then(({ default: Hls }) => {
          if (destroyed) return;
          if (!Hls.isSupported()) {
            video.src = s.url;
            return;
          }
          const hls = new Hls({ enableWorker: true });
          hlsRef.current = hls;
          hls.loadSource(s.url);
          hls.attachMedia(video);
          hls.on(Hls.Events.ERROR, (_e, data) => {
            if (!data.fatal) return;
            if (data.type === 'networkError') hls.startLoad();
            else if (data.type === 'mediaError') hls.recoverMediaError();
            else {
              hls.destroy();
              if (!startedRef.current) fallback();
            }
          });
        })
        .catch(fallback);
    } else {
      video.src = s.url;
    }
    return () => {
      destroyed = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeEventListener('loadedmetadata', applyResume);
      video.removeEventListener('error', onError);
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

  // subtitle track selection
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const tracks = v.textTracks;
    for (let i = 0; i < tracks.length; i++) tracks[i]!.mode = i === subIndex ? 'showing' : 'disabled';
  }, [subIndex, subs, active?.url, status]);

  // fullscreen tracking
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
      if (!videoRef.current?.paused) {
        setControlsShown(false);
        setMenu(null);
      }
    }, 3000);
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
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else el.requestFullscreen().catch(() => {});
  }, []);

  // keyboard
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
        case 'c':
          setSubIndex((i) => (i === -1 ? (subs.length ? 0 : -1) : -1));
          break;
        default:
          return;
      }
      showControls();
    },
    [togglePlay, skip, changeVolume, toggleFullscreen, toggleMute, subs.length, showControls],
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

  return (
    <div
      ref={containerRef}
      className={cn('relative bg-black overflow-hidden select-none outline-none group', className)}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: needed for keyboard shortcuts
      tabIndex={0}
      onKeyDown={onKeyDown}
      onMouseMove={showControls}
      onPointerDown={showControls}
    >
      {/* biome-ignore lint/a11y/useMediaCaption: subtitle tracks added dynamically */}
      <video
        ref={videoRef}
        className={cn('absolute inset-0 h-full w-full bg-black', fit === 'cover' ? 'object-cover' : 'object-contain')}
        autoPlay={autoPlay}
        playsInline
        preload="auto"
        crossOrigin="anonymous"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
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

      {/* buffering / loading spinner */}
      {(status === 'loading' || buffering) && status !== 'error' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-white/25 border-t-white" />
        </div>
      )}

      {/* center play (when paused & ready) */}
      {status === 'ready' && !playing && !buffering && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play"
          className="absolute inset-0 z-10 flex items-center justify-center"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-black/50 text-white">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
          </span>
        </button>
      )}

      {/* controls overlay */}
      {status === 'ready' && (
        <div
          className={cn(
            'absolute inset-0 z-20 flex flex-col justify-between transition-opacity duration-300',
            controlsShown || !playing ? 'opacity-100' : 'opacity-0 pointer-events-none',
          )}
        >
          {/* top: title logo (falls back to text) */}
          <div className="bg-gradient-to-b from-black/70 to-transparent px-4 pt-4 pb-10">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt={title ?? ''}
                loading="lazy"
                className="max-h-10 md:max-h-16 w-auto max-w-[55%] object-contain object-left drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              />
            ) : title ? (
              <h2 className="text-white text-base md:text-xl font-semibold drop-shadow">{title}</h2>
            ) : null}
          </div>

          {/* bottom controls */}
          <div className="bg-gradient-to-t from-black/80 to-transparent px-3 md:px-5 pb-3 pt-12">
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
                className="absolute h-3 w-3 -translate-x-1/2 rounded-full bg-[#e50914] opacity-0 group-hover/scrub:opacity-100 transition-opacity"
                style={{ left: pct(current) }}
              />
            </div>

            <div className="mt-1 flex items-center gap-3 md:gap-4 text-white">
              <Ctrl onClick={togglePlay} label={playing ? 'Pause' : 'Play'}>
                {playing ? (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                )}
              </Ctrl>
              <Ctrl onClick={() => skip(-10)} label="Back 10s">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M11 17l-5-5 5-5M18 17l-5-5 5-5" /></svg>
              </Ctrl>
              <Ctrl onClick={() => skip(10)} label="Forward 10s">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M13 17l5-5-5-5M6 17l5-5-5-5" /></svg>
              </Ctrl>

              <div className="group/vol flex items-center">
                <Ctrl onClick={toggleMute} label={muted ? 'Unmute' : 'Mute'}>
                  {muted || volume === 0 ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 00-2.5-4v8a4.5 4.5 0 002.5-4z" opacity="0.4" /><path d="M19 5l-2 2m0 10l2 2" stroke="currentColor" strokeWidth="2" /></svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 8v8a4.5 4.5 0 002.5-4zM14 3.2v2.1a6.5 6.5 0 010 13.4v2.1a8.5 8.5 0 000-17.6z" /></svg>
                  )}
                </Ctrl>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => changeVolume(Number(e.target.value))}
                  className="w-0 group-hover/vol:w-20 transition-all duration-200 accent-white h-1 cursor-pointer"
                  aria-label="Volume"
                />
              </div>

              <span className="text-xs md:text-sm tabular-nums text-white/90">
                {fmt(current)} <span className="text-white/40">/ {fmt(duration)}</span>
              </span>

              <div className="ml-auto flex items-center gap-3 md:gap-4">
                {subs.length > 0 && (
                  <Ctrl onClick={() => setMenu(menu === 'subs' ? null : 'subs')} label="Subtitles" active={subIndex >= 0}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm2 9h6v2H6v-2zm8 0h4v2h-4v-2zM6 9h4v2H6V9zm6 0h6v2h-6V9z" /></svg>
                  </Ctrl>
                )}
                <Ctrl onClick={() => setMenu(menu ? null : 'main')} label="Settings">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" /></svg>
                </Ctrl>
                {/* Fill-to-screen: a screen frame with an inner content rect.
                    Filled inner = currently cropped-to-fill; outline = letterboxed.
                    Visually distinct from the fullscreen corner-arrows icon. */}
                <Ctrl onClick={() => setFit((f) => (f === 'cover' ? 'contain' : 'cover'))} label="Fill to screen" active={fit === 'cover'}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <rect x="2.5" y="6" width="19" height="12" rx="1.5" />
                    <rect x="7.5" y="9.5" width="9" height="5" rx="1" fill={fit === 'cover' ? 'currentColor' : 'none'} stroke="none" />
                  </svg>
                </Ctrl>
                <Ctrl onClick={toggleFullscreen} label="Fullscreen">
                  {fullscreen ? (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3" /></svg>
                  ) : (
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M8 21H5a2 2 0 01-2-2v-3M16 21h3a2 2 0 002-2v-3" /></svg>
                  )}
                </Ctrl>
              </div>
            </div>
          </div>

          {/* menu panel */}
          {menu && (
            <div className="absolute bottom-20 right-4 min-w-44 max-h-[55vh] overflow-y-auto rounded-lg bg-black/95 border border-white/15 py-1 text-sm text-white shadow-2xl">
              {menu === 'main' && (
                <>
                  {servers.length > 1 && <Row label="Server" value={server} onClick={() => setMenu('server')} />}
                  <Row label="Audio" value={lang} onClick={() => setMenu('audio')} />
                  <Row label="Quality" value={quality} onClick={() => setMenu('quality')} />
                  <Row label="Speed" value={`${rate}x`} onClick={() => setMenu('speed')} />
                  {subs.length > 0 && (
                    <Row
                      label="Subtitles"
                      value={subIndex >= 0 ? (subs[subIndex]?.label ?? 'On') : 'Off'}
                      onClick={() => setMenu('subs')}
                    />
                  )}
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
                      // Move to a language/quality this server actually provides.
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
                qualities.map((q) => (
                  <Opt key={q} label={q} active={q === quality} onClick={() => { setQuality(q); setMenu(null); }} />
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
              {menu === 'subs' && (
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
    </div>
  );
}

function Ctrl({ onClick, label, active, children }: { onClick: () => void; label: string; active?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn('text-white/90 hover:text-white transition-colors', active && 'text-[#e50914] hover:text-[#e50914]')}
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
