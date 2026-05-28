import { tmdbImage } from '@/lib/tmdb-image';
import type { CuratedProviderKey } from '@/lib/curated-providers';
import type { TMDBMovie, TMDBSeries } from '@/types/tmdb';
import Image from 'next/image';
import { ParallaxBackdrop } from './parallax-backdrop';
import { ParallaxCarousel } from './parallax-carousel';
import { ParallaxMeta } from './parallax-meta';
import type { MediaItem } from '@/lib/media-item';
import { ProviderCard } from './provider-card';
import Link from 'next/link';

const CAROUSEL_SIZE = 10;

function voteToRtPercent(vote: number): number {
  return Math.round(vote * 10);
}

function formatYear(releaseDate: string): string | null {
  const year = releaseDate?.slice(0, 4);
  return year && year !== '0000' ? year : null;
}

interface CuratedProviderSectionProps {
  providerKey: CuratedProviderKey;
  label: string;
  brandColor: string;
  mediaType: 'movie' | 'series';
  movies: TMDBMovie[] | TMDBSeries[];
}

function itemTitle(m: TMDBMovie | TMDBSeries): string {
  return 'title' in m ? m.title : m.name;
}

function itemDate(m: TMDBMovie | TMDBSeries): string {
  return 'release_date' in m ? m.release_date : m.first_air_date;
}

export function CuratedProviderSection({ providerKey, label, brandColor, mediaType, movies }: CuratedProviderSectionProps) {
  const sorted = [...movies]
    .filter((m) => m.poster_path)
    .sort((a, b) => b.popularity - a.popularity);

  const hero =
    sorted.find((m) => m.backdrop_path) ??
    movies.find((m) => m.backdrop_path) ??
    sorted[0] ??
    movies[0];

  const carouselMovies = hero
    ? [
        ...(hero.poster_path ? [hero] : []),
        ...sorted.filter((m) => m.id !== hero.id),
      ].slice(0, CAROUSEL_SIZE)
    : sorted.slice(0, CAROUSEL_SIZE);

  if (!hero || carouselMovies.length === 0) return null;

  const items: MediaItem[] = carouselMovies.map((m) => ({
    kind: mediaType,
    id: m.id,
    title: itemTitle(m),
    poster_path: m.poster_path,
    vote_average: m.vote_average,
    popularity: m.popularity,
  }));

  const backdropSrc = hero.backdrop_path ? tmdbImage(hero.backdrop_path, 'w1280') : '';
  const heroYear = formatYear(itemDate(hero));
  const heroRating = hero.vote_average > 0 ? hero.vote_average.toFixed(1) : null;
  const rtScore = hero.vote_average > 0 ? voteToRtPercent(hero.vote_average) : null;
  const rtFresh = rtScore !== null && rtScore >= 60;

  return (
    <section className="relative">
      <div className="relative h-[340px] sm:h-[560px] overflow-hidden">
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to right, #070b08 0%, #070b08 28%, ${brandColor}30 58%, ${brandColor}55 100%)`,
          }}
        />

        {backdropSrc && (
          <ParallaxBackdrop
            src={backdropSrc}
            wrapperClassName="absolute inset-y-0 right-0 w-3/5 sm:w-[62%] pointer-events-none sm:translate-x-32"
            imageClassName="object-cover object-top sm:object-contain sm:object-right-bottom"
          />
        )}

        <div className="absolute inset-x-0 top-0 h-1/5 bg-gradient-to-b from-[#070b08] to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#070b08] via-[#070b08]/60 to-transparent" />

        <div className="absolute left-6 sm:left-12 top-[41%] -translate-y-1/2 z-20">
          <ParallaxMeta>
            <div className="flex flex-col items-start gap-3 sm:gap-4">
              <p className="font-chesna-grotesk text-2xl sm:text-4xl font-light uppercase tracking-[0.2em] text-white [text-shadow:0_0_8px_rgba(255,255,255,0.15)]">
                {label}
              </p>

              <p
                className="text-base sm:text-3xl font-itc-pioneer leading-tight max-w-[180px] sm:max-w-[340px]"
                style={{ color: 'black', WebkitTextStroke: `1px ${brandColor}` }}
              >
                {itemTitle(hero)}
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
                  {mediaType === 'series' ? 'Series' : 'Movie'}
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
                  {label}
                </span>
                {heroYear && (
                  <span
                    className="text-white/70 font-medium"
                    style={{
                      fontSize: 11,
                      border: '1px solid rgba(255,255,255,0.35)',
                      borderRadius: 20,
                      padding: '2px 10px',
                    }}
                  >
                    {heroYear}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <span className="text-white/70 font-medium" style={{ fontSize: 11 }}>
                  HD
                </span>
                {heroRating && (
                  <span className="text-white/70 font-medium" style={{ fontSize: 11 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="inline-block mr-0.5 -mt-0.5">
                      <polygon points="12,2 15,10 24,10 17,16 19,24 12,19 5,24 7,16 0,10 9,10" />
                    </svg>
                    {heroRating}
                  </span>
                )}
                {rtScore !== null && (
                  <span
                    className="inline-flex items-center gap-1 font-medium"
                    style={{ fontSize: 11, color: rtFresh ? '#86efac' : '#fca5a5' }}
                  >
                    <Image
                      src="/fresh-tomato-logo.png"
                      alt="Rotten Tomatoes"
                      width={13}
                      height={13}
                      className="inline object-contain"
                    />
                    {rtScore}%
                  </span>
                )}
              </div>

              {hero.overview && (
                <p
                  className="hero-desc text-white/60 text-sm leading-snug max-w-[400px]"
                  style={{
                    display: 'none',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {hero.overview}
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
                  href={`/${mediaType === 'series' ? 'series' : 'movie'}/${hero.id}`}
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

      <ParallaxCarousel className="-mt-16 sm:-mt-20 relative z-30 flex gap-1.5 px-5 sm:px-10 2xl:px-16 3xl:px-24 overflow-x-auto no-scrollbar pb-4 sm:pb-6 pt-8 sm:pt-10">
        {items.map((item, i) => (
          <ProviderCard key={`${item.kind}-${item.id}`} item={item} rank={i + 1} prefetch={i < 3} />
        ))}
      </ParallaxCarousel>
    </section>
  );
}
