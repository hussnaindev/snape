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
  onReady?: () => void;
}

const DEFAULT_LABEL = 'Default';
const qLabel = (s: StreamSource) => (s.type === 'hls' ? 'Auto' : s.quality ? `${s.quality}p` : 'Auto');
const dubLabel = (s: StreamSource) => s.dub ?? DEFAULT_LABEL;

export function PeachifyPlayer({
  type,
  tmdbId,
  season,
  episode,
  className,
  autoPlay = true,
  onReady,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);
  const failedRef = useRef<Set<string>>(new Set());
  const startedRef = useRef(false);
  const resumeRef = useRef<{ time: number; playing: boolean } | null>(null);
  const retryRef = useRef(0);

  const [sources, setSources] = useState<StreamSource[]>([]);
  const [subs, setSubs] = useState<StreamSubtitle[]>([]);
  const [lang, setLang] = useState('');
  const [quality, setQuality] = useState('');
  const [active, setActive] = useState<StreamSource | null>(null);
  const [subIndex, setSubIndex] = useState(-1);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [buffering, setBuffering] = useState(false);
  const [menu, setMenu] = useState<null | 'main' | 'audio' | 'quality' | 'subs'>(null);

  // ---- derived menus ----
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
    // Original-language audio first.
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
        if (Number.isNaN(na)) return 1; // 'Auto' last
        if (Number.isNaN(nb)) return -1;
        return nb - na; // highest first
      });
    },
    [sources],
  );
  const qualities = useMemo(() => qualitiesFor(lang), [qualitiesFor, lang]);

  const pickSource = useCallback(
    (l: string, q: string): StreamSource | null => {
      const inLang = sources.filter((s) => dubLabel(s) === l);
      return inLang.find((s) => qLabel(s) === q) ?? inLang[0] ?? sources[0] ?? null;
    },
    [sources],
  );

  // ---- fetch sources ----
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

  // ---- defaults once sources arrive ----
  useEffect(() => {
    if (sources.length === 0) return;
    const defLang = languages.find((l) => /(original|orig)/i.test(l)) ?? languages[0] ?? '';
    const defQ = qualitiesFor(defLang)[0] ?? '';
    setLang(defLang);
    setQuality(defQ);
    const en = subs.findIndex((s) => /^en|english/i.test(s.lang ?? '') || /english/i.test(s.label ?? ''));
    setSubIndex(en); // -1 = off when no English
    // biome-ignore lint/correctness/useExhaustiveDependencies: run once per source set
  }, [sources]);

  // ---- selection drives the active source ----
  useEffect(() => {
    if (sources.length === 0 || !lang) return;
    const s = pickSource(lang, quality);
    if (s && s.url !== active?.url) {
      // user-initiated switch: keep position
      const v = videoRef.current;
      if (v && startedRef.current) resumeRef.current = { time: v.currentTime, playing: !v.paused };
      setActive(s);
    }
  }, [sources, lang, quality, pickSource, active?.url]);

  // ---- attach active source to <video> ----
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
        setActive(next);
      } else {
        setStatus('error');
        setErrorMsg('All sources failed to play');
      }
    };

    const onError = () => {
      if (destroyed) return;
      if (!startedRef.current) {
        fallback();
        return;
      }
      // Mid-playback blip: try one in-place reload at the same spot before
      // giving up — do NOT jump to another source (that restarts from 0).
      if (retryRef.current < 1) {
        retryRef.current += 1;
        resumeRef.current = { time: video.currentTime, playing: !video.paused };
        video.load();
      } else {
        fallback();
      }
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
    // biome-ignore lint/correctness/useExhaustiveDependencies: attach only when the URL changes
  }, [active?.url]);

  // ---- buffering spinner ----
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const on = () => setBuffering(true);
    const off = () => setBuffering(false);
    v.addEventListener('waiting', on);
    v.addEventListener('playing', off);
    v.addEventListener('canplay', off);
    return () => {
      v.removeEventListener('waiting', on);
      v.removeEventListener('playing', off);
      v.removeEventListener('canplay', off);
    };
  }, []);

  // ---- subtitle track selection ----
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const tracks = v.textTracks;
    for (let i = 0; i < tracks.length; i++) {
      tracks[i]!.mode = i === subIndex ? 'showing' : 'disabled';
    }
  }, [subIndex, subs, active?.url, status]);

  const closeMenu = () => setMenu(null);

  return (
    <div className={cn('relative bg-black', className)}>
      {/* biome-ignore lint/a11y/useMediaCaption: subtitle tracks added dynamically */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full bg-black"
        controls
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

      {/* Settings (gear) — quality / audio / subtitles */}
      {status === 'ready' && (
        <div className="absolute top-3 right-3 z-30">
          <button
            type="button"
            onClick={() => setMenu((m) => (m ? null : 'main'))}
            aria-label="Settings"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white/90 hover:text-white border border-white/20"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>

          {menu && (
            <div className="absolute top-11 right-0 min-w-44 max-h-[60vh] overflow-y-auto rounded-lg bg-black/90 border border-white/15 py-1 text-sm text-white shadow-xl">
              {menu === 'main' && (
                <>
                  <MenuRow label="Audio" value={lang} onClick={() => setMenu('audio')} />
                  <MenuRow label="Quality" value={quality} onClick={() => setMenu('quality')} />
                  <MenuRow
                    label="Subtitles"
                    value={subIndex >= 0 ? (subs[subIndex]?.label ?? subs[subIndex]?.lang ?? 'On') : 'Off'}
                    onClick={() => setMenu('subs')}
                  />
                </>
              )}
              {menu === 'audio' &&
                languages.map((l) => (
                  <MenuOption
                    key={l}
                    label={l}
                    active={l === lang}
                    onClick={() => {
                      setLang(l);
                      const qs = qualitiesFor(l);
                      if (!qs.includes(quality)) setQuality(qs[0] ?? '');
                      closeMenu();
                    }}
                  />
                ))}
              {menu === 'quality' &&
                qualities.map((q) => (
                  <MenuOption
                    key={q}
                    label={q}
                    active={q === quality}
                    onClick={() => {
                      setQuality(q);
                      closeMenu();
                    }}
                  />
                ))}
              {menu === 'subs' && (
                <>
                  <MenuOption label="Off" active={subIndex === -1} onClick={() => { setSubIndex(-1); closeMenu(); }} />
                  {subs.map((s, i) => (
                    <MenuOption
                      key={s.url}
                      label={s.label ?? s.lang ?? `Subtitle ${i + 1}`}
                      active={i === subIndex}
                      onClick={() => { setSubIndex(i); closeMenu(); }}
                    />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {(status === 'loading' || buffering) && status !== 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black px-4 text-center">
          <div className="text-sm font-semibold uppercase tracking-[0.14em] text-white">Unable to play</div>
          <div className="text-xs text-white/50">{errorMsg}</div>
        </div>
      )}
    </div>
  );
}

function MenuRow({ label, value, onClick }: { label: string; value: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-4 px-3 py-2 hover:bg-white/10"
    >
      <span>{label}</span>
      <span className="text-white/50 text-xs">{value} ›</span>
    </button>
  );
}

function MenuOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('flex w-full items-center gap-2 px-3 py-2 hover:bg-white/10', active && 'text-white')}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', active ? 'bg-white' : 'bg-transparent')} />
      <span className={cn(active ? '' : 'text-white/70')}>{label}</span>
    </button>
  );
}
