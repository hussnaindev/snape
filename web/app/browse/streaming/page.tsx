import { Banner } from '@/components/banner';
import {
  PROVIDER_HERO_ID,
  PROVIDER_HERO_TYPE,
  ProviderSection,
} from '@/components/provider-section';
import { APP_NAME } from '@/lib/config';
import {
  getMovieImages,
  getMoviesByProvider,
  getSeriesByProvider,
  getSeriesImages,
} from '@/lib/tmdb';
import { tmdbImage } from '@/lib/tmdb-image';
import { PREFERRED_PROVIDERS } from '@/lib/watch-providers';
import type { Metadata } from 'next';

export const runtime = 'edge';

export const metadata: Metadata = {
  title: `${APP_NAME} — Streaming Providers`,
};

function extractLogoUrl(images: { logos: { iso_639_1: string | null; file_path: string }[] }):
  | string
  | null {
  const path =
    images.logos.find((l) => l.iso_639_1 === 'en')?.file_path ?? images.logos[0]?.file_path ?? null;
  return path ? tmdbImage(path, 'w500') : null;
}

export default async function StreamingProvidersPage() {
  const providersWithData = await Promise.all(
    PREFERRED_PROVIDERS.map(async (p) => {
      const [movies, series] = await Promise.all([
        getMoviesByProvider(p.tmdbId).catch(() => []),
        getSeriesByProvider(p.tmdbId).catch(() => []),
      ]);
      return { provider: p, movies, series };
    }),
  );

  const providerLogoUrls = await Promise.all(
    providersWithData.map(async ({ provider }) => {
      const heroId = PROVIDER_HERO_ID[provider.key];
      const heroType = PROVIDER_HERO_TYPE[provider.key];
      const images =
        heroType === 'Series'
          ? await getSeriesImages(heroId).catch(() => null)
          : await getMovieImages(heroId).catch(() => null);
      return images ? extractLogoUrl(images) : null;
    }),
  );

  const logoUrlByKey = Object.fromEntries(
    PREFERRED_PROVIDERS.map((p, i) => [p.key, providerLogoUrls[i]]),
  ) as Record<string, string | null>;

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
              logoUrl={logoUrlByKey[provider.key]}
            />
          ))}
        </div>

        <Banner />
      </div>
    </>
  );
}
