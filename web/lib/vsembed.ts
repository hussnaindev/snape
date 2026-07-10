export function getMovieEmbedUrl(tmdbId: number): string {
  return `https://peachify.top/embed/movie/${tmdbId}?accent=E50914&cast=hide`;
}

export function getSeriesEmbedUrl(tmdbId: number, season: number, episode: number): string {
  return `https://peachify.top/embed/tv/${tmdbId}/${season}/${episode}?accent=E50914&cast=hide`;
}