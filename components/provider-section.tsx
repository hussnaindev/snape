import { tmdbImage } from '@/lib/tmdb-image';
import type { PreferredProviderKey } from '@/lib/watch-providers';
import type { TMDBMovie, TMDBSeries } from '@/types/tmdb';
import Image from 'next/image';
import { ParallaxBackdrop } from './parallax-backdrop';
import { ParallaxCarousel } from './parallax-carousel';
import { ParallaxMeta } from './parallax-meta';
import { ProviderCard, type MediaItem } from './provider-card';
import Link from 'next/link';

const BACKDROP_ART: Partial<Record<PreferredProviderKey, string>> = {
  netflix: '/backdrop-netflix.avif',
  primevideo: '/backdrop-primevideo.avif',
  max: '/backdrop-max.avif',
  paramountplus: '/backdrop-paramountplus.avif',
  disneyplus: '/backdrop-disneyplus.avif',
};

const LOGO_SIZE: Record<PreferredProviderKey, { h: string; w: string }> = {
  netflix:       { h: 'h-[30px] sm:h-[42px]',  w: 'w-[111px] sm:w-[155px]' },
  primevideo:    { h: 'h-[90px] sm:h-[130px]',  w: 'w-[90px] sm:w-[130px]' },
  disneyplus:    { h: 'h-[38px] sm:h-[65px]',   w: 'w-[70px] sm:w-[120px]' },
  max:           { h: 'h-[24px] sm:h-[34px]',   w: 'w-[139px] sm:w-[196px]' },
  paramountplus: { h: 'h-[58px] sm:h-[80px]',   w: 'w-[58px] sm:w-[80px]' },
  appletv:       { h: 'h-[58px] sm:h-[80px]',   w: 'w-[58px] sm:w-[80px]' },
};

const HERO_TITLE: Record<PreferredProviderKey, string> = {
  netflix:       'Stranger Things',
  max:           'House of the Dragon',
  primevideo:    'The Boys',
  disneyplus:    'Loki',
  paramountplus: 'Yellowstone',
  appletv:       'Dune',
};

const HERO_TYPE: Record<PreferredProviderKey, 'Series' | 'Movie'> = {
  netflix:       'Series',
  max:           'Series',
  primevideo:    'Series',
  disneyplus:    'Series',
  paramountplus: 'Series',
  appletv:       'Movie',
};

const HERO_ID: Record<PreferredProviderKey, number> = {
  netflix:       66732,
  max:           94997,
  primevideo:    76479,
  disneyplus:    84958,
  paramountplus: 73586,
  appletv:       438631,
};

const HERO_OVERVIEW: Partial<Record<PreferredProviderKey, string>> = {
  netflix:       'When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces, and one strange little girl.',
  max:           'The Targaryen dynasty is at the absolute apex of its power, with more than 15 dragons under their yoke. Most empires crumble from such heights. In the case of the Targaryens, their slow fall begins when King Viserys breaks with a century of tradition by naming his daughter Rhaenyra heir to the Iron Throne. But when Viserys later fathers a son, the court is shocked when Rhaenyra retains her status as his heir, and seeds of division sow friction across the realm.',
  primevideo:    'A group of vigilantes known informally as "The Boys" set out to take down corrupt superheroes with no more than blue-collar grit and a willingness to fight dirty.',
  disneyplus:    'After stealing the Tesseract during the events of "Avengers: Endgame," an alternate version of Loki is brought to the mysterious Time Variance Authority, a bureaucratic organization that exists outside of time and space and monitors the timeline. They give Loki a choice: face being erased from existence due to being a "time variant" or help fix the timeline and stop a greater threat.',
  paramountplus:  'Follow the violent world of the Dutton family, who controls the largest contiguous ranch in the United States. Led by their patriarch John Dutton, the family defends their property against constant attack by land developers, an Indian reservation, and America\'s first National Park.',
  appletv:       'Paul Atreides, a brilliant and gifted young man born into a great destiny beyond his understanding, must travel to the most dangerous planet in the universe to ensure the future of his family and his people. As malevolent forces explode into conflict over the planet\'s exclusive supply of the most precious resource in existence - a commodity capable of unlocking humanity\'s greatest potential - only those who can conquer their fear will survive.',
};

const HERO_RATING: Record<PreferredProviderKey, string> = {
  netflix:       '8.7',
  max:           '8.4',
  primevideo:    '8.6',
  disneyplus:    '8.5',
  paramountplus: '8.6',
  appletv:       '8.6',
};

const HERO_YEAR: Partial<Record<PreferredProviderKey, string>> = {
  netflix:       '2016',
  max:           '2022',
  primevideo:    '2019',
  disneyplus:    '2021',
  paramountplus: '2018',
  appletv:       '2021',
};

const HERO_GENRE: Partial<Record<PreferredProviderKey, string>> = {
  netflix:       'Sci-Fi Fantasy',
  max:           'Fantasy Drama',
  primevideo:    'Action Comedy',
  disneyplus:    'Action Adventure',
  paramountplus: 'Western Drama',
  appletv:       'Sci-Fi Adventure',
};

const HERO_AWARD: Partial<Record<PreferredProviderKey, string>> = {
  netflix:       'Emmy Winner',
  max:           'Emmy Winner',
  primevideo:    'Emmy Winner',
  disneyplus:    'Emmy Winner',
  paramountplus: 'Oscar Winner',
  appletv:       'Oscar Winner',
};

const HERO_RT: Partial<Record<PreferredProviderKey, { score: number; isFresh: boolean }>> = {
  netflix:       { score: 90, isFresh: true },
  max:           { score: 87, isFresh: true },
  primevideo:    { score: 93, isFresh: true },
  disneyplus:    { score: 87, isFresh: true },
  paramountplus: { score: 83, isFresh: true },
  appletv:       { score: 83, isFresh: true },
};

const HERO_RUNTIME: Partial<Record<PreferredProviderKey, string>> = {
  netflix:       '5 Seasons',
  max:           '2 Seasons',
  primevideo:    '5 Seasons',
  disneyplus:    '2 Seasons',
  paramountplus: '5 Seasons',
  appletv:       '2h 35m',
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
  const backdropArtTranslate = { netflix: 'sm:translate-x-32', primevideo: 'sm:translate-x-32', paramountplus: 'sm:translate-x-32', disneyplus: ' sm:translate-x-0' } as Partial<Record<PreferredProviderKey, string>>;
  const artTranslate = backdropArtTranslate[providerKey] ?? '';

  return (
    <section className="relative">

      {/* ── Backdrop ── */}
      <div className="relative h-[340px] sm:h-[560px] overflow-hidden">

        {/* Background gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to right, #070b08 0%, #070b08 28%, ${brandColor}30 58%, ${brandColor}55 100%)`,
          }}
        />

        {/* Character art with parallax */}
        <ParallaxBackdrop
          src={backdropArt}
          wrapperClassName={`absolute inset-y-0 right-0 ${providerKey === 'disneyplus' ? 'w-5/5 sm:w-[62%]' : 'w-3/5 sm:w-[62%]'} pointer-events-none ${artTranslate}`}
          imageClassName="object-cover object-top sm:object-contain sm:object-right-bottom"
        />

        {/* Top vignette — exact page-bg color so section top is invisible against page */}
        <div className="absolute inset-x-0 top-0 h-1/5 bg-gradient-to-b from-[#070b08] to-transparent" />
        {/* Bottom fade into page bg */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#070b08] via-[#070b08]/60 to-transparent" />

        {/* Provider hero — upper-left */}
        <div className="absolute left-6 sm:left-12 top-[41%] -translate-y-1/2 z-20">
        <ParallaxMeta>
        <div className="flex flex-col items-start gap-3 sm:gap-4">
          <div className={`relative ${logo.h} ${logo.w}`}>
            <Image
              src={assetPath}
              alt={label}
              fill
              className="object-contain object-left [filter:brightness(0)_invert(1)]"
            />
          </div>

          <p className="text-base sm:text-3xl font-itc-pioneer leading-tight max-w-[180px] sm:max-w-[340px]" style={{ color: 'black', WebkitTextStroke: `1px ${brandColor}` }}>
            {HERO_TITLE[providerKey]}
          </p>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span
              className="hidden sm:inline text-white/70 font-medium"
              style={{
                fontSize: 11,
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: 20,
                padding: '2px 10px',
              }}
            >
              {HERO_TYPE[providerKey]}
            </span>
            <span
              className="hidden sm:inline text-white/70 font-medium"
              style={{
                fontSize: 11,
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: 20,
                padding: '2px 10px',
              }}
            >
              {HERO_GENRE[providerKey]}
            </span>
            <span
              className="text-white/70 font-medium"
              style={{
                fontSize: 11,
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: 20,
                padding: '2px 10px',
              }}
            >
              {HERO_YEAR[providerKey]}
            </span>
            <span
              className="text-white/70 font-medium"
              style={{
                fontSize: 11,
                border: '1px solid rgba(255,255,255,0.35)',
                borderRadius: 20,
                padding: '2px 10px',
              }}
            >
              {HERO_RUNTIME[providerKey]}
            </span>
          </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="text-white/70 font-medium" style={{ fontSize: 11 }}>
              HD
            </span>
            <span className="text-white/70 font-medium" style={{ fontSize: 11 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="inline-block mr-0.5 -mt-0.5">
                <polygon points="12,2 15,10 24,10 17,16 19,24 12,19 5,24 7,16 0,10 9,10" />
              </svg>
              {HERO_RATING[providerKey]}
            </span>
            {HERO_RT[providerKey] && (
              <span className="inline-flex items-center gap-1 font-medium" style={{ fontSize: 11, color: HERO_RT[providerKey].isFresh ? '#86efac' : '#fca5a5' }}>
                <Image
                  src="/fresh-tomato-logo.png"
                  alt="Rotten Tomatoes"
                  width={13}
                  height={13}
                  className="inline object-contain"
                />
                {HERO_RT[providerKey].score}%
              </span>
            )}
          </div>

          {HERO_OVERVIEW[providerKey] && (
            <p
              className="hero-desc text-white/60 text-sm leading-snug max-w-[400px]"
              style={{
                display: 'none',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}
            >
              {HERO_OVERVIEW[providerKey]}
            </p>
          )}
          <style>{`
            @media (min-width: 640px) {
              .hero-desc {
                display: -webkit-box !important;
              }
            }
          `}</style>

          <div className="flex gap-2 sm:gap-3">
            <Link
              href={HERO_TYPE[providerKey] === 'Movie' ? `/movie/${HERO_ID[providerKey]}` : `/series/${HERO_ID[providerKey]}`}
              className="relative top-0 inline-flex items-center justify-center gap-1 text-nowrap rounded-full border py-0.5 text-[10px] sm:text-xs font-semibold uppercase tracking-widest transition-all duration-300 ease-out cursor-pointer active:top-0.5 h-8 px-2.5 sm:h-10 sm:px-3 md:h-12 md:px-5 min-w-28 sm:min-w-32 md:min-w-36 border-transparent bg-white text-black lg:hover:bg-white/80 active:bg-white/70"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <polygon points="6,4 20,12 6,20" />
              </svg>
              <span className="px-2">Watch</span>
            </Link>
            <Link
              href={`/browse/provider/${providerKey}`}
              className="relative top-0 inline-flex items-center justify-center gap-1 text-nowrap rounded-full border py-0.5 text-[10px] sm:text-xs font-semibold uppercase tracking-widest transition-all duration-300 ease-out cursor-pointer active:top-0.5 h-8 px-2.5 sm:h-10 sm:px-3 md:h-12 md:px-5 min-w-28 sm:min-w-32 md:min-w-36 border-white/20 bg-white/10 text-white lg:hover:border-transparent lg:hover:bg-white/20 lg:hover:text-white active:border-transparent active:bg-white/20"
            >
              <span className="px-2">Explore {label}</span>
            </Link>
          </div>
        </div>
        </ParallaxMeta>
        </div>
      </div>

      {/* ── Card carousel — pt-8/pt-10 padding absorbs hover translate-y so cards never clip ── */}
      <ParallaxCarousel className="-mt-16 sm:-mt-20 relative z-30 flex gap-1.5 px-5 sm:px-10 2xl:px-16 3xl:px-24 overflow-x-auto no-scrollbar pb-4 sm:pb-6 pt-8 sm:pt-10">
        {items.map((item, i) => (
          <ProviderCard
            key={`${item.kind}-${item.id}`}
            item={item}
            rank={i + 1}
            prefetch={i < 3}
          />
        ))}
      </ParallaxCarousel>
    </section>
  );
}
