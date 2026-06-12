'use client';

import { type ToastItem, dismissToast, subscribeToasts } from '@/lib/toast';
import { useEffect, useState } from 'react';

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToasts(setToasts), []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 px-4 pb-4 pointer-events-none md:items-end md:px-6"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => dismissToast(t.id)}
          className="pointer-events-auto flex items-center gap-3 max-w-sm w-full md:w-auto rounded-xl bg-[#16181a] border border-white/15 shadow-2xl px-4 py-3 text-left animate-fade-in cursor-pointer"
        >
          <ToastIcon icon={t.icon} />
          <span className="text-white text-sm font-medium flex-1 min-w-0">{t.message}</span>
        </button>
      ))}
    </div>
  );
}

function ToastIcon({ icon }: { icon: ToastItem['icon'] }) {
  if (icon === 'check') {
    return (
      <span className="flex-none flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-400">
        <svg
          width="15"
          height="15"
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
      </span>
    );
  }
  if (icon === 'error') {
    return (
      <span className="flex-none flex items-center justify-center w-7 h-7 rounded-full bg-red-500/15 text-red-400">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </span>
    );
  }
  // default: download
  return (
    <span className="flex-none flex items-center justify-center w-7 h-7 rounded-full bg-white/10 text-white">
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
    </span>
  );
}
