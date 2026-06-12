'use client';

import { DownloadIcon } from '@/components/ui/download-icon';
import { type DownloadRecord, isDownloadActive, subscribeDownloads } from '@/lib/downloads';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

// Desktop-only topbar entry to /downloads. When downloads are in progress it
// shows a circular progress ring around the icon plus a count badge.
export function DownloadsIndicator({ className }: { className?: string }) {
  const [active, setActive] = useState<DownloadRecord[]>([]);
  const pathname = usePathname();

  useEffect(
    () => subscribeDownloads((all) => setActive(all.filter((r) => isDownloadActive(r.status)))),
    [],
  );

  const count = active.length;
  const sumTotal = active.reduce((a, r) => a + (r.totalBytes || 0), 0);
  const sumRecv = active.reduce((a, r) => a + (r.receivedBytes || 0), 0);
  const pct =
    count === 0
      ? 0
      : sumTotal > 0
        ? Math.min(99, Math.round((sumRecv / sumTotal) * 100))
        : Math.round(active.reduce((a, r) => a + r.progress, 0) / count);
  const downloading = active.some((r) => r.status === 'downloading' || r.status === 'queued');
  const onPage = pathname === '/downloads';

  const R = 14;
  const C = 2 * Math.PI * R;

  return (
    <Link
      href="/downloads"
      aria-label={count > 0 ? `Downloads — ${count} in progress` : 'Downloads'}
      className={cn(
        'relative hidden md:inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors',
        onPage ? 'text-white' : 'text-white/70 hover:text-white',
        className,
      )}
    >
      {count > 0 && (
        <svg
          className="absolute inset-0 -rotate-90"
          width="36"
          height="36"
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
            className="stroke-emerald-400"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct / 100)}
            style={{ transition: 'stroke-dashoffset 0.3s ease' }}
          />
        </svg>
      )}
      <DownloadIcon size={18} className={downloading ? 'animate-pulse' : ''} />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-white text-[10px] font-bold leading-none flex items-center justify-center">
          {count}
        </span>
      )}
    </Link>
  );
}
