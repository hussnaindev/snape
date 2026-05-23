import { tmdbResponsive } from '@/lib/tmdb-image';
import type { TMDBPersonMovieCredit } from '@/types/tmdb';
import Image from 'next/image';
import Link from 'next/link';

interface PersonCardProps {
  credit: TMDBPersonMovieCredit;
}

export function PersonCard({ credit }: PersonCardProps) {
  const poster = tmdbResponsive(credit.poster_path, 'w342', 'w500');

  return (
    <div className="group relative flex-none w-[130px] sm:w-[170px] md:w-[180px] lg:w-[190px] xl:w-[210px] 2xl:w-[240px] overflow-hidden rounded-2xl sm:rounded-[28px] bg-white/5 ring-1 sm:ring-2 ring-white/25 shadow-[0_8px_24px_rgba(255,255,255,0.08),_0_2px_6px_rgba(255,255,255,0.05)] transition-transform duration-500 ease-out lg:hover:scale-110 lg:hover:z-40">
      <Link href={`/movie/${credit.id}`} prefetch={false} className="block h-full w-full">
        <div className="aspect-[2/3] overflow-hidden relative">
          {poster ? (
            <picture>
              <source srcSet={poster.desktop} media="(min-width: 1024px)" />
              <Image
                src={poster.mobile}
                alt={credit.title}
                fill
                sizes="(max-width: 640px) 130px, (max-width: 1024px) 180px, 240px"
                className="object-cover will-change-transform transition-transform duration-500 lg:group-hover:animate-breath"
              />
            </picture>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-white/5 text-white/20 text-sm">
              {credit.title}
            </div>
          )}

          {/* Type chip top-left */}
          <span className="absolute top-1.5 left-2 lg:top-2 lg:left-3 z-10 inline-flex items-center text-[8px] sm:text-[9px] lg:text-[9px] xl:text-[9px] 2xl:text-[9px] font-semibold leading-none tracking-widest uppercase text-white/80 border border-white/40 rounded-full px-2 py-1 lg:px-2 lg:py-1 bg-black/60">
            Film
          </span>

          {/* Rating chip top-right */}
          {credit.vote_average > 0 && (
            <span className="absolute top-1.5 right-2 lg:top-2 lg:right-3 z-10 inline-flex items-center gap-1 rounded-full border border-white/40 px-2 py-1 lg:px-2 lg:py-1 text-[8px] sm:text-[9px] lg:text-[9px] xl:text-[9px] 2xl:text-[9px] font-semibold leading-none tabular-nums text-white bg-black/60">
              ★ {credit.vote_average.toFixed(1)}
            </span>
          )}

          {/* Title bar at bottom */}
          <div className="absolute inset-x-0 bottom-0 flex items-center pointer-events-none z-0">
            <div className="w-full bg-gradient-to-t from-black/85 to-black/50 py-1.5 sm:py-2 rounded-t-md px-3">
              <p className="text-[10px] sm:text-[11px] font-chesna-grotesk uppercase truncate tracking-[0.2em] font-light text-white/90 text-center">
                {credit.title}
              </p>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
