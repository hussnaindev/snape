'use client';

import { useEffect, useRef, useState } from 'react';

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
  const [sources, setSources] = useState<StreamSource[]>([]);
  const [subtitles, setSubtitles] = useState<StreamSubtitle[]>([]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch the source list once per title/episode.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setSources([]);
    setSourceIndex(0);

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
        setSubtitles(json.data.subtitles);
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

  // Attach the current source to the <video> (hls.js for HLS, native for mp4).
  // On fatal error, advance to the next source.
  useEffect(() => {
    const video = videoRef.current;
    const source = sources[sourceIndex];
    if (!video || !source) return;

    let destroyed = false;
    // hls.js instance, typed loosely to avoid a hard import-type dependency.
    let hls: { destroy: () => void } | null = null;

    const advance = () => {
      if (destroyed) return;
      setSourceIndex((i) => {
        if (i + 1 < sources.length) return i + 1;
        setStatus('error');
        setErrorMsg('All sources failed to play');
        return i;
      });
    };

    const onReadyOnce = () => {
      if (destroyed) return;
      setStatus('ready');
      onReady?.();
    };

    if (source.type === 'hls' && !video.canPlayType('application/vnd.apple.mpegurl')) {
      // Use hls.js (dynamic import keeps it out of the server bundle).
      import('hls.js')
        .then(({ default: Hls }) => {
          if (destroyed) return;
          if (!Hls.isSupported()) {
            // Fall back to setting src directly; may work in Safari.
            video.src = source.url;
            return;
          }
          const instance = new Hls({ enableWorker: true, lowLatencyMode: false });
          hls = instance;
          instance.loadSource(source.url);
          instance.attachMedia(video);
          instance.on(Hls.Events.MANIFEST_PARSED, onReadyOnce);
          instance.on(Hls.Events.ERROR, (_evt, data) => {
            if (data.fatal) advance();
          });
        })
        .catch(advance);
    } else {
      // Native playback (mp4, or HLS in Safari).
      video.src = source.url;
      video.addEventListener('loadeddata', onReadyOnce, { once: true });
      video.addEventListener('error', advance, { once: true });
    }

    return () => {
      destroyed = true;
      if (hls) hls.destroy();
      video.removeEventListener('loadeddata', onReadyOnce);
      video.removeEventListener('error', advance);
    };
  }, [sources, sourceIndex, onReady]);

  return (
    <div className={cn('relative bg-black', className)}>
      {/* biome-ignore lint/a11y/useMediaCaption: subtitles added dynamically as tracks */}
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full bg-black"
        controls
        autoPlay={autoPlay}
        playsInline
        // Same-origin (media-proxy) so CORS is satisfied; needed for <track>.
        crossOrigin="anonymous"
      >
        {subtitles.map((s, i) => (
          <track
            key={s.url}
            kind="subtitles"
            src={s.url}
            label={s.label ?? s.lang ?? `Track ${i + 1}`}
            srcLang={s.lang ?? 'en'}
            default={i === 0}
          />
        ))}
      </video>

      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-sm font-semibold uppercase tracking-[0.14em] text-white/80">
            Loading…
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black px-4 text-center">
          <div className="text-sm font-semibold uppercase tracking-[0.14em] text-white">
            Unable to play
          </div>
          <div className="text-xs text-white/50">{errorMsg}</div>
        </div>
      )}
    </div>
  );
}
