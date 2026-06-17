'use client';

import { tmdbImage, tmdbResponsive } from '@/lib/tmdb-image';
import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';

type Poster = { posterPath: string; title: string };

const FALLBACK_POSTERS: Poster[] = [
  { posterPath: '/kqjL17yufvn9OVLyXYpvtyrFfak.jpg', title: 'The Dark Knight' },
  { posterPath: '/6ELCZlTA5lGUops70hKdB83WJxH.jpg', title: 'Interstellar' },
  { posterPath: '/mY7SeH4HFFxW1hiI6cWuwCRKptN.jpg', title: 'Dune' },
  { posterPath: '/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg', title: 'Fight Club' },
  { posterPath: '/lFSSLTlFozwpaGlO31OoUeirBgQ.jpg', title: 'Breaking Bad' },
  { posterPath: '/qJRB789ceLryrLvOKrZqLKr2CGf.jpg', title: 'Game of Thrones' },
  { posterPath: '/9O1Iy9od7xHc45QYdCzWvtF6i5G.jpg', title: 'Inception' },
];

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function repeatToMin<T>(arr: T[], minLen: number): T[] {
  if (arr.length === 0) return [];
  const out: T[] = [];
  while (out.length < minLen) out.push(...arr);
  return out.slice(0, minLen);
}

export function FloatingAuthBg() {
  const [posters, setPosters] = useState<Poster[]>(FALLBACK_POSTERS);
  const [broken, setBroken] = useState<Record<string, true>>({});

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        // Fetch trending across movie+tv so poster paths are real & current.
        const res = await fetch('/api/tmdb/trending/all/week', { cache: 'force-cache' });
        const json = (await res.json()) as unknown;
        if (!res.ok) throw new Error('tmdb proxy failed');
        if (!json || typeof json !== 'object') throw new Error('bad payload');

        const data = (json as { ok?: unknown; data?: unknown }).data as
          | { results?: unknown }
          | undefined;
        const results = (data?.results as any[]) ?? [];
        const mapped: Poster[] = results
          .map((r) => {
            const posterPath =
              typeof r?.poster_path === 'string' ? (r.poster_path as string) : null;
            if (!posterPath) return null;
            const title =
              (typeof r?.title === 'string' && r.title) ||
              (typeof r?.name === 'string' && r.name) ||
              'Poster';
            return { posterPath, title } satisfies Poster;
          })
          .filter(Boolean) as Poster[];

        // Keep it dense even if TMDB returns few posters.
        const dense = mapped.length >= 18 ? mapped.slice(0, 36) : [...mapped, ...FALLBACK_POSTERS];
        if (!cancelled && dense.length > 0) setPosters(dense);
      } catch {
        // keep fallback
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    // Portrait card rows, straight aligned. We create 3 rows (always full cards).
    const usable = posters.filter((p) => !!tmdbImage(p.posterPath, 'w342'));
    const base = usable.length >= 18 ? usable.slice(0, 30) : [...usable, ...FALLBACK_POSTERS];
    const perRow = 10;
    const wantedRows = 3;
    const needed = perRow * wantedRows;
    const filled = repeatToMin(base, needed);
    return chunk(filled, perRow).slice(0, wantedRows);
  }, [posters]);

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-none"
      aria-hidden="true"
    >
      <style>{`
        @keyframes authMarqueeLeft {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes authMarqueeRight {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
      `}</style>

      <div className="absolute inset-0 flex flex-col justify-center gap-[clamp(10px,2vh,18px)] px-6 py-[clamp(56px,7vh,110px)]">
        {rows.map((row, rowIdx) => {
          const dir: 'left' | 'right' = rowIdx % 2 === 0 ? 'left' : 'right';
          const duration = `${28 + rowIdx * 6}s`;
          const anim = dir === 'left' ? 'authMarqueeLeft' : 'authMarqueeRight';

          // Duplicate row for seamless marquee.
          const track = [...row, ...row];

          return (
            <div key={rowIdx} className="relative overflow-hidden">
              <div
                className="flex items-center gap-5 will-change-transform"
                style={{
                  width: 'max-content',
                  animation: `${anim} ${duration} linear infinite`,
                }}
              >
                {track.map((poster, i) => {
                  const src = tmdbResponsive(poster.posterPath, 'w342', 'w500');
                  if (!src || broken[src.mobile]) return null;

                  return (
                    <div
                      key={`${poster.posterPath}-${i}`}
                      className="relative shrink-0 h-[clamp(200px,22vh,340px)] aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 shadow-[0_18px_60px_rgba(0,0,0,0.65)] bg-white/5"
                    >
                      <picture>
                        <source srcSet={src.desktop} media="(min-width: 1024px)" />
                        <Image
                          src={src.mobile}
                          alt={poster.title}
                          fill
                          sizes="(max-width: 768px) 24vh, 340px"
                          className="object-cover"
                          priority={rowIdx === 0 && i < 4}
                          onError={() => setBroken((b) => ({ ...b, [src.mobile]: true }))}
                        />
                      </picture>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="absolute inset-0 ring-1 ring-white/10 rounded-2xl" />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
