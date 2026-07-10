const IMAGE_BASE = 'https://image.tmdb.org/t/p';

/**
 * Build a full TMDB image URL. Safe to call on server and client.
 * Returns empty string when path is null (no image available).
 */
export function tmdbImage(path: string | null, size = 'w500'): string {
  if (!path) return '';
  return `${IMAGE_BASE}/${size}${path}`;
}

/**
 * Returns mobile and desktop TMDB image URLs for responsive images.
 * Use with <picture> element: <source srcSet={desktop} media="(min-width: 1024px)" /> + <img src={mobile} />
 * Returns null when path is null.
 */
export function tmdbResponsive(
  path: string | null,
  mobileSize = 'w342',
  desktopSize = 'w500',
): { mobile: string; desktop: string } | null {
  if (!path) return null;
  return {
    mobile: tmdbImage(path, mobileSize),
    desktop: tmdbImage(path, desktopSize),
  };
}
