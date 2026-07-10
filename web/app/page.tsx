import { Banner } from '@/components/banner';
import { ContinueWatchingCarousel } from '@/components/continue-watching-carousel';
import { CuratedProviderSection } from '@/components/curated-provider-section';
import { HeroSection } from '@/components/hero-section';
import { APP_NAME } from '@/lib/config';
import { CURATED_PROVIDERS } from '@/lib/curated-providers';
import { getCuratedProviderMovies, getMovieImages, getSeriesImages } from '@/lib/tmdb';
import { tmdbImage } from '@/lib/tmdb-image';
import type { TMDBMovie, TMDBSeries } from '@/types/tmdb';
import type { Metadata } from 'next';

// NOTE: intentionally NOT `runtime = 'edge'`. This page has no edge-only needs (no D1,
// no session) — only TMDB fetches. Without the edge runtime Next statically prerenders it
// to an HTML asset, so the TMDB fan-out below runs at BUILD time, never per request. That
// is what stops the homepage from exhausting the edge worker's CPU (Error 1102).
export const revalidate = 3600;

export const metadata: Metadata = {
  title: `${APP_NAME} — Stream Movies Instantly`,
};

function pickCuratedHero(movies: TMDBMovie[] | TMDBSeries[]) {
  const sorted = [...movies]
    .filter((m) => m.poster_path)
    .sort((a, b) => b.popularity - a.popularity);
  return (
    sorted.find((m) => m.backdrop_path) ??
    movies.find((m) => m.backdrop_path) ??
    sorted[0] ??
    movies[0]
  );
}

function extractLogoUrl(images: { logos: { iso_639_1: string | null; file_path: string }[] }):
  | string
  | null {
  const path =
    images.logos.find((l) => l.iso_639_1 === 'en')?.file_path ?? images.logos[0]?.file_path ?? null;
  return path ? tmdbImage(path, 'w500') : null;
}

export default async function HomePage() {
  // Guard each fetch: a single TMDB failure (e.g. a 429 under load) must degrade one
  // row, not reject the whole Promise.all and crash the render ("server-side exception").
  const curatedMovieLists = await Promise.all(
    CURATED_PROVIDERS.map((c) => getCuratedProviderMovies(c.key).catch(() => [])),
  );

  const curatedMoviesByKey = Object.fromEntries(
    CURATED_PROVIDERS.map((c, i) => [c.key, curatedMovieLists[i]]),
  ) as Record<(typeof CURATED_PROVIDERS)[number]['key'], (typeof curatedMovieLists)[number]>;

  const curatedLogoUrls = await Promise.all(
    CURATED_PROVIDERS.map(async (curated) => {
      const movies = curatedMoviesByKey[curated.key] as TMDBMovie[] | TMDBSeries[];
      if (!movies?.length) return null;
      const hero = pickCuratedHero(movies);
      if (!hero) return null;
      const images =
        curated.mediaType === 'series'
          ? await getSeriesImages(hero.id).catch(() => null)
          : await getMovieImages(hero.id).catch(() => null);
      return images ? extractLogoUrl(images) : null;
    }),
  );

  const curatedLogoByKey = Object.fromEntries(
    CURATED_PROVIDERS.map((c, i) => [c.key, curatedLogoUrls[i]]),
  ) as Record<(typeof CURATED_PROVIDERS)[number]['key'], string | null>;

  return (
    <>
      <div style={{ overflowX: 'clip' }}>
        <HeroSection />

        <ContinueWatchingCarousel />

        <div className="flex flex-col">
          {CURATED_PROVIDERS.map((curated) => (
            <CuratedProviderSection
              key={curated.key}
              providerKey={curated.key}
              label={curated.label}
              brandColor={curated.brandColor}
              mediaType={curated.mediaType}
              movies={curatedMoviesByKey[curated.key]}
              logoUrl={curatedLogoByKey[curated.key]}
            />
          ))}
        </div>

        <Banner />
      </div>
    </>
  );
}
