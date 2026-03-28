'use client';

import { buildMagnet } from '@/lib/torrentio';
import { getWebTorrentClient } from '@/lib/webtorrent-client';
import type { ParsedStream } from '@/types/torrentio';
import { useEffect, useRef, useState } from 'react';

interface PlayerModalProps {
  stream: ParsedStream;
  onClose: () => void;
}

type Status = 'connecting' | 'buffering' | 'playing' | 'error';

export function PlayerModal({ stream, onClose }: PlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>('connecting');
  const [progress, setProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    async function start() {
      try {
        const client = await getWebTorrentClient();
        const magnet = buildMagnet(stream.infoHash, stream.title);

        const torrent = await new Promise<import('webtorrent').Torrent>((resolve, reject) => {
          const t = client.add(magnet, { fileIndex: stream.fileIdx }, (t) => resolve(t));
          t.on('error', (err: unknown) =>
            reject(err instanceof Error ? err : new Error(String(err))),
          );
        });

        if (cancelled) {
          torrent.destroy();
          return;
        }

        // Find largest file (best video candidate) or file at specified index
        const file =
          torrent.files[stream.fileIdx] ??
          [...torrent.files].sort((a, b) => b.length - a.length)[0];

        if (!file) {
          setStatus('error');
          setErrorMsg('No playable file found in torrent.');
          return;
        }

        setStatus('buffering');

        if (videoRef.current) {
          file.renderTo(videoRef.current, { autoplay: true }, (err: Error | null) => {
            if (err) {
              setStatus('error');
              setErrorMsg(err.message);
            }
          });

          videoRef.current.addEventListener('playing', () => setStatus('playing'));
        }

        intervalId = setInterval(() => {
          setProgress(Math.round(torrent.progress * 100));
        }, 1000);
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setErrorMsg(err instanceof Error ? err.message : 'Failed to load torrent.');
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      if (intervalId) clearInterval(intervalId);
    };
  }, [stream]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 animate-fade-in">
      <div className="relative w-full max-w-5xl mx-4 animate-scale-in">
        <button
          type="button"
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/70 hover:text-white text-2xl z-10"
        >
          ✕
        </button>

        <div className="relative aspect-video rounded overflow-hidden bg-black">
          <video
            ref={videoRef}
            controls
            className="w-full h-full"
            style={{ display: status === 'playing' || status === 'buffering' ? 'block' : 'none' }}
          />

          {(status === 'connecting' || status === 'buffering') && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
              <div className="w-10 h-10 rounded-full border-2 border-white/70 border-t-transparent animate-spin" />
              <p className="text-white/70 text-sm">
                {status === 'connecting' ? 'Connecting to peers…' : `Buffering… ${progress}%`}
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black">
              <p className="text-like text-sm text-center max-w-xs">
                {errorMsg || 'Playback error.'}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="text-white/60 text-xs underline hover:text-white"
              >
                Close
              </button>
            </div>
          )}
        </div>

        {status === 'playing' && progress < 100 && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-white/40 text-xs">{progress}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
