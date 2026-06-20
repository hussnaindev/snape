'use client';

import { DownloadIcon } from '@/components/ui/download-icon';
import { VideoPlayer } from '@/components/video-player';
import {
  type DownloadRecord,
  formatBytes,
  isDownloadActive,
  pauseDownload,
  removeDownload,
  resumeDownload,
  retryDownload,
  subscribeDownloads,
} from '@/lib/downloads';
import { tmdbImage } from '@/lib/tmdb-image';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export default function DownloadsPage() {
  const [records, setRecords] = useState<DownloadRecord[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [playing, setPlaying] = useState<DownloadRecord | null>(null);

  useEffect(() => {
    const unsub = subscribeDownloads((all) => {
      setRecords(all);
      setHydrated(true);
    });
    return unsub;
  }, []);

  const active = records.filter((r) => isDownloadActive(r.status));
  const history = records.filter((r) => !isDownloadActive(r.status));

  return (
    <div className="min-h-screen pt-16">
      <div className="px-4 md:px-8 py-6 md:py-8 pb-24 max-w-4xl mx-auto">
        <h1 className="text-white text-2xl font-bold mb-1">Downloads</h1>
        <p className="text-white/40 text-sm mb-6">Saved on this device for offline playback.</p>

        {hydrated && records.length === 0 && <Empty />}

        {active.length > 0 && (
          <Section title={`Downloading (${active.length})`}>
            {active.map((r) => (
              <DownloadRow key={r.id} record={r} onPlay={setPlaying} />
            ))}
          </Section>
        )}

        {history.length > 0 && (
          <Section title="Downloaded">
            {history.map((r) => (
              <DownloadRow key={r.id} record={r} onPlay={setPlaying} />
            ))}
          </Section>
        )}
      </div>

      {playing && <PlayerOverlay record={playing} onClose={() => setPlaying(null)} />}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <p className="text-white/40 text-[11px] font-semibold tracking-wider uppercase mb-3">
        {title}
      </p>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function DownloadRow({
  record,
  onPlay,
}: {
  record: DownloadRecord;
  onPlay: (r: DownloadRecord) => void;
}) {
  const poster = tmdbImage(record.posterPath, 'w185');
  const href = record.type === 'movie' ? `/movie/${record.tmdbId}` : `/series/${record.tmdbId}`;
  const epLabel =
    record.type === 'series' && record.season !== undefined && record.episode !== undefined
      ? `S${record.season} E${record.episode}`
      : null;
  const completed = record.status === 'completed';
  const active = isDownloadActive(record.status);
  const paused = record.status === 'paused';
  const downloadingNow = record.status === 'downloading' || record.status === 'queued';
  const failed = record.status === 'failed' || record.status === 'canceled';
  const removing = record.status === 'removing';

  return (
    <div className="flex gap-3 rounded-xl bg-white/5 border border-white/10 p-2.5">
      {/* Poster */}
      <div className="relative flex-none w-16 h-24 rounded-lg overflow-hidden bg-white/5">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt={record.title} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-white/20 text-[10px]">
            No Art
          </div>
        )}
      </div>

      {/* Info — title/badges/progress */}
      <div className="flex-1 min-w-0 flex flex-col justify-center py-0.5 gap-1">
        <div className="min-w-0">
          <Link
            href={href}
            className="text-white text-sm font-semibold truncate block hover:underline"
          >
            {record.title}
          </Link>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {epLabel && <Badge>{epLabel}</Badge>}
            <Badge>{record.quality}</Badge>
            {record.lang && record.lang !== 'Default' && <Badge>{record.lang}</Badge>}
            {record.subtitleLang && <Badge>CC {record.subtitleLang}</Badge>}
          </div>
        </div>

        {active && (
          <div>
            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div
                className={cn(
                  'h-full transition-[width] duration-75',
                  paused
                    ? 'bg-white/40'
                    : 'bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-300',
                )}
                style={{ width: `${record.progress}%` }}
              />
            </div>
            <p className="text-white/40 text-[11px] mt-1">
              {record.status === 'queued'
                ? 'Queued…'
                : paused
                  ? record.totalBytes > 0
                    ? `Paused · ${Math.floor(record.progress)}% of ${formatBytes(record.totalBytes)}`
                    : `Paused · ${formatBytes(record.receivedBytes)}`
                  : record.totalBytes > 0
                    ? `${Math.floor(record.progress)}% · ${formatBytes(record.receivedBytes)} / ${formatBytes(record.totalBytes)}`
                    : `${formatBytes(record.receivedBytes)} downloaded`}
            </p>
          </div>
        )}

        {failed && (
          <p className="text-red-400/80 text-[11px]">
            {record.status === 'canceled'
              ? 'Canceled'
              : `Failed${record.error ? ` · ${record.error}` : ''}`}
          </p>
        )}

        {completed && (
          <span className="text-white/40 text-[11px]">{formatBytes(record.totalBytes)}</span>
        )}
      </div>

      {/* Right-side fixed-size action buttons */}
      <div className="flex-none flex flex-col items-center justify-center gap-2">
        {!removing && (
          <>
            {downloadingNow && (
              <ActionButton onClick={() => void pauseDownload(record.id)} aria-label="Pause">
                <PauseIcon />
              </ActionButton>
            )}
            {paused && (
              <ActionButton onClick={() => void resumeDownload(record.id)} aria-label="Resume">
                <PlayIcon />
              </ActionButton>
            )}
            {completed && (
              <ActionButton onClick={() => onPlay(record)}>
                <PlayIcon /> <span>Play</span>
              </ActionButton>
            )}
            {failed && (
              <ActionButton onClick={() => void retryDownload(record.id)} aria-label="Retry">
                <RetryIcon />
              </ActionButton>
            )}
          </>
        )}

        {removing ? (
          <ActionButton loading>Deleting&hellip;</ActionButton>
        ) : (
          <ActionButton onClick={() => void removeDownload(record.id)} aria-label="Delete">
            <TrashIcon />
          </ActionButton>
        )}
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  loading,
  children,
  ...props
}: {
  onClick?: () => void;
  loading?: boolean;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      {...props}
      className="w-20 h-9 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center gap-1.5 text-white/50 text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-wait cursor-pointer hover:text-white hover:bg-white/10"
    >
      {loading ? (
        <>
          <SpinnerIcon />
          <span className="text-white/70">{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      className="animate-spin"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/60">
      {children}
    </span>
  );
}

function PlayerOverlay({ record, onClose }: { record: DownloadRecord; onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Auto-enter fullscreen on mobile to hide status bar.
    const el = rootRef.current;
    if (el && !document.fullscreenElement) {
      el.requestFullscreen()
        .then(() => {
          (screen.orientation as unknown as { lock?: (o: string) => Promise<void> })
            ?.lock?.('landscape')
            ?.catch(() => {});
        })
        .catch(() => {});
    }

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
        (screen.orientation as unknown as { unlock?: () => void })?.unlock?.();
      }
    };
  }, [onClose]);

  return (
    <div ref={rootRef} className="fixed inset-0 z-[90] bg-black">
      <button
        type="button"
        onClick={onClose}
        aria-label="Close player"
        className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/20 transition-colors cursor-pointer"
        style={{ top: 'max(1rem, env(safe-area-inset-top))' }}
      >
        <CloseIcon />
      </button>
      {/* Our player, restricted to the on-device copy (no streaming fetch). */}
      <VideoPlayer
        type={record.type === 'series' ? 'tv' : 'movie'}
        tmdbId={record.tmdbId}
        {...(record.season !== undefined ? { season: record.season } : {})}
        {...(record.episode !== undefined ? { episode: record.episode } : {})}
        title={record.title}
        offlineOnly
        fullscreenRootRef={rootRef}
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <DownloadIcon size={48} className="text-white/20" />
      <p className="text-white/50 text-center max-w-xs text-sm">
        No downloads yet. Tap Download on any movie or show to save it here for offline viewing.
      </p>
      <Link
        href="/"
        className="px-6 py-2.5 bg-white/10 text-white text-sm font-medium rounded-lg hover:bg-white/15 transition-colors"
      >
        Browse content
      </Link>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}
