export type CuratedProviderKey =
  | 'hollywood'
  | 'bollywood'
  | 'punjabi'
  | 'tamil'
  | 'animation'
  | 'anime';

export const CURATED_PROVIDERS: ReadonlyArray<{
  key: CuratedProviderKey;
  label: string;
  brandColor: string;
}> = [
  { key: 'hollywood', label: 'Hollywood', brandColor: '#DC2626' },
  { key: 'bollywood', label: 'Bollywood', brandColor: '#F97316' },
  { key: 'punjabi', label: 'Punjabi', brandColor: '#EAB308' },
  { key: 'tamil', label: 'Tamil', brandColor: '#0D9488' },
  { key: 'animation', label: 'Animation', brandColor: '#3B82F6' },
  { key: 'anime', label: 'Anime', brandColor: '#A855F7' },
] as const;

export function curatedProviderMeta(key: CuratedProviderKey): { label: string; brandColor: string } {
  const meta = CURATED_PROVIDERS.find((p) => p.key === key);
  if (!meta) return { label: key, brandColor: '#ffffff' };
  return { label: meta.label, brandColor: meta.brandColor };
}
