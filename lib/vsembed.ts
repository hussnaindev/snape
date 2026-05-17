export function getMovieEmbedUrl(tmdbId: number): string {
  // return `/api/embed/movie/${tmdbId}`;
  return `https://peachify.top/embed/movie/${tmdbId}`;
}

export function getSeriesEmbedUrl(tmdbId: number, season: number, episode: number): string {
  // return `/api/embed/series/${tmdbId}/${season}/${episode}`;
  return `https://peachify.top/embed/tv/${tmdbId}/${season}/${episode}`;
}