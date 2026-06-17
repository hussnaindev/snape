import type { TMDBWatchProvidersRegion, TMDBWatchProvider } from '@/types/tmdb';

export type PreferredProviderKey =
  | 'netflix'
  | 'primevideo'
  | 'paramountplus'
  | 'appletv'
  | 'max'
  | 'disneyplus';

export const PREFERRED_PROVIDERS: ReadonlyArray<{
  key: PreferredProviderKey;
  label: string;
  assetPath: string;
  tmdbId: number;
  brandColor: string;
}> = [
  {
    key: 'netflix',
    label: 'Netflix',
    assetPath: '/providers/netflix.svg',
    tmdbId: 8,
    brandColor: '#E50914',
  },
  {
    key: 'max',
    label: 'Max',
    assetPath: '/providers/max.svg',
    tmdbId: 1899,
    brandColor: '#8A2BE2',
  },
  {
    key: 'primevideo',
    label: 'Prime Video',
    assetPath: '/providers/primevideo.svg',
    tmdbId: 9,
    brandColor: '#00A8E0',
  },
  {
    key: 'disneyplus',
    label: 'Disney+',
    assetPath: '/providers/disneyplus.svg',
    tmdbId: 337,
    brandColor: '#166534',
  },
  {
    key: 'paramountplus',
    label: 'Paramount+',
    assetPath: '/providers/paramountplus.svg',
    tmdbId: 531,
    brandColor: '#CA8A04',
  },
  {
    key: 'appletv',
    label: 'Apple TV+',
    assetPath: '/providers/appletv.svg',
    tmdbId: 350,
    brandColor: '#6E6E73',
  },
] as const;

function normalizeProviderName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function keyFromProvider(p: TMDBWatchProvider): PreferredProviderKey | null {
  const n = normalizeProviderName(p.provider_name);
  if (n.includes('netflix')) return 'netflix';
  if (n.includes('prime video') || n.includes('amazon prime')) return 'primevideo';
  if (n.includes('paramount')) return 'paramountplus';
  if (n.includes('apple tv')) return 'appletv';
  // TMDB may report "HBO Max" or "Max"
  if (n === 'max' || n.includes('hbo max') || (n.includes('max') && !n.includes('imax')))
    return 'max';
  if (n.includes('disney')) return 'disneyplus';
  return null;
}

export function pickPreferredProviders(
  region: TMDBWatchProvidersRegion | null | undefined,
): PreferredProviderKey[] {
  if (!region) return [];
  const buckets = ['flatrate', 'free', 'ads', 'rent', 'buy'] as const;
  const found = new Set<PreferredProviderKey>();

  for (const bucket of buckets) {
    const list = region[bucket];
    if (!list) continue;
    for (const p of list) {
      const key = keyFromProvider(p);
      if (key) found.add(key);
    }
  }

  // Return in a fixed order so UI is consistent.
  const ordered = PREFERRED_PROVIDERS.filter((p) => found.has(p.key)).map((p) => p.key);

  // If multiple providers exist, always show Apple TV+ at the end.
  if (ordered.length > 1) {
    const i = ordered.indexOf('appletv');
    if (i !== -1) ordered.push(...ordered.splice(i, 1));
  }

  return ordered;
}

export function pickPreferredProvidersWithFallback(
  results: Record<string, TMDBWatchProvidersRegion | undefined> | null | undefined,
  country: string,
): PreferredProviderKey[] {
  if (!results) return [];

  const primary = pickPreferredProviders(results[country]);
  if (primary.length > 0) return primary;

  const us = pickPreferredProviders(results.US);
  if (us.length > 0) return us;

  for (const region of Object.values(results)) {
    const picked = pickPreferredProviders(region);
    if (picked.length > 0) return picked;
  }

  return [];
}

export function preferredProviderMeta(key: PreferredProviderKey): {
  label: string;
  assetPath: string;
} {
  const meta = PREFERRED_PROVIDERS.find((p) => p.key === key);
  if (!meta) return { label: key, assetPath: '' };
  return { label: meta.label, assetPath: meta.assetPath };
}
