'use client';

import type { SubtitleTrack } from '@/lib/stream-extractor';
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

export type QualityLevel = {
  index: number;
  height: number;
  bitrate: number;
};

export type HlsPlayerHandle = {
  setQuality: (index: number) => void;
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  getVideoElement: () => HTMLVideoElement | null;
};

interface HlsPlayerProps {
  streamUrl: string;
  subtitles?: SubtitleTrack[];
  autoPlay?: boolean;
  className?: string;
  onError?: () => void;
  onQualityLevels?: (levels: QualityLevel[]) => void;
}

export const HlsPlayer = forwardRef<HlsPlayerHandle, HlsPlayerProps>(function HlsPlayer(
  { streamUrl, subtitles, autoPlay, className, onError, onQualityLevels },
  ref,
) {
  const videoRef = useRef<HTMLVideoElement>(null);
  // Store hls instance in a ref so setQuality can access it
  const hlsRef = useRef<import('hls.js').default | null>(null);

  useImperativeHandle(ref, () => ({
    setQuality(index: number) {
      if (hlsRef.current) hlsRef.current.currentLevel = index;
    },
    play() {
      videoRef.current?.play().catch(() => {});
    },
    pause() {
      videoRef.current?.pause();
    },
    seek(seconds: number) {
      if (videoRef.current) videoRef.current.currentTime = seconds;
    },
    setVolume(volume: number) {
      if (videoRef.current) videoRef.current.volume = volume;
    },
    getVideoElement() {
      return videoRef.current;
    },
  }));

  // Attach hls.js after mount; destroy on unmount or streamUrl change.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let hls: import('hls.js').default | null = null;
    let cancelled = false;

    import('hls.js').then(({ default: Hls }) => {
      if (cancelled || !videoRef.current) return;

      if (Hls.isSupported()) {
        hls = new Hls({
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          enableWorker: true,
        });
        hlsRef.current = hls;

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          const levels: QualityLevel[] = data.levels.map((l, i) => ({
            index: i,
            height: l.height,
            bitrate: l.bitrate,
          }));
          onQualityLevels?.(levels);
          if (autoPlay) videoRef.current?.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            console.error('[hls-player] fatal error', data.type, data.details);
            onError?.();
          }
        });

        hls.loadSource(streamUrl);
        hls.attachMedia(videoRef.current);
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS (Safari)
        video.src = streamUrl;
        if (autoPlay) video.play().catch(() => {});
        onQualityLevels?.([]);
      } else {
        onError?.();
      }
    });

    return () => {
      cancelled = true;
      hls?.destroy();
      hlsRef.current = null;
    };
  }, [streamUrl, autoPlay, onError, onQualityLevels]);

  // Inject external subtitle tracks after mount
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !subtitles?.length) return;
    for (const track of subtitles) {
      const el = document.createElement('track');
      el.kind = track.kind;
      el.src = track.src;
      el.srclang = track.lang;
      el.label = track.label;
      video.appendChild(el);
    }
    return () => {
      const tracks = video.querySelectorAll('track');
      for (const t of tracks) t.remove();
    };
  }, [subtitles]);

  // biome-ignore lint/a11y/useMediaCaption: tracks are injected dynamically via useEffect
  return <video ref={videoRef} className={className} playsInline preload="metadata" />;
});
