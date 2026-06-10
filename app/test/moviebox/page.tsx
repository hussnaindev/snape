'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { PeachifyPlayer } from '@/components/peachify-player';

function MovieboxTestContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';
  const [input, setInput] = useState(initialQ);
  const [activeQ, setActiveQ] = useState(initialQ);

  const extractUrl = activeQ ? `/api/moviebox?q=${encodeURIComponent(activeQ)}` : '';
  const extractCacheKey = activeQ ? `moviebox:${activeQ.toLowerCase()}` : '';

  function play() {
    const q = input.trim();
    if (!q) return;
    setActiveQ(q);
    router.replace(`/test/moviebox?q=${encodeURIComponent(q)}`);
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-black">
      <div className="z-20 flex shrink-0 items-center gap-2 border-b border-white/10 bg-black/90 px-3 py-2">
        <Link href="/" className="shrink-0 text-sm text-white/70 hover:text-white">
          ← Home
        </Link>
        <input
          type="search"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && play()}
          placeholder="MovieBox title search…"
          className="min-w-0 flex-1 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/40"
        />
        <button
          type="button"
          onClick={play}
          className="shrink-0 rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-white/90"
        >
          Play
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        {activeQ ? (
          <PeachifyPlayer
            type="movie"
            tmdbId={0}
            title={activeQ}
            extractUrl={extractUrl}
            extractCacheKey={extractCacheKey}
            className="h-full w-full"
          />
        ) : (
          <p className="pt-24 text-center text-sm text-white/50">Search a title to test MovieBox playback end-to-end.</p>
        )}
      </div>
    </div>
  );
}

export default function MovieboxTestPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black" />}>
      <MovieboxTestContent />
    </Suspense>
  );
}
