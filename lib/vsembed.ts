export function getMovieEmbedUrl(tmdbId: number): string {
  return `/api/embed/movie/${tmdbId}`;
}

export function getSeriesEmbedUrl(tmdbId: number, season: number, episode: number): string {
  return `/api/embed/series/${tmdbId}/${season}/${episode}`;
}
