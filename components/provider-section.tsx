import { tmdbImage } from '@/lib/tmdb-image';
import type { PreferredProviderKey } from '@/lib/watch-providers';
import type { TMDBMovie, TMDBSeries } from '@/types/tmdb';
import Image from 'next/image';
import { ProviderCard, type MediaItem } from './provider-card';
import Link from 'next/link';

const BACKDROP_ART: Partial<Record<PreferredProviderKey, string>> = {
  netflix: '/backdrop-netflix.avif',
  primevideo: '/backdrop-primevideo.avif',
  max: '/backdrop-max.avif',
  paramountplus: '/backdrop-paramountplus.avif',
  disneyplus: '/backdrop-disneyplus.avif',
};

const BACKDROP_ART_SIZE: Partial<Record<PreferredProviderKey, string>> = {};

const BACKDROP_ART_RIGHT: Partial<Record<PreferredProviderKey, string>> = {
  netflix: '-right-10 sm:-right-32',
  primevideo: '-right-10 sm:-right-32',
  disneyplus: '-right-10 sm:-right-32',
  paramountplus: '-right-10 sm:-right-32',
};

const LOGO_SIZE: Record<PreferredProviderKey, { h: string; w: string }> = {
  netflix:       { h: 'h-[30px] sm:h-[42px]',   w: 'w-[111px] sm:w-[155px]' },
  primevideo:    { h: 'h-[90px] sm:h-[130px]',   w: 'w-[90px] sm:w-[130px]' },
  disneyplus:    { h: 'h-[38px] sm:h-[65px]',   w: 'w-[70px] sm:w-[120px]' },
  max:           { h: 'h-[24px] sm:h-[34px]',   w: 'w-[139px] sm:w-[196px]' },
  paramountplus: { h: 'h-[58px] sm:h-[80px]',   w: 'w-[58px] sm:w-[80px]' },
  appletv:       { h: 'h-[58px] sm:h-[80px]',   w: 'w-[58px] sm:w-[80px]' },
};

// ── Hardcoded hero data per provider ──
const HERO_TITLE: Record<PreferredProviderKey, string> = {
  netflix:       'Dune',
  max:           'House of the Dragon',
  primevideo:    'Dune',
  disneyplus:    'Harry Potter and the Philosopher\u2019s Stone',
  paramountplus: 'Naked and Afraid',
  appletv:       'Dune',
};

const HERO_TYPE: Record<PreferredProviderKey, 'Series' | 'Movie'> = {
  netflix:       'Movie',
  max:           'Series',
  primevideo:    'Movie',
  disneyplus:    'Movie',
  paramountplus: 'Series',
  appletv:       'Movie',
};

const HERO_ID: Record<PreferredProviderKey, number> = {
  netflix:       438631,
  max:           94997,
  primevideo:    438631,
  disneyplus:    671,
  paramountplus: 58832,
  appletv:       438631,
};

const HERO_RATING: Record<PreferredProviderKey, string> = {
  netflix:       '8.6',
  max:           '8.4',
  primevideo:    '8.6',
  disneyplus:    '7.6',
  paramountplus: '6.6',
  appletv:       '8.6',
};

interface ProviderSectionProps {
  providerKey: PreferredProviderKey;
  label: string;
  assetPath: string;
  brandColor: string;
  movies: TMDBMovie[];
  series: TMDBSeries[];
}

export function ProviderSection({ providerKey, label, assetPath, brandColor, movies, series }: ProviderSectionProps) {
  const items: MediaItem[] = [
    ...movies
      .filter((m) => m.poster_path)
      .map((m): MediaItem => ({
        kind: 'movie',
        id: m.id,
        title: m.title,
        poster_path: m.poster_path,
        vote_average: m.vote_average,
        popularity: m.popularity,
      })),
    ...series
      .filter((s) => s.poster_path)
      .map((s): MediaItem => ({
        kind: 'series',
        id: s.id,
        title: s.name,
        poster_path: s.poster_path,
        vote_average: s.vote_average,
        popularity: s.popularity,
      })),
  ]
    .sort((a, b) => b.popularity - a.popularity)
    .slice(0, 10);

  if (items.length === 0) return null;

  const logo = LOGO_SIZE[providerKey];
  const backdropArt = BACKDROP_ART[providerKey] ?? '/test-character.avif';
  const backdropArtSize = BACKDROP_ART_SIZE[providerKey] ?? 'h-[440px] sm:h-[610px] w-[72%] sm:w-[62%]';
  const backdropArtRight = BACKDROP_ART_RIGHT[providerKey] ?? 'right-0';

  return (
    <section className="relative pt-12 sm:pt-[180px]">

      {/* ── Character art — billboard style, pops above section, aligns with cards ── */}
      <div
        className={`absolute top-[-56px] sm:top-[-80px] ${backdropArtRight} ${backdropArtSize} pointer-events-none z-10`}
        style={{ maskImage: 'linear-gradient(to right, transparent 8%, black 42%)' }}
      >
        <Image
          src={backdropArt}
          alt=""
          fill
          sizes="(max-width: 640px) 70vw, 60vw"
          className="object-cover object-top scale-105 sm:object-contain sm:object-right-bottom"
          style={{ filter: 'drop-shadow(-32px 0 56px rgba(0,0,0,0.9))' }}
        />
        {/* Bottom feather into cards */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#070b08] to-transparent" />
      </div>

      {/* ── Backdrop — single seamless gradient, no separate overlay divs ── */}
      <div className="relative h-[300px] sm:h-[420px] overflow-hidden">
        {/* One smooth gradient: dark left → brand colour right. No hard seam. */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to right, #070b08 0%, #070b08 28%, ${brandColor}30 58%, ${brandColor}55 100%)`,
          }}
        />
        {/* Top vignette */}
        <div className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-black/45 to-transparent" />
        {/* Bottom fade into page bg */}
        <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#070b08] via-[#070b08]/60 to-transparent" />

        {/* Provider hero — upper-left */}
        <div className="absolute left-6 sm:left-12 top-[41%] -translate-y-1/2 z-20 flex flex-col items-start gap-3 sm:gap-4">
          <div className={`relative ${logo.h} ${logo.w}`}>
            <Image
              src={assetPath}
              alt={label}
              fill
              className="object-contain object-left [filter:brightness(0)_invert(1)]"
            />
          </div>

          <p className="text-white text-sm sm:text-lg font-semibold leading-tight max-w-[200px] sm:max-w-[300px]">
            {HERO_TITLE[providerKey]}
          </p>

          <div className="flex items-center gap-2 sm:gap-3">
            <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-white/70 bg-white/10 rounded-full px-2.5 py-0.5">
              {HERO_TYPE[providerKey]}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-white/70 bg-white/10 rounded-full px-2.5 py-0.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="12,2 15,10 24,10 17,16 19,24 12,19 5,24 7,16 0,10 9,10" />
              </svg>
              {HERO_RATING[providerKey]}
            </span>
          </div>

          <div className="flex gap-2 sm:gap-3">
            <Link
              href={HERO_TYPE[providerKey] === 'Movie' ? `/movie/${HERO_ID[providerKey]}` : `/series/${HERO_ID[providerKey]}`}
              className="px-4 sm:px-6 py-1.5 sm:py-2 rounded-full bg-white text-black text-xs sm:text-sm font-semibold hover:bg-white/90 transition-colors flex items-center gap-1.5"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="6,4 20,12 6,20" />
              </svg>
              Watch
            </Link>
            <Link
              href={`/browse/provider/${providerKey}`}
              className="px-4 sm:px-6 py-1.5 sm:py-2 rounded-full border border-white/70 bg-white/15 text-white text-xs sm:text-sm font-semibold hover:bg-white/25 transition-colors sm:border-white/30 sm:bg-transparent"
            >
              Explore {label}
            </Link>
          </div>
        </div>
      </div>

      {/* ── Card carousel ── */}
      <div className="-mt-14 sm:-mt-20 relative z-30 flex gap-1.5 px-5 sm:px-10 overflow-x-auto no-scrollbar pb-2 sm:pb-8 pt-1">
        {items.map((item, i) => (
          <ProviderCard key={`${item.kind}-${item.id}`} item={item} rank={i + 1} />
        ))}
      </div>
    </section>
  );
}
