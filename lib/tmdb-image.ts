const IMAGE_BASE = 'https://image.tmdb.org/t/p';

/**
 * Build a full TMDB image URL. Safe to call on server and client.
 * Returns empty string when path is null (no image available).
 */
export function tmdbImage(path: string | null, size = 'w500'): string {
  if (!path) return '';
  return `${IMAGE_BASE}/${size}${path}`;
}
