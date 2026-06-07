import { CuratedProviderSection } from '@/components/curated-provider-section';
import { CURATED_PROVIDERS, type CuratedProviderKey } from '@/lib/curated-providers';
import { getCuratedProviderMovies } from '@/lib/tmdb';
import type { TMDBMovie, TMDBSeries } from '@/types/tmdb';

interface Props {
  providerKeys: CuratedProviderKey[];
}

/** Below-the-fold curated rows — streamed in after the initial homepage shell. */
export async function DeferredCuratedSections({ providerKeys }: Props) {
  const providers = CURATED_PROVIDERS.filter((p) => providerKeys.includes(p.key));
  if (providers.length === 0) return null;

  const lists = await Promise.all(providers.map((p) => getCuratedProviderMovies(p.key)));

  return (
    <>
      {providers.map((curated, i) => (
        <CuratedProviderSection
          key={curated.key}
          providerKey={curated.key}
          label={curated.label}
          brandColor={curated.brandColor}
          mediaType={curated.mediaType}
          movies={lists[i] as TMDBMovie[] | TMDBSeries[]}
        />
      ))}
    </>
  );
}
