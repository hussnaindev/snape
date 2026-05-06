export function getMovieEmbedUrl(tmdbId: number): string {
  return `/api/embed/movie/${tmdbId}`;
}

export function getSeriesEmbedUrl(tmdbId: number, season: number, episode: number): string {
  return `/api/embed/series/${tmdbId}/${season}/${episode}`;
}

export function getMovieStreamUrl(tmdbId: number): string {
  return `/api/stream/movie/${tmdbId}`;
}

export function getSeriesStreamUrl(tmdbId: number, season: number, episode: number): string {
  return `/api/stream/series/${tmdbId}/${season}/${episode}`;
}
