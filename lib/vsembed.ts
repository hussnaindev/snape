const PARAMS = 'accent=E50914&cast=hide';

export function getMovieEmbedUrl(tmdbId: number): string {
  return `/embed/movie/${tmdbId}?${PARAMS}`;
}

export function getSeriesEmbedUrl(tmdbId: number, season: number, episode: number): string {
  return `/embed/tv/${tmdbId}/${season}/${episode}?${PARAMS}`;
}
