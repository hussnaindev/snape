export function getMovieEmbedUrl(tmdbId: number): string {
  return `/api/embed/movie/${tmdbId}`;
}
