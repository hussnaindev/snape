export type CuratedProviderKey =
  | 'hollywood'
  | 'bollywood'
  | 'punjabi'
  | 'tamil'
  | 'korean'
  | 'turkish'
  | 'animation'
  | 'anime';

export const CURATED_PROVIDERS: ReadonlyArray<{
  key: CuratedProviderKey;
  label: string;
  brandColor: string;
  mediaType: 'movie' | 'series';
}> = [
  { key: 'hollywood', label: 'Hollywood', brandColor: '#DC2626', mediaType: 'movie' },
  { key: 'bollywood', label: 'Bollywood', brandColor: '#F97316', mediaType: 'movie' },
  { key: 'punjabi', label: 'Punjabi', brandColor: '#EAB308', mediaType: 'movie' },
  { key: 'tamil', label: 'Tamil', brandColor: '#0D9488', mediaType: 'movie' },
  { key: 'korean', label: 'Korean', brandColor: '#EC4899', mediaType: 'series' },
  { key: 'turkish', label: 'Turkish', brandColor: '#F59E0B', mediaType: 'series' },
  { key: 'animation', label: 'Animation', brandColor: '#3B82F6', mediaType: 'movie' },
  { key: 'anime', label: 'Anime', brandColor: '#A855F7', mediaType: 'movie' },
] as const;

export function curatedProviderMeta(key: CuratedProviderKey): { label: string; brandColor: string } {
  const meta = CURATED_PROVIDERS.find((p) => p.key === key);
  if (!meta) return { label: key, brandColor: '#ffffff' };
  return { label: meta.label, brandColor: meta.brandColor };
}
