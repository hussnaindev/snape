import { tmdbImage } from '@/lib/tmdb-image';
import type { PreferredProviderKey } from '@/lib/watch-providers';
import type { TMDBMovie, TMDBSeries } from '@/types/tmdb';
import Image from 'next/image';
import { ProviderCard, type MediaItem } from './provider-card';

const BACKDROP_ART: Partial<Record<PreferredProviderKey, string>> = {
  max: '/backdrop-max.avif',
  paramountplus: '/backdrop-paramountplus.avif',
  disneyplus: '/backdrop-disneyplus.avif',
};

const BACKDROP_ART_SIZE: Partial<Record<PreferredProviderKey, string>> = {
  paramountplus: 'h-[600px] sm:h-[820px] w-[85%] sm:w-[72%]',
};

const LOGO_SIZE: Record<PreferredProviderKey, { h: string; w: string }> = {
  netflix:       { h: 'h-10 sm:h-14',  w: 'w-[110px] sm:w-[160px]' },
  primevideo:    { h: 'h-12 sm:h-16',  w: 'w-[185px] sm:w-[250px]' },
  disneyplus:    { h: 'h-10 sm:h-14',  w: 'w-[130px] sm:w-[175px]' },
  max:           { h: 'h-8 sm:h-12',   w: 'w-[70px] sm:w-[100px]' },
  paramountplus: { h: 'h-12 sm:h-16',  w: 'w-[195px] sm:w-[260px]' },
  appletv:       { h: 'h-10 sm:h-14',  w: 'w-[150px] sm:w-[200px]' },
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
  const backdropArtSize = BACKDROP_ART_SIZE[providerKey] ?? 'h-[428px] sm:h-[600px] w-[60%] sm:w-[52%]';

  /*
   * 70 / 30 split: 70% of the art sits inside the backdrop, 30% bleeds above.
   * Backdrop: 300px mobile / 420px desktop
   * Art height = backdrop / 0.7  →  ~429px / 600px
   * Bleed (section pt) = art * 0.3  →  ~129px / 180px
   */

  return (
    <section className="relative pt-[128px] sm:pt-[180px]">

      {/* ── Character art — absolute to section, bleeds 30% above backdrop ── */}
      <div
        className={`absolute top-0 right-0 ${backdropArtSize} pointer-events-none z-10`}
        style={{ maskImage: 'linear-gradient(to right, transparent 0%, black 45%)' }}
      >
        <Image
          src={backdropArt}
          alt=""
          fill
          sizes="(max-width: 640px) 60vw, 52vw"
          className="object-contain object-right-bottom"
          style={{ filter: 'drop-shadow(-28px 0 48px rgba(0,0,0,0.85))' }}
        />
        {/* Bottom feather */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#070b08] to-transparent" />
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

        {/* Provider logo — upper-left */}
        <div className="absolute left-6 sm:left-12 top-1/4 -translate-y-1/2 z-20">
          <div className={`relative ${logo.h} ${logo.w}`}>
            <Image
              src={assetPath}
              alt={label}
              fill
              className="object-contain object-left [filter:brightness(0)_invert(1)]"
            />
          </div>
        </div>
      </div>

      {/* ── Card carousel ── */}
      <div className="-mt-14 sm:-mt-20 relative z-30 flex gap-1.5 px-5 sm:px-10 overflow-x-auto no-scrollbar pb-8 pt-1">
        {items.map((item, i) => (
          <ProviderCard key={`${item.kind}-${item.id}`} item={item} rank={i + 1} />
        ))}
      </div>
    </section>
  );
}
