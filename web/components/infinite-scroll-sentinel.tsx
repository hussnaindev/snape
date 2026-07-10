'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useTransition } from 'react';

type Props = {
  hasMore: boolean;
  /** Next URL from the server — avoids useSearchParams (edge/Suspense issues). */
  nextHref: string | null;
};

export function InfiniteScrollSentinel({ hasMore, nextHref }: Props) {
  const router = useRouter();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    loadingRef.current = false;
    const el = sentinelRef.current;
    if (!el || !hasMore || !nextHref) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingRef.current) return;
        loadingRef.current = true;
        startTransition(() => {
          router.push(nextHref, { scroll: false });
        });
      },
      { rootMargin: '480px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, nextHref, router]);

  if (!hasMore) return null;

  return (
    <>
      <div ref={sentinelRef} className="h-32 flex justify-center items-center py-6" />
      {isPending && (
        <div className="flex justify-center py-6" aria-busy="true" aria-label="Loading more">
          <div className="h-12 w-12 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
        </div>
      )}
    </>
  );
}
