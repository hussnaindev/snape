'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import { claimActiveMedia, isFullscreenRoot, releaseActiveMedia, silenceOtherVideos } from '@/lib/active-media';
import { publishPlaybackProgress } from '@/lib/playback-progress';
import { cn } from '@/lib/utils';
import { getResumePosition } from '@/lib/watch-history';

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
  /** When set, fullscreen targets this element instead of the player root. */
  fullscreenRootRef?: RefObject<HTMLElement | null>;
}

const DEFAULT_LABEL = 'Default';
const PROVIDER_ORDER = ['Iron', 'Spider', 'Wolf', 'Multi', 'Dark', 'Xpass'];
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const streamCache = new Map<string, StreamResponse>();
const streamInflight = new Map<string, Promise<StreamResponse>>();
const IS_DEV = process.env.NODE_ENV === 'development';

function streamKey(type: string, tmdbId: number, season?: number, episode?: number) {
  return type === 'tv' ? `tv:${tmdbId}:${season}:${episode}` : `movie:${tmdbId}`;
}

function invalidateStreamCache(type: string, tmdbId: number, season?: number, episode?: number) {
  streamCache.delete(streamKey(type, tmdbId, season, episode));
}

function upstreamHost(sourceUrl: string): string {
  try {
    const u = new URL(sourceUrl, 'http://localhost');
    const raw = u.searchParams.get('u');
    if (raw) return new URL(decodeURIComponent(raw)).hostname.toLowerCase();
  } catch {}
  return '';
}

/** mp4 first, then non-goodstream HLS, then goodstream last. */
function sourceRank(s: StreamSource): number {
  if (s.type === 'mp4') return 0;
  if (/goodstream\.cc/i.test(upstreamHost(s.url))) return 2;
  return 1;
}

function bestSource(list: StreamSource[]): StreamSource | null {
  if (list.length === 0) return null;
  return [...list].sort((a, b) => sourceRank(a) - sourceRank(b))[0] ?? null;
}

function loadStreamData(key: string, url: string): Promise<StreamResponse> {
  if (!IS_DEV) {
    const cached = streamCache.get(key);
    if (cached) return Promise.resolve(cached);
  }
  let inflight = streamInflight.get(key);
  if (!inflight) {
    const fetchUrl = IS_DEV ? `${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}` : url;
    inflight = fetch(fetchUrl, { cache: 'no-store' })
      .then((r) => r.json() as Promise<StreamResponse>)
      .then((json) => {
        if (json.ok && json.data && json.data.sources.length > 0) {
          if (!IS_DEV) streamCache.set(key, json);
        } else {
          streamCache.delete(key);
        }
        return json;
      })
      .finally(() => streamInflight.delete(key));
    streamInflight.set(key, inflight);
  }
  return inflight;
}

/**
 * Warm the stream-source cache ahead of playback. Call this from a detail page
 * (e.g. on mount) so extraction runs in parallel while the user reads the page;
 * when they hit Watch, the player's own fetch resolves instantly from this cache
 * or joins the already-in-flight request. No-op in dev (caching disabled there).
 */
export function prefetchStream(type: 'movie' | 'tv', tmdbId: number, season?: number, episode?: number) {
  if (IS_DEV) return;
  if (type === 'tv' && (season == null || episode == null)) return;
  const key = streamKey(type, tmdbId, season, episode);
  if (streamCache.has(key) || streamInflight.has(key)) return;
  const qs = type === 'tv' ? `?season=${season}&episode=${episode}` : '';
  void loadStreamData(key, `/api/stream/${type}/${tmdbId}${qs}`).catch(() => {});
}

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
  fullscreenRootRef,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsApiRef = useRef<import('hls.js').default | null>(null);
  const failedRef = useRef<Set<string>>(new Set());
  const startedRef = useRef(false);
  const attachGenRef = useRef(0);
  const fetchGenRef = useRef(0);
  const sourcesInitKeyRef = useRef('');
  const resumeRef = useRef<{ time: number; playing: boolean } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<{ t: number; x: number }>({ t: 0, x: 0 });
  const controlsShownRef = useRef(true);
  // Controls-shown state captured at pointerdown — before any synthetic mousemove
  // from the tap can flip it — so the deferred single-tap toggles the right way.
  const tapShownRef = useRef(true);

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
  const [errorType, setErrorType] = useState<'no-sources' | 'playback-failed' | 'network' | null>(null);

  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [current, setCurrent] = useState(0);
  const [scrubPreview, setScrubPreview] = useState<number | null>(null);
  const [hoverFrac, setHoverFrac] = useState<number | null>(null);
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
      // Exclude already-failed sources at every level. Without this, when failover
      // advances by setActive(next) but lang/quality/server stay the same (e.g. all
      // xpass sources share Default/Auto/Xpass), the selection effect re-runs
      // pickSource and reverts active to the same first/failed source.
      const avail = sources.filter((s) => !failedRef.current.has(s.url));
      const inLang = avail.filter((s) => dubLabel(s) === l);
      return (
        bestSource(inLang.filter((s) => qLabel(s) === q && s.provider === srv)) ??
        bestSource(inLang.filter((s) => s.provider === srv)) ??
        bestSource(inLang.filter((s) => qLabel(s) === q)) ??
        bestSource(inLang) ??
        bestSource(avail) ??
        null
      );
    },
    [sources],
  );

  useEffect(() => {
    const gen = ++fetchGenRef.current;
    sourcesInitKeyRef.current = '';
    setStatus('loading');
    setSources([]);
    setActive(null);
    setBuffering(false);
    failedRef.current = new Set();
    startedRef.current = false;
    // Cross-session resume: seed from saved watch-history position so the first
    // successful load seeks there (markReady applies resumeRef). In-session
    // quality/server switches re-seed resumeRef separately below.
    const startAt = getResumePosition(tmdbId, type === 'tv' ? 'series' : 'movie', season, episode);
    resumeRef.current = startAt > 0 ? { time: startAt, playing: autoPlay } : null;

    const qs = type === 'tv' ? `?season=${season}&episode=${episode}` : '';
    const key = streamKey(type, tmdbId, season, episode);
    loadStreamData(key, `/api/stream/${type}/${tmdbId}${qs}`)
      .then((json) => {
        if (fetchGenRef.current !== gen) return;
        if (!json.ok || !json.data || json.data.sources.length === 0) {
          invalidateStreamCache(type, tmdbId, season, episode);
          setStatus('error');
          setErrorType('no-sources');
          if (IS_DEV) console.error('No sources available', { json, type, tmdbId, season, episode });
          return;
        }
        setSources(json.data.sources);
        setSubs(json.data.subtitles);
      })
      .catch((err) => {
        if (fetchGenRef.current !== gen) return;
        invalidateStreamCache(type, tmdbId, season, episode);
        setStatus('error');
        setErrorType('network');
        console.error('Failed to load sources:', err);
      });
  }, [type, tmdbId, season, episode, autoPlay]);

  useEffect(() => {
    if (sources.length === 0) return;
    const initKey = streamKey(type, tmdbId, season, episode);
    if (sourcesInitKeyRef.current === initKey) return;
    sourcesInitKeyRef.current = initKey;
    const first = bestSource(sources)!;
    setLang(dubLabel(first));
    setQuality(qLabel(first));
    setServer(first.provider);
    const en = subs.findIndex((s) => /^en|english/i.test(s.lang ?? '') || /english/i.test(s.label ?? ''));
    setSubIndex(en);
  }, [sources, subs, type, tmdbId, season, episode]);

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
    const gen = ++attachGenRef.current;
    let destroyed = false;
    let hls: import('hls.js').default | null = null;
    let fallbackUsed = false;
    // Per-attach guard: markReady runs once for THIS source (first load or a
    // quality/server switch). Gating on the global startedRef instead would skip
    // the resume seek on every switch after the first, restarting from 0.
    let ready = false;
    setHlsLevels([]);
    setHlsLevel(-1);
    setBuffering(true);

    const stopMedia = () => {
      const instance = hls ?? hlsApiRef.current;
      if (instance) {
        try {
          instance.stopLoad();
          instance.detachMedia();
          instance.destroy();
        } catch {}
        if (hlsApiRef.current === instance) hlsApiRef.current = null;
        hls = null;
      }
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch {}
    };
    const releaseClaim = () => releaseActiveMedia(stopMedia);
    claimActiveMedia(stopMedia, video);

    const markReady = () => {
      if (destroyed || attachGenRef.current !== gen || ready) return;
      ready = true;
      const r = resumeRef.current;
      if (r) {
        try {
          video.currentTime = r.time;
        } catch {}
        if (r.playing) video.play().catch(() => {});
        resumeRef.current = null;
      }
      if (onError) {
        video.removeEventListener('error', onError);
        onError = null;
      }
      setStatus('ready');
      setBuffering(false);
      startedRef.current = true;
      onReady?.();
    };
    const fallback = (error?: Error | null) => {
      if (fallbackUsed || startedRef.current || destroyed || attachGenRef.current !== gen) return;
      fallbackUsed = true;
      stopMedia();
      failedRef.current.add(s.url);
      if (error) console.error('Source playback failed:', s, error);
      const remaining = sources.filter((c) => !failedRef.current.has(c.url));
      const next = bestSource(remaining);
      if (next) {
        setLang(dubLabel(next));
        setQuality(qLabel(next));
        setServer(next.provider);
        setActive(next);
      } else {
        invalidateStreamCache(type, tmdbId, season, episode);
        setStatus('error');
        setErrorType('playback-failed');
        if (IS_DEV) console.error('All sources failed:', { failedSources: Array.from(failedRef.current) });
      }
    };

    video.addEventListener('loadedmetadata', markReady);
    video.addEventListener('canplay', markReady);
    video.addEventListener('playing', markReady);

    const useHls = s.type === 'hls' && !video.canPlayType('application/vnd.apple.mpegurl');
    let onError: (() => void) | null = null;

    if (useHls) {
      import('hls.js')
        .then(({ default: Hls }) => {
          if (destroyed || attachGenRef.current !== gen) return;
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
            if (destroyed || attachGenRef.current !== gen) return;
            setHlsLevels(instance.levels.map((l) => l.height || 0));
            const top = instance.levels.length - 1;
            instance.currentLevel = top;
            setHlsLevel(top);
            markReady();
          });
          let netRetry = 0;
          let mediaRetry = 0;
          instance.on(Hls.Events.ERROR, (_e, data) => {
            if (destroyed || attachGenRef.current !== gen) return;
            if (!data.fatal) return;
            const manifestDead =
              data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR ||
              data.details === Hls.ErrorDetails.MANIFEST_LOAD_TIMEOUT ||
              data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR;
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !manifestDead && netRetry++ < 1) {
              instance.startLoad();
              return;
            }
            if (data.type === Hls.ErrorTypes.MEDIA_ERROR && mediaRetry++ < 1) {
              instance.recoverMediaError();
              return;
            }
            fallback(new Error(`HLS ${data.type}: ${data.details ?? data.reason ?? 'fatal'}`));
          });
        })
        .catch((err) => fallback(err));
    } else {
      video.src = s.url;
      onError = () => {
        if (destroyed || attachGenRef.current !== gen) return;
        if (!startedRef.current) {
          const error = video.error ? new Error(`MediaError ${video.error.code}: ${video.error.message}`) : new Error('Unknown video error');
          fallback(error);
        }
      };
      video.addEventListener('error', onError);
    }

    return () => {
      destroyed = true;
      releaseClaim();
      stopMedia();
      video.removeEventListener('loadedmetadata', markReady);
      video.removeEventListener('canplay', markReady);
      video.removeEventListener('playing', markReady);
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
    const onPlay = () => {
      silenceOtherVideos(v);
      setPlaying(true);
    };
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

  // Emit real playback progress so the watch-history recorder can persist
  // position for cross-session resume. Throttled on timeupdate (~5s) with an
  // immediate report on pause, end, and tab-hide so the latest position sticks.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let last = 0;
    const report = (ended: boolean) => {
      if (!startedRef.current) return;
      const dur = v.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;
      if (!ended && v.currentTime <= 0) return;
      publishPlaybackProgress({
        type,
        tmdbId,
        positionSeconds: v.currentTime,
        durationSeconds: dur,
        ended,
        ...(season !== undefined ? { season } : {}),
        ...(episode !== undefined ? { episode } : {}),
      });
    };
    const onTime = () => {
      const now = Date.now();
      if (now - last < 5000) return;
      last = now;
      report(false);
    };
    const onPause = () => report(false);
    const onEnded = () => report(true);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') report(false);
    };
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('pause', onPause);
    v.addEventListener('ended', onEnded);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('pause', onPause);
      v.removeEventListener('ended', onEnded);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [type, tmdbId, season, episode]);

  // Imperatively attach subtitle tracks so React never adds/removes <track>
  // children during playback (which can restart the media element in some browsers).
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    for (const track of [...v.querySelectorAll('track')]) track.remove();
    for (const [i, s] of subs.entries()) {
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.src = s.url;
      track.label = s.label ?? s.lang ?? `Subtitle ${i + 1}`;
      track.srclang = s.lang ?? 'en';
      v.appendChild(track);
    }
  }, [subs, active?.url]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const tracks = v.textTracks;
    for (let i = 0; i < tracks.length; i++) tracks[i]!.mode = i === subIndex ? 'showing' : 'disabled';
  }, [subIndex, subs, active?.url, status]);

  useEffect(() => {
    const onFs = () => {
      const root = fullscreenRootRef?.current ?? containerRef.current;
      // Defer until after the browser finishes reparenting fullscreen nodes.
      requestAnimationFrame(() => {
        setFullscreen(isFullscreenRoot(root));
      });
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [fullscreenRootRef]);

  // Hard stop on unmount: tear down hls + pause and detach the media element so
  // no audio keeps playing when the player is removed — e.g. navigating between
  // detail pages, or switching episodes (which remounts the player via its key).
  useEffect(() => {
    const video = videoRef.current;
    const stopAll = () => {
      if (hlsApiRef.current) {
        try {
          hlsApiRef.current.stopLoad();
          hlsApiRef.current.detachMedia();
          hlsApiRef.current.destroy();
        } catch {}
        hlsApiRef.current = null;
      }
      if (video) {
        try {
          video.pause();
          video.removeAttribute('src');
          video.load();
        } catch {}
      }
    };
    return () => {
      releaseActiveMedia(stopAll);
      stopAll();
    };
  }, []);

  // ---------- controls ----------
  const showControls = useCallback(() => {
    setControlsShown(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (!videoRef.current?.paused) setControlsShown(false);
    }, 3200);
  }, []);

  const hideControls = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setControlsShown(false);
  }, []);

  // Mirror controlsShown into a ref so the deferred tap handler reads the latest.
  useEffect(() => {
    controlsShownRef.current = controlsShown;
  }, [controlsShown]);

  // Clear pending timers on unmount.
  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (tapTimer.current) clearTimeout(tapTimer.current);
    },
    [],
  );

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
    const el = fullscreenRootRef?.current ?? containerRef.current;
    if (!el) return;
    if (isFullscreenRoot(el)) {
      document.exitFullscreen().catch(() => {});
      (screen.orientation as OrientationLock)?.unlock?.();
    } else {
      el.requestFullscreen()
        .then(() => (screen.orientation as OrientationLock)?.lock?.('landscape')?.catch(() => {}))
        .catch(() => {});
    }
  }, [fullscreenRootRef]);

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

      if (isDouble) {
        // Double-tap: cancel the pending single-tap toggle, then seek (sides) or
        // play/pause (center) and reveal the controls.
        if (tapTimer.current) {
          clearTimeout(tapTimer.current);
          tapTimer.current = null;
        }
        const third = rect.width / 3;
        if (x < third) skip(-10);
        else if (x > third * 2) skip(10);
        else togglePlay();
        showControls();
        return;
      }

      // Single tap: tiny 100ms defer so a quick double-tap can cancel it, then
      // toggle. The decision uses the state captured at pointerdown (tapShownRef)
      // so a synthetic mousemove from the tap can't flip it first.
      if (tapTimer.current) clearTimeout(tapTimer.current);
      tapTimer.current = setTimeout(() => {
        tapTimer.current = null;
        if (tapShownRef.current) hideControls();
        else showControls();
      }, 100);
    },
    [showControls, hideControls, skip, togglePlay],
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
  const scrubToFraction = useCallback(
    (clientX: number) => {
      const el = scrubRef.current;
      if (!el || !duration) return 0;
      const rect = el.getBoundingClientRect();
      return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    },
    [duration],
  );
  const commitScrub = useCallback(
    (clientX: number) => {
      if (!duration) return;
      seekTo(scrubToFraction(clientX) * duration);
    },
    [duration, scrubToFraction, seekTo],
  );

  const pct = (v: number) => (duration ? `${(v / duration) * 100}%` : '0%');
  const displayTime = scrubPreview ?? current;
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
  const streamFormat =
    active?.type === 'hls' ? 'HLS' : active?.type === 'mp4' ? 'MP4' : status === 'loading' ? '…' : '—';
  const activeServer = active?.provider ?? (server || '—');
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
      />

      {/* gesture surface (tap = controls, double-tap sides = ±10s) */}
      {status === 'ready' && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled on container
        <div
          className="absolute inset-0 z-10"
          onPointerDown={() => {
            tapShownRef.current = controlsShownRef.current;
          }}
          onClick={onSurfaceTap}
          aria-hidden="true"
        />
      )}

      {/* loading / buffering spinner — hide once playback has started */}
      {((status === 'loading' && !playing) || buffering) && status !== 'error' && (
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
          <div
            className={cn(
              'bg-gradient-to-b from-black/70 to-transparent px-4 pt-4 pb-10',
              controlsShown || !playing ? 'pointer-events-auto' : 'pointer-events-none',
            )}
          >
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
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto flex h-14 w-14 md:h-20 md:w-20 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20 hover:border-white/30 transition-colors"
            >
              {playing ? (
                <svg width="34" height="34" viewBox="0 0 36 36" fill="currentColor" aria-hidden="true"><path d="M12.75 4.5h-3A2.25 2.25 0 0 0 7.5 6.75v22.5a2.25 2.25 0 0 0 2.25 2.25h3A2.25 2.25 0 0 0 15 29.25V6.75a2.25 2.25 0 0 0-2.25-2.25Zm13.5 0h-3A2.25 2.25 0 0 0 21 6.75v22.5a2.25 2.25 0 0 0 2.25 2.25h3a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25Z" /></svg>
              ) : (
                <svg width="36" height="36" viewBox="0 0 36 36" fill="currentColor" aria-hidden="true"><path d="M10.89 4.99A2.25 2.25 0 0 0 7.5 6.93v22.13a2.25 2.25 0 0 0 3.39 1.94l19-11.06a2.25 2.25 0 0 0 0-3.89l-19-11.06Z" /></svg>
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
          <div
            className={cn(
              'bg-gradient-to-t from-black/85 to-transparent px-3 md:px-5 pb-3 pt-12',
              controlsShown || !playing ? 'pointer-events-auto' : 'pointer-events-none',
            )}
          >
            {/* scrubber — YouTube-style progress bar */}
            <div
              ref={scrubRef}
              className="group/scrub relative h-3 flex items-center cursor-pointer"
              onPointerDown={(e) => {
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                if (duration) setScrubPreview(scrubToFraction(e.clientX) * duration);
              }}
              onPointerMove={(e) => {
                if (!duration) return;
                setHoverFrac(scrubToFraction(e.clientX));
                if (e.buttons === 1) setScrubPreview(scrubToFraction(e.clientX) * duration);
              }}
              onPointerLeave={() => setHoverFrac(null)}
              onPointerUp={(e) => {
                commitScrub(e.clientX);
                setScrubPreview(null);
              }}
              onPointerCancel={() => setScrubPreview(null)}
            >
              <div className="absolute left-0 right-0 h-[3px] group-hover/scrub:h-[5px] bg-white/20 transition-[height] duration-100">
                {/* loaded buffer */}
                <div className="absolute inset-y-0 left-0 bg-white/40" style={{ width: pct(buffered) }} />
                {/* hover preview */}
                {hoverFrac !== null && (
                  <div className="absolute inset-y-0 left-0 bg-white/50" style={{ width: `${hoverFrac * 100}%` }} />
                )}
                {/* played */}
                <div className="absolute inset-y-0 left-0 bg-[#f00]" style={{ width: pct(displayTime) }} />
              </div>
              {/* scrubber knob */}
              <div
                className="absolute h-[13px] w-[13px] -translate-x-1/2 rounded-full bg-[#f00] scale-0 group-hover/scrub:scale-100 transition-transform duration-100"
                style={{ left: pct(displayTime) }}
              />
            </div>

            <div className="mt-1 flex flex-nowrap items-center gap-2 md:gap-4 text-white">
              <Ctrl onClick={togglePlay} label={playing ? 'Pause' : 'Play'}>
                {playing ? (
                  <svg width="26" height="26" viewBox="0 0 36 36" fill="currentColor" aria-hidden="true"><path d="M12.75 4.5h-3A2.25 2.25 0 0 0 7.5 6.75v22.5a2.25 2.25 0 0 0 2.25 2.25h3A2.25 2.25 0 0 0 15 29.25V6.75a2.25 2.25 0 0 0-2.25-2.25Zm13.5 0h-3A2.25 2.25 0 0 0 21 6.75v22.5a2.25 2.25 0 0 0 2.25 2.25h3a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25Z" /></svg>
                ) : (
                  <svg width="26" height="26" viewBox="0 0 36 36" fill="currentColor" aria-hidden="true"><path d="M10.89 4.99A2.25 2.25 0 0 0 7.5 6.93v22.13a2.25 2.25 0 0 0 3.39 1.94l19-11.06a2.25 2.25 0 0 0 0-3.89l-19-11.06Z" /></svg>
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
                    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="currentColor" d="M11.6 2.08 11.48 2.14 3.91 6.68C3.02 7.21 2.28 7.97 1.77 8.87 1.26 9.77 1 10.79 1 11.83V12.16C1.07 13.52 1.37 14.46 1.87 15.29 2.38 16.12 3.08 16.81 3.91 17.31L11.48 21.85C11.63 21.94 11.8 21.99 11.98 21.99 12.16 22 12.33 21.95 12.49 21.87 12.64 21.78 12.77 21.65 12.86 21.5 12.95 21.35 13 21.17 13 21V3C12.99 2.83 12.95 2.67 12.87 2.52 12.8 2.37 12.68 2.25 12.54 2.16 12.41 2.07 12.25 2.01 12.08 2 11.92 1.98 11.75 2.01 11.6 2.08Z" />
                      <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" d="M16.5 9.5l5 5m0-5l-5 5" />
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M11.6 2.08 11.48 2.14 3.91 6.68C3.02 7.21 2.28 7.97 1.77 8.87 1.26 9.77 1 10.79 1 11.83V12.16C1.07 13.52 1.37 14.46 1.87 15.29 2.38 16.12 3.08 16.81 3.91 17.31L11.48 21.85C11.63 21.94 11.8 21.99 11.98 21.99 12.16 22 12.33 21.95 12.49 21.87 12.64 21.78 12.77 21.65 12.86 21.5 12.95 21.35 13 21.17 13 21V3C12.99 2.83 12.95 2.67 12.87 2.52 12.8 2.37 12.68 2.25 12.54 2.16 12.41 2.07 12.25 2.01 12.08 2 11.92 1.98 11.75 2.01 11.6 2.08Z" />
                      <path d="M15.53 7.05C15.35 7.22 15.25 7.45 15.24 7.7 15.23 7.95 15.31 8.19 15.46 8.38L15.53 8.46 15.7 8.64C16.09 9.06 16.39 9.55 16.61 10.08 16.9 10.85 17 11.42 17 12 16.96 12.73 16.87 13.22 16.7 13.68 16.36 14.51 15.99 15.07 15.53 15.53 15.35 15.72 15.25 15.97 15.26 16.23 15.26 16.49 15.37 16.74 15.55 16.92 15.73 17.11 15.98 17.21 16.24 17.22 16.5 17.22 16.76 17.12 16.95 16.95 17.6 16.29 18.11 15.52 18.46 14.67L18.59 14.35C18.82 13.71 18.95 13.03 18.99 12.34L19 12C18.99 11.19 18.86 10.39 18.59 9.64L18.46 9.32C18.15 8.57 17.72 7.89 17.18 7.3L16.95 7.05 16.87 6.98C16.68 6.82 16.43 6.74 16.19 6.75 15.94 6.77 15.71 6.87 15.53 7.05Z" />
                      <path d="M18.36 4.22C18.18 4.39 18.08 4.62 18.07 4.87 18.05 5.12 18.13 5.36 18.29 5.56L18.36 5.63 18.66 5.95C19.36 6.72 19.91 7.6 20.31 8.55L20.47 8.96C20.82 9.94 21 10.96 21 11.99L20.98 12.44C20.94 13.32 20.77 14.19 20.47 15.03L20.31 15.44C19.86 16.53 19.19 17.52 18.36 18.36 18.17 18.55 18.07 18.8 18.07 19.07 18.07 19.33 18.17 19.59 18.36 19.77 18.55 19.96 18.8 20.07 19.07 20.07 19.33 20.07 19.59 19.96 19.77 19.77 20.79 18.75 21.61 17.54 22.16 16.2L22.35 15.7C22.72 14.68 22.93 13.62 22.98 12.54L23 12C22.99 10.73 22.78 9.48 22.35 8.29L22.16 7.79C21.67 6.62 20.99 5.54 20.15 4.61L19.77 4.22 19.7 4.15C19.51 3.99 19.26 3.91 19.02 3.93 18.77 3.94 18.53 4.04 18.36 4.22Z" />
                    </svg>
                  )}
                </Ctrl>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={muted ? 0 : volume}
                  onChange={(e) => changeVolume(Number(e.target.value))}
                  className="hidden md:block w-0 opacity-0 group-hover/vol:w-[72px] group-hover/vol:opacity-100 transition-all duration-200 h-1 cursor-pointer accent-white"
                  aria-label="Volume"
                />
              </div>

              <span className="shrink-0 whitespace-nowrap text-[12px] md:text-[13px] tabular-nums text-white">
                {fmt(displayTime)}<span className="px-1 text-white/90"> / </span>{fmt(duration)}
              </span>

              <div className="ml-auto flex flex-nowrap items-center gap-2 md:gap-4 shrink-0">
                {hasEpisodes && (
                  <Ctrl onClick={() => { setMenu(null); setShowEpisodes((s) => !s); }} label="Episodes" active={showEpisodes}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="4" width="14" height="12" rx="2" /><path d="M20 8v10a2 2 0 0 1-2 2H8" /></svg>
                  </Ctrl>
                )}

                {/* captions — dedicated button */}
                {subs.length > 0 && (
                  <Ctrl
                    onClick={() => { setShowEpisodes(false); setMenu(menu === 'captions' ? null : 'captions'); }}
                    label="Subtitles"
                    active={subIndex >= 0}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M21.2 3.01 21 3H3L2.79 3.01C2.3 3.06 1.84 3.29 1.51 3.65 1.18 4.02 .99 4.5 1 5V19L1.01 19.2C1.05 19.66 1.26 20.08 1.58 20.41 1.91 20.73 2.33 20.94 2.79 20.99L3 21H21L21.2 20.98C21.66 20.94 22.08 20.73 22.41 20.41 22.73 20.08 22.94 19.66 22.99 19.2L23 19V5C23 4.5 22.81 4.02 22.48 3.65 22.15 3.29 21.69 3.06 21.2 3.01ZM3 19V5H21V19H3ZM6.97 8.34C6.42 8.64 5.96 9.09 5.64 9.63L5.5 9.87C5.16 10.53 4.99 11.26 5 12L5 12.27C5.04 12.92 5.21 13.55 5.5 14.12L5.64 14.36C5.96 14.9 6.42 15.35 6.97 15.65L7.21 15.77C7.79 16.01 8.43 16.06 9.03 15.91L9.29 15.83C9.88 15.61 10.39 15.23 10.77 14.73 10.93 14.53 11 14.27 10.97 14.02 10.94 13.77 10.82 13.53 10.63 13.37 10.44 13.2 10.19 13.11 9.93 13.12 9.68 13.13 9.44 13.24 9.26 13.43L9.19 13.5C9.05 13.7 8.85 13.85 8.62 13.94L8.54 13.97C8.35 14.02 8.16 14 7.99 13.92L7.91 13.88C7.67 13.75 7.48 13.56 7.35 13.32L7.28 13.2C7.11 12.88 7.02 12.52 7 12.16L7 12C6.99 11.58 7.09 11.16 7.28 10.79L7.35 10.67C7.48 10.43 7.67 10.24 7.91 10.11 8.1 10 8.32 9.97 8.54 10.02L8.62 10.05C8.81 10.12 8.98 10.24 9.11 10.39L9.19 10.49 9.26 10.57C9.43 10.74 9.66 10.85 9.91 10.87 10.15 10.89 10.4 10.81 10.59 10.66 10.79 10.51 10.92 10.29 10.96 10.05 11.01 9.8 10.96 9.55 10.83 9.34L10.77 9.26 10.6 9.05C10.24 8.65 9.79 8.35 9.29 8.16L9.03 8.08C8.34 7.91 7.6 8 6.97 8.34ZM14.97 8.34C14.42 8.64 13.96 9.09 13.64 9.63L13.5 9.87C13.16 10.53 12.99 11.26 13 12L13 12.27C13.04 12.92 13.21 13.55 13.5 14.12L13.64 14.36C13.96 14.9 14.42 15.35 14.97 15.65L15.21 15.77C15.79 16.01 16.43 16.06 17.03 15.91L17.29 15.83C17.88 15.61 18.39 15.23 18.77 14.73 18.93 14.53 19 14.27 18.97 14.02 18.94 13.77 18.82 13.53 18.63 13.37 18.44 13.2 18.19 13.11 17.93 13.12 17.68 13.13 17.44 13.24 17.26 13.43L17.19 13.5C17.05 13.7 16.85 13.85 16.62 13.94L16.54 13.97C16.35 14.02 16.16 14 15.99 13.92L15.91 13.88C15.67 13.75 15.48 13.56 15.35 13.32L15.28 13.2C15.11 12.88 15.02 12.52 15 12.16L15 12C14.99 11.58 15.09 11.16 15.28 10.79L15.35 10.67C15.48 10.43 15.67 10.24 15.91 10.11 16.1 10 16.32 9.97 16.54 10.02L16.62 10.05C16.81 10.12 16.98 10.24 17.11 10.39L17.19 10.49 17.26 10.57C17.43 10.74 17.66 10.85 17.91 10.87 18.15 10.89 18.4 10.81 18.59 10.66 18.79 10.51 18.92 10.29 18.96 10.05 19.01 9.8 18.96 9.55 18.83 9.34L18.77 9.26 18.6 9.05C18.24 8.65 17.79 8.35 17.29 8.16L17.03 8.08C16.34 7.91 15.6 8 14.97 8.34Z" />
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
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.84 1H11.15C10.72 .99 10.3 1.14 9.95 1.4 9.6 1.66 9.35 2.02 9.23 2.44L9.19 2.61C9.11 3 8.96 3.38 8.73 3.71 8.51 4.04 8.22 4.33 7.89 4.55L7.75 4.64C7.37 4.85 6.96 4.98 6.53 5.02 6.11 5.06 5.68 5.01 5.27 4.87 4.86 4.73 4.42 4.73 4 4.86 3.59 5 3.23 5.26 2.99 5.62L2.89 5.77 2.05 7.23C1.82 7.63 1.73 8.1 1.81 8.55 1.88 9.01 2.12 9.43 2.47 9.73L2.58 9.84C3.15 10.39 3.5 11.15 3.5 12L3.49 12.16C3.47 12.56 3.37 12.95 3.19 13.31 3.01 13.67 2.77 13.99 2.47 14.26 2.12 14.56 1.88 14.98 1.81 15.43 1.73 15.89 1.82 16.36 2.05 16.76L2.89 18.22 2.99 18.37C3.24 18.73 3.59 18.99 4.01 19.13 4.42 19.26 4.86 19.26 5.27 19.12L5.42 19.07C5.81 18.96 6.21 18.93 6.61 18.98 7.01 19.03 7.4 19.15 7.75 19.36L7.89 19.44C8.22 19.66 8.51 19.95 8.73 20.28 8.96 20.61 9.11 20.99 9.19 21.38 9.28 21.84 9.52 22.24 9.88 22.54 10.24 22.83 10.69 23 11.15 23H12.84C13.3 23 13.75 22.83 14.11 22.54 14.47 22.24 14.71 21.84 14.8 21.38 14.89 20.96 15.06 20.56 15.31 20.21 15.55 19.86 15.88 19.57 16.25 19.36L16.39 19.28C16.75 19.1 17.14 18.99 17.54 18.96 17.94 18.94 18.34 18.99 18.72 19.12L18.89 19.17C19.31 19.27 19.75 19.24 20.15 19.07 20.55 18.9 20.88 18.6 21.1 18.23L21.95 16.76C22.18 16.36 22.26 15.89 22.19 15.43 22.11 14.98 21.88 14.56 21.53 14.26 21.23 13.99 20.98 13.67 20.8 13.31 20.63 12.95 20.52 12.56 20.5 12.16L20.5 12C20.5 11.57 20.59 11.14 20.77 10.75 20.94 10.36 21.2 10.01 21.53 9.73 21.88 9.43 22.11 9.01 22.19 8.55 22.26 8.1 22.18 7.63 21.95 7.23L21.1 5.76C20.88 5.39 20.55 5.09 20.15 4.92 19.76 4.75 19.31 4.72 18.89 4.82L18.72 4.87C18.34 5 17.94 5.05 17.54 5.03 17.14 5 16.75 4.89 16.4 4.71L16.25 4.63C15.88 4.42 15.56 4.13 15.31 3.78 15.06 3.43 14.89 3.03 14.8 2.61 14.71 2.15 14.47 1.74 14.11 1.45 13.75 1.16 13.3 .99 12.84 1ZM11.15 3H12.84C12.98 3.7 13.26 4.36 13.68 4.94 14.09 5.52 14.63 6.01 15.25 6.37 15.87 6.72 16.55 6.94 17.26 7.01 17.97 7.08 18.69 6.99 19.37 6.76L20.21 8.23C19.67 8.69 19.24 9.27 18.94 9.92 18.65 10.57 18.5 11.28 18.5 12 18.5 12.71 18.65 13.42 18.95 14.07 19.24 14.72 19.67 15.29 20.21 15.76L19.37 17.23C18.69 16.99 17.97 16.91 17.26 16.98 16.55 17.05 15.86 17.27 15.25 17.63 14.63 17.98 14.09 18.47 13.68 19.05 13.26 19.63 12.98 20.29 12.84 21H11.15C11.01 20.29 10.73 19.63 10.31 19.05 9.9 18.47 9.36 17.98 8.75 17.62 8.13 17.27 7.44 17.05 6.73 16.98 6.02 16.91 5.3 16.99 4.62 17.23L3.78 15.76C4.32 15.29 4.75 14.71 5.05 14.06 5.34 13.41 5.49 12.71 5.5 12 5.5 11.28 5.34 10.57 5.05 9.92 4.75 9.27 4.32 8.69 3.78 8.23L4.62 6.76C5.3 7 6.02 7.08 6.73 7.01 7.44 6.94 8.13 6.72 8.75 6.37 9.36 6.01 9.9 5.52 10.31 4.94 10.73 4.36 11.01 3.7 11.15 3ZM12 8C10.94 8 9.92 8.42 9.17 9.17 8.42 9.92 8 10.93 8 12 8 13.06 8.42 14.07 9.17 14.82 9.92 15.57 10.94 16 12 16 13.06 16 14.08 15.57 14.83 14.82 15.58 14.07 16 13.06 16 12 16 10.93 15.58 9.92 14.83 9.17 14.08 8.42 13.06 8 12 8ZM12 10H12L12.2 10.01C12.69 10.06 13.15 10.29 13.48 10.65 13.81 11.02 14 11.5 14 12L13.99 12.2C13.95 12.58 13.8 12.95 13.55 13.25 13.31 13.55 12.98 13.78 12.62 13.9 12.25 14.02 11.85 14.03 11.48 13.93 11.11 13.83 10.77 13.62 10.51 13.34 10.25 13.05 10.08 12.69 10.02 12.31 9.96 11.93 10.01 11.54 10.17 11.18 10.32 10.83 10.58 10.53 10.91 10.32 11.23 10.11 11.61 10 12 10Z" /></svg>
                </Ctrl>

                {/* fill-to-screen */}
                <Ctrl onClick={() => setFit((f) => (f === 'cover' ? 'contain' : 'cover'))} label="Fill to screen" active={fit === 'cover'}>
                  <svg width="24" height="24" viewBox="6 6 24 24" fill="currentColor" aria-hidden="true"><path d="M25,18h-2v3h-3v2h5V18z M13,15h3v-2h-5v5h2V15z M27,9H9c-1.1,0-2,0.9-2,2v14c0,1.1,0.9,2,2,2h18c1.1,0,2-0.9,2-2V11C29,9.9,28.1,9,27,9z M27,25H9V11h18V25z" /></svg>
                </Ctrl>

                {/* fullscreen */}
                <Ctrl onClick={toggleFullscreen} label="Fullscreen">
                  {fullscreen ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3.29 3.29 3.22 3.36C3.07 3.56 2.99 3.8 3 4.05 3.01 4.29 3.12 4.53 3.29 4.7L7.58 9H4C3.73 9 3.48 9.1 3.29 9.29 3.1 9.48 3 9.73 3 10 3 10.26 3.1 10.51 3.29 10.7 3.48 10.89 3.73 11 4 11H11V4C11 3.73 10.89 3.48 10.7 3.29 10.51 3.1 10.26 3 10 3 9.73 3 9.48 3.1 9.29 3.29 9.1 3.48 9 3.73 9 4V7.58L4.7 3.29C4.51 3.1 4.26 3 4 3 3.74 3 3.49 3.1 3.29 3.29ZM13 13V20C13 20.26 13.1 20.51 13.29 20.7 13.48 20.89 13.73 21 14 21 14.26 21 14.51 20.89 14.7 20.7 14.89 20.51 15 20.26 15 20V16.41L19.29 20.7C19.48 20.89 19.73 21 20 21 20.26 21 20.51 20.89 20.7 20.7 20.89 20.51 21 20.26 21 20 21 19.73 20.89 19.48 20.7 19.29L16.41 15H20C20.26 15 20.51 14.89 20.7 14.7 20.89 14.51 21 14.26 21 14 21 13.73 20.89 13.48 20.7 13.29 20.51 13.1 20.26 13 20 13H13Z" /></svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M10 3H3V10C3 10.26 3.1 10.51 3.29 10.7 3.48 10.89 3.73 11 4 11 4.26 11 4.51 10.89 4.7 10.7 4.89 10.51 5 10.26 5 10V6.41L9.29 10.7 9.36 10.77C9.56 10.92 9.8 11 10.04 10.99 10.29 10.98 10.52 10.87 10.7 10.7 10.87 10.52 10.98 10.29 10.99 10.04 11 9.8 10.92 9.56 10.77 9.36L10.7 9.29 6.41 5H10C10.26 5 10.51 4.89 10.7 4.7 10.89 4.51 11 4.26 11 4 11 3.73 10.89 3.48 10.7 3.29 10.51 3.1 10.26 3 10 3ZM20 13C19.73 13 19.48 13.1 19.29 13.29 19.1 13.48 19 13.73 19 14V17.58L14.7 13.29 14.63 13.22C14.43 13.07 14.19 12.99 13.95 13 13.7 13.01 13.47 13.12 13.29 13.29 13.12 13.47 13.01 13.7 13 13.95 12.99 14.19 13.07 14.43 13.22 14.63L13.29 14.7 17.58 19H14C13.73 19 13.48 19.1 13.29 19.29 13.1 19.48 13 19.73 13 20 13 20.26 13.1 20.51 13.29 20.7 13.48 20.89 13.73 21 14 21H21V14C21 13.73 20.89 13.48 20.7 13.29 20.51 13.1 20.26 13 20 13Z" /></svg>
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
                  <InfoRow label="Server" value={activeServer} />
                  <InfoRow label="Stream" value={streamFormat} />
                  {servers.length > 1 && <Row label="Switch server" value={server} onClick={() => setMenu('server')} />}
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
          <div className="text-sm font-semibold uppercase tracking-[0.14em] text-white">
            {errorType === 'no-sources' ? 'Coming Soon' : 'Servers are busy right now'}
          </div>
          <div className="text-xs text-white/50">
            {errorType === 'no-sources'
              ? 'This content is not yet available for streaming'
              : 'Try again later'}
          </div>
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
      className={cn(
        'relative flex items-center justify-center text-white opacity-90 hover:opacity-100 transition-opacity',
        className,
      )}
    >
      {children}
      {/* YouTube-style active indicator: red underline */}
      <span
        className={cn(
          'pointer-events-none absolute -bottom-0.5 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded-full bg-[#f00] transition-opacity',
          active ? 'opacity-100' : 'opacity-0',
        )}
      />
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex w-full items-center justify-between gap-6 px-3 py-2 text-sm">
      <span className="text-white/50">{label}</span>
      <span className="text-white/80 text-xs font-medium tabular-nums">{value}</span>
    </div>
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
