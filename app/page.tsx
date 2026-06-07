import { Banner } from '@/components/banner';
import { ContinueWatchingCarousel } from '@/components/continue-watching-carousel';
import { CuratedProviderSection } from '@/components/curated-provider-section';
import { HeroSection } from '@/components/hero-section';
import { DeferredCuratedSections } from '@/components/deferred-curated-sections';
import { APP_NAME } from '@/lib/config';
import { CURATED_PROVIDERS } from '@/lib/curated-providers';
import { getCuratedProviderMovies } from '@/lib/tmdb';
import type { TMDBMovie, TMDBSeries } from '@/types/tmdb';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Suspense } from 'react';

export const runtime = 'edge';
export const revalidate = 3600;

/** Curated rows rendered in the initial SSR payload — rest load when scrolled near. */
const INITIAL_CURATED_COUNT = 4;

export const metadata: Metadata = {
  title: `${APP_NAME} — Stream Movies Instantly`,
};

export default async function HomePage() {
  const cookieStore = await cookies();
  const hasHistory = cookieStore.has('hwh');

  const initialProviders = CURATED_PROVIDERS.slice(0, INITIAL_CURATED_COUNT);
  const deferredKeys = CURATED_PROVIDERS.slice(INITIAL_CURATED_COUNT).map((p) => p.key);

  const curatedMovieLists = await Promise.all(
    initialProviders.map((c) => getCuratedProviderMovies(c.key)),
  );

  const curatedMoviesByKey = Object.fromEntries(
    initialProviders.map((c, i) => [c.key, curatedMovieLists[i]]),
  ) as Record<(typeof initialProviders)[number]['key'], (typeof curatedMovieLists)[number]>;

  return (
    <>
      <div style={{ overflowX: 'clip' }}>
        <HeroSection />

        <ContinueWatchingCarousel hasHistory={hasHistory} />

        <div className="flex flex-col">
          {initialProviders.map((curated) => (
            <CuratedProviderSection
              key={curated.key}
              providerKey={curated.key}
              label={curated.label}
              brandColor={curated.brandColor}
              mediaType={curated.mediaType}
              movies={curatedMoviesByKey[curated.key] as TMDBMovie[] | TMDBSeries[]}
            />
          ))}
          <Suspense fallback={null}>
            <DeferredCuratedSections providerKeys={deferredKeys} />
          </Suspense>
        </div>

        <Banner />
      </div>
    </>
  );
}
