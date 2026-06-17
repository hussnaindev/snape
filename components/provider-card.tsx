import type { MediaItem } from '@/lib/media-item';
import { tmdbResponsive } from '@/lib/tmdb-image';
import Image from 'next/image';
import Link from 'next/link';

interface ProviderCardProps {
  item: MediaItem;
  rank: number;
  prefetch?: boolean;
}

export function ProviderCard({ item, rank, prefetch = false }: ProviderCardProps) {
  const href = item.kind === 'movie' ? `/movie/${item.id}` : `/series/${item.id}`;
  const poster = tmdbResponsive(item.poster_path, 'w342', 'w500');

  return (
    <Link
      href={href}
      prefetch={prefetch}
      className="group relative flex-none w-[130px] sm:w-[175px] overflow-hidden rounded-2xl bg-white/5 -translate-y-3 ring-1 ring-white/25 shadow-[0_8px_24px_rgba(255,255,255,0.08),_0_2px_6px_rgba(255,255,255,0.05)] cursor-pointer"
    >
      <div className="aspect-[2/3] relative overflow-hidden">
        {poster ? (
          <picture>
            <source srcSet={poster.desktop} media="(min-width: 1024px)" />
            <Image
              src={poster.mobile}
              alt={item.title}
              fill
              sizes="(max-width: 640px) 130px, 175px"
              className="object-cover transition-transform duration-300 ease-out group-hover:scale-110"
            />
          </picture>
        ) : (
          <div className="absolute inset-0 bg-white/5 flex items-center justify-center text-white/20 text-xs">
            No Image
          </div>
        )}

        {/* Rank number hidden — kept for future use */}

        {/* Play overlay on hover */}
        <div className="absolute inset-0 bg-black/50 opacity-0 hidden items-center justify-center">
          <div className="w-12 h-12 rounded-full border border-white/50 bg-black/30 flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.12)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <polygon points="6,4 20,12 6,20" />
            </svg>
          </div>
        </div>

        {/* Type chip top-left */}
        <span className="absolute top-1.5 left-2 lg:top-2 lg:left-3 z-10 inline-flex items-center text-[8px] sm:text-[9px] lg:text-[9px] xl:text-[9px] 2xl:text-[9px] font-semibold tracking-widest uppercase text-white/80 border border-white/40 rounded-full px-2 py-1 lg:px-2 lg:py-1 bg-black/60">
          {item.kind === 'movie' ? 'Film' : 'Series'}
        </span>

        {/* Rating chip top-right */}
        {item.vote_average > 0 && (
          <span className="absolute top-1.5 right-2 lg:top-2 lg:right-3 z-10 inline-flex items-center gap-1 rounded-full border border-white/40 px-2 py-1 lg:px-2 lg:py-1 text-[8px] sm:text-[9px] lg:text-[9px] xl:text-[9px] 2xl:text-[9px] font-semibold tabular-nums text-white bg-black/60">
            ★ {item.vote_average.toFixed(1)}
          </span>
        )}

        {/* Title bar at bottom */}
        <div className="absolute inset-x-0 bottom-0 flex items-center pointer-events-none z-0">
          <div className="w-full bg-gradient-to-t from-black/85 to-black/50 py-1.5 sm:py-2 rounded-t-md px-3">
            <p className="text-[10px] sm:text-[11px] font-chesna-grotesk uppercase truncate tracking-[0.2em] font-light text-white/90 text-center">
              {item.title}
            </p>
          </div>
        </div>
      </div>
    </Link>
  );
}
