const PEACHIFY = 'https://peachify.top';
const PARAMS = 'accent=E50914&cast=hide';

function proxied(path: string): string {
  const url = `${PEACHIFY}/embed/${path}?${PARAMS}`;
  return `/api/embed?url=${encodeURIComponent(url)}`;
}

export function getMovieEmbedUrl(tmdbId: number): string {
  return proxied(`movie/${tmdbId}`);
}

export function getSeriesEmbedUrl(tmdbId: number, season: number, episode: number): string {
  return proxied(`tv/${tmdbId}/${season}/${episode}`);
}
