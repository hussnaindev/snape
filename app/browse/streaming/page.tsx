import { Banner } from '@/components/banner';
import { ProviderSection } from '@/components/provider-section';
import { APP_NAME } from '@/lib/config';
import { getMoviesByProvider, getSeriesByProvider } from '@/lib/tmdb';
import { PREFERRED_PROVIDERS } from '@/lib/watch-providers';
import type { Metadata } from 'next';

export const runtime = 'edge';

export const metadata: Metadata = {
  title: `${APP_NAME} — Streaming Providers`,
};

export default async function StreamingProvidersPage() {
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

      <div style={{ overflowX: 'clip' }} className="pt-16">
        <div className="flex flex-col">
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
