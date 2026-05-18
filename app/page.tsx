import { Banner } from '@/components/banner';
import { ContinueWatchingCarousel } from '@/components/continue-watching-carousel';
import { HeroSection } from '@/components/hero-section';
import { ProviderSection } from '@/components/provider-section';
import { Topbar } from '@/components/topbar';
import { APP_NAME } from '@/lib/config';
import { getMoviesByProvider, getSeriesByProvider } from '@/lib/tmdb';
import { PREFERRED_PROVIDERS } from '@/lib/watch-providers';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';

export const runtime = 'edge';

export const metadata: Metadata = {
  title: `${APP_NAME} — Stream Movies Instantly`,
};

export default async function HomePage() {
  const cookieStore = await cookies();
  const hasHistory = cookieStore.has('hwh');

  const providersWithData = await Promise.all(
    PREFERRED_PROVIDERS.map(async (p) => {
      const [movies, series] = await Promise.all([
        getMoviesByProvider(p.tmdbId),
        getSeriesByProvider(p.tmdbId),
      ]);
      return { provider: p, movies, series };
    }),
  );

  return (
    <>
      <Topbar />

      <div>
        <HeroSection />

        <ContinueWatchingCarousel hasHistory={hasHistory} />

        <div className="mt-6 flex flex-col">
          {providersWithData.map(({ provider, movies, series }) => (
            <ProviderSection
              key={provider.key}
              providerKey={provider.key}
              label={provider.label}
              assetPath={provider.assetPath}
              brandColor={provider.brandColor}
              movies={movies}
              series={series}
            />
          ))}
        </div>

        <Banner />
      </div>
    </>
  );
}
