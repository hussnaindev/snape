'use client';

import { DownloadIcon } from '@/components/ui/download-icon';
import {
  type DownloadRecord,
  buildDownloadId,
  formatBytes,
  isDownloadActive,
  startDownload,
  subscribeDownloads,
} from '@/lib/downloads';
import { showToast } from '@/lib/toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

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
  type: 'movie' | 'series';
  tmdbId: number;
  title: string;
  posterPath: string | null;
  /** Series only — the episode the detail page is focused on. */
  season?: number;
  episode?: number;
  className?: string;
  iconOnly?: boolean;
}

const DEFAULT_AUDIO = 'Default';

const dubLabel = (s: StreamSource) => s.dub ?? DEFAULT_AUDIO;
const qLabel = (s: StreamSource) => (s.quality ? `${s.quality}p` : 'Auto');

export function DownloadButton({
  type,
  tmdbId,
  title,
  posterPath,
  season,
  episode,
  className,
  iconOnly = false,
}: Props) {
  const [open, setOpen] = useState(false);
  // Reflect this title's download state on the button (like the watchlist check).
  const [record, setRecord] = useState<DownloadRecord | null>(null);

  useEffect(() => {
    return subscribeDownloads((all) => {
      const match = all.find(
        (r) =>
          r.type === type &&
          r.tmdbId === tmdbId &&
          (type === 'movie' || (r.season === season && r.episode === episode)),
      );
      setRecord(match ?? null);
    });
  }, [type, tmdbId, season, episode]);

  const router = useRouter();
  const downloaded = record?.status === 'completed';
  const active = record ? isDownloadActive(record.status) : false;
  const paused = record?.status === 'paused';
  const pct = record ? record.progress : 0;
  const hasExistingDownload = record && (downloaded || active);

  const handleClick = () => {
    if (hasExistingDownload) {
      router.push('/downloads');
    } else {
      setOpen(true);
    }
  };

  // Show the live percentage; if the source didn't expose a total size, fall
  // back to bytes downloaded so the user still sees real progress.
  const buttonLabel = downloaded
    ? 'Downloaded'
    : paused
      ? 'Paused'
      : active
        ? record && record.progress > 0
          ? `${record.progress}%`
          : record && record.receivedBytes > 0
            ? formatBytes(record.receivedBytes)
            : 'Starting…'
        : 'Download';

  if (iconOnly) {
    // Mobile: download icon centered, progress shown as a circular ring.
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          aria-label={downloaded ? 'Downloaded' : active ? `Downloading ${pct}%` : 'Download'}
          className={cn(
            'relative flex items-center justify-center w-9 h-9 rounded-full border transition-all cursor-pointer',
            downloaded
              ? 'bg-emerald-500 text-white border-emerald-500'
              : 'bg-black/60 text-white border-white/30 hover:border-white/70',
            className,
          )}
        >
          {active && <ProgressRing pct={pct} paused={paused} />}
          {downloaded ? <CheckIcon /> : <DownloadIcon size={16} />}
        </button>
        {open && (
          <DownloadModal
            type={type}
            tmdbId={tmdbId}
            title={title}
            posterPath={posterPath}
            {...(season !== undefined ? { season } : {})}
            {...(episode !== undefined ? { episode } : {})}
            onClose={() => setOpen(false)}
          />
        )}
      </>
    );
  }

  // Desktop: button background fills green with the download %, icon + label on top.
  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'relative top-0 inline-flex items-center justify-center gap-2 overflow-hidden text-nowrap rounded-full border py-0.5 text-xs font-semibold uppercase leading-tight tracking-widest transition-all duration-300 ease-out cursor-pointer active:top-0.5 h-10 px-3 md:h-12 md:px-5 min-w-36',
          downloaded
            ? 'border-emerald-500/40 bg-emerald-500/20 text-white lg:hover:bg-emerald-500/30'
            : active
              ? 'border-white/20 bg-white/10 text-white'
              : 'border-white/20 bg-white/2 text-white lg:hover:border-transparent lg:hover:bg-white/20 lg:hover:text-white active:border-transparent active:bg-white/20',
          className,
        )}
      >
        {active && (
          <span
            aria-hidden="true"
            className={cn(
              'absolute inset-y-0 left-0 transition-[width] duration-300 ease-out',
              paused
                ? 'bg-white/25'
                : 'bg-gradient-to-r from-emerald-600 via-emerald-500 to-green-400',
            )}
            style={{ width: `${Math.max(pct, 3)}%` }}
          />
        )}
        <span className="relative z-10 inline-flex items-center gap-2">
          {downloaded ? <CheckIcon /> : <DownloadIcon size={15} />}
          <span className="px-2">{buttonLabel}</span>
        </span>
      </button>
      {open && (
        <DownloadModal
          type={type}
          tmdbId={tmdbId}
          title={title}
          posterPath={posterPath}
          {...(season !== undefined ? { season } : {})}
          {...(episode !== undefined ? { episode } : {})}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// Circular progress ring that fills the icon-only (mobile) button.
function ProgressRing({ pct, paused }: { pct: number; paused: boolean }) {
  const R = 16;
  const C = 2 * Math.PI * R;
  return (
    <svg
      className="absolute inset-0 h-full w-full -rotate-90"
      viewBox="0 0 36 36"
      aria-hidden="true"
    >
      <circle cx="18" cy="18" r={R} fill="none" strokeWidth="2.5" className="stroke-white/15" />
      <circle
        cx="18"
        cy="18"
        r={R}
        fill="none"
        strokeWidth="2.5"
        strokeLinecap="round"
        className={paused ? 'stroke-white/50' : 'stroke-emerald-400'}
        strokeDasharray={C}
        strokeDashoffset={C * (1 - Math.max(pct, 2) / 100)}
        style={{ transition: 'stroke-dashoffset 0.3s ease' }}
      />
    </svg>
  );
}

function DownloadModal({
  type,
  tmdbId,
  title,
  posterPath,
  season,
  episode,
  onClose,
}: {
  type: 'movie' | 'series';
  tmdbId: number;
  title: string;
  posterPath: string | null;
  season?: number;
  episode?: number;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'unavailable'>('loading');
  const [sources, setSources] = useState<StreamSource[]>([]);
  const [subtitles, setSubtitles] = useState<StreamSubtitle[]>([]);
  const [lang, setLang] = useState('');
  const [quality, setQuality] = useState('');
  const [subIndex, setSubIndex] = useState(-1); // -1 = none
  // Portal to <body> so the modal escapes the detail hero's parallax/transform
  // containers (which create a stacking context that would otherwise trap z-index
  // below fixed overlays like the PWA install banner).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Lock body scroll while the modal is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let aborted = false;
    const streamType = type === 'series' ? 'tv' : 'movie';
    const qs = type === 'series' ? `?season=${season}&episode=${episode}` : '';
    fetch(`/api/stream/${streamType}/${tmdbId}${qs}`, { cache: 'no-store' })
      .then((r) => r.json() as Promise<StreamResponse>)
      .then((json) => {
        if (aborted) return;
        // Only progressive MP4 sources can be saved as a single offline file.
        const mp4 = (json.data?.sources ?? []).filter((s) => s.type === 'mp4');
        if (!json.ok || mp4.length === 0) {
          setStatus('unavailable');
          return;
        }
        setSources(mp4);
        setSubtitles(json.data?.subtitles ?? []);
        setStatus('ready');
      })
      .catch(() => {
        if (!aborted) setStatus('error');
      });
    return () => {
      aborted = true;
    };
  }, [type, tmdbId, season, episode]);

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
    out.sort(
      (a, b) => (/(original|orig)/i.test(a) ? -1 : 0) - (/(original|orig)/i.test(b) ? -1 : 0),
    );
    return out;
  }, [sources]);

  const qualities = useMemo(() => {
    const labels = new Set<string>();
    for (const s of sources) if (dubLabel(s) === lang) labels.add(qLabel(s));
    return [...labels].sort((a, b) => {
      const na = Number.parseInt(a, 10);
      const nb = Number.parseInt(b, 10);
      if (Number.isNaN(na)) return 1;
      if (Number.isNaN(nb)) return -1;
      return nb - na;
    });
  }, [sources, lang]);

  // Seed defaults once sources arrive: original audio + best available quality.
  useEffect(() => {
    const first = sources[0];
    if (!first) return;
    const preferLang = languages[0] ?? dubLabel(first);
    setLang(preferLang);
    const en = subtitles.findIndex(
      (s) => /^en|english/i.test(s.lang ?? '') || /english/i.test(s.label ?? ''),
    );
    setSubIndex(en);
  }, [sources, languages, subtitles]);

  useEffect(() => {
    if (!lang) return;
    // Prefer a balanced default (720p → 480p → 360p) over the largest file, so
    // an offline save isn't needlessly huge; fall back to whatever exists.
    const preferred = ['720p', '480p', '360p'].find((q) => qualities.includes(q));
    setQuality((q) => (qualities.includes(q) ? q : (preferred ?? qualities[0] ?? '')));
  }, [lang, qualities]);

  function handleDownload() {
    const source = sources.find((s) => dubLabel(s) === lang && qLabel(s) === quality);
    if (!source) return;
    const sub = subIndex >= 0 ? subtitles[subIndex] : null;
    void startDownload({
      type,
      tmdbId,
      ...(season !== undefined ? { season } : {}),
      ...(episode !== undefined ? { episode } : {}),
      title,
      posterPath,
      quality,
      lang,
      subtitleLang: sub ? (sub.label ?? sub.lang ?? 'Subtitle') : null,
      mime: 'video/mp4',
      videoUrl: source.url,
      subtitleUrl: sub?.url ?? null,
    });
    showToast(`Download started · ${heading} (${quality})`, 'download');
    onClose();
  }

  const heading =
    type === 'series' && season !== undefined && episode !== undefined
      ? `${title} · S${season} E${episode}`
      : title;

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end md:items-center justify-center">
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: Escape handled globally */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative w-full md:max-w-md bg-[#0f0f10] border border-white/10 rounded-t-2xl md:rounded-2xl shadow-2xl animate-fade-in"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/10">
          <div className="min-w-0">
            <p className="text-white font-semibold text-base truncate">Download</p>
            <p className="text-white/40 text-xs truncate">{heading}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-3 flex-none w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="px-5 py-5 space-y-5 max-h-[60vh] md:max-h-[70vh] overflow-y-auto">
          {status === 'loading' && (
            <div className="flex items-center justify-center py-10 text-white/50 text-sm gap-3">
              <SpinnerIcon /> Preparing options…
            </div>
          )}

          {status === 'error' && (
            <p className="py-8 text-center text-white/50 text-sm">
              Couldn&apos;t load download options. Please try again.
            </p>
          )}

          {status === 'unavailable' && (
            <p className="py-8 text-center text-white/50 text-sm">
              This title isn&apos;t available for download right now.
            </p>
          )}

          {status === 'ready' && (
            <>
              <Field label="Quality">
                <ChipGroup options={qualities} value={quality} onChange={setQuality} />
              </Field>

              {languages.length > 1 && (
                <Field label="Language / Audio">
                  <ChipGroup options={languages} value={lang} onChange={setLang} />
                </Field>
              )}

              <Field label="Subtitles">
                <div className="flex flex-wrap gap-2">
                  <Chip selected={subIndex === -1} onClick={() => setSubIndex(-1)}>
                    None
                  </Chip>
                  {subtitles.map((s, i) => (
                    <Chip
                      key={`${s.url}-${i}`}
                      selected={subIndex === i}
                      onClick={() => setSubIndex(i)}
                    >
                      {s.label ?? s.lang ?? `Subtitle ${i + 1}`}
                    </Chip>
                  ))}
                </div>
              </Field>

              <p className="text-white/30 text-[11px] leading-relaxed">
                Saved to this device for offline playback. Find it under{' '}
                <Link href="/downloads" className="underline hover:text-white/60">
                  Downloads
                </Link>
                .
              </p>
            </>
          )}
        </div>

        <div className="px-5 pt-1 pb-5">
          <button
            type="button"
            onClick={handleDownload}
            disabled={status !== 'ready' || !quality}
            className={cn(
              'w-full inline-flex items-center justify-center gap-2 rounded-full h-12 text-xs font-semibold uppercase tracking-widest transition-colors',
              status === 'ready' && quality
                ? 'bg-white text-black hover:bg-white/85 cursor-pointer'
                : 'bg-white/10 text-white/40 cursor-not-allowed',
            )}
          >
            <DownloadIcon size={16} />
            <span className="px-1">Download</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-white/40 text-[11px] font-semibold tracking-wider uppercase mb-2">
        {label}
      </p>
      {children}
    </div>
  );
}

function ChipGroup({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <Chip key={o} selected={o === value} onClick={() => onChange(o)}>
          {o}
        </Chip>
      ))}
    </div>
  );
}

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'px-4 py-2 rounded-full text-sm font-medium transition-colors cursor-pointer',
        selected
          ? 'bg-white text-black'
          : 'bg-white/5 text-white/70 hover:text-white hover:bg-white/10',
      )}
    >
      {children}
    </button>
  );
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="14"
      height="14"
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

function CloseIcon() {
  return (
    <svg
      width="14"
      height="14"
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
