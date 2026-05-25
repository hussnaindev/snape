'use client';

import { SnakeLoader } from '@/components/ui/snake-loader';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useTransition } from 'react';

type Props = {
  hasMore: boolean;
};

export function InfiniteScrollSentinel({ hasMore }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    loadingRef.current = false;
  }, [searchParams]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore) return;

    const obs = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loadingRef.current) return;
        loadingRef.current = true;
        const next = new URLSearchParams(searchParams.toString());
        const page = Number(next.get('page') ?? 1);
        next.set('page', String(page + 1));
        startTransition(() => {
          router.push(`${pathname}?${next.toString()}`, { scroll: false });
        });
      },
      { rootMargin: '480px' },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, pathname, searchParams, router]);

  if (!hasMore) return null;

  return (
    <>
      <div ref={sentinelRef} className="h-32 flex justify-center items-center py-6" />
      {isPending && (
        <div className="flex justify-center py-6">
          <SnakeLoader size={48} />
        </div>
      )}
    </>
  );
}
