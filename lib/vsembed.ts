const BASE = 'https://vidsrc-embed.ru';

export function getMovieEmbedUrl(tmdbId: number): string {
  return `${BASE}/embed/movie?tmdb=${tmdbId}`;
}
