/**
 * Server-only TMDB API helpers.
 * Never import this file from client components.
 */
import type {
  TMDBCredits,
  TMDBListResult,
  TMDBMovie,
  TMDBMovieDetail,
  TMDBPerson,
  TMDBPersonMovieCredits,
  TMDBVideosResult,
} from '@/types/tmdb';

const TMDB_BASE = 'https://api.themoviedb.org/3';

async function tmdbFetch<T>(
  endpoint: string,
  params?: Record<string, string>,
  revalidate = 3600,
): Promise<T> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) throw new Error('TMDB_API_KEY environment variable is not set');

  const url = new URL(`${TMDB_BASE}${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), { next: { revalidate } });
  if (!res.ok) throw new Error(`TMDB ${res.status}: ${endpoint}`);
  return res.json() as Promise<T>;
}

export async function getTrendingMovies(): Promise<TMDBMovie[]> {
  const data = await tmdbFetch<TMDBListResult<TMDBMovie>>('/trending/movie/week');
  return data.results;
}

export async function getPopularMovies(page = 1): Promise<TMDBListResult<TMDBMovie>> {
  return tmdbFetch<TMDBListResult<TMDBMovie>>('/movie/popular', { page: String(page) });
}

export async function getNowPlayingMovies(): Promise<TMDBMovie[]> {
  const data = await tmdbFetch<TMDBListResult<TMDBMovie>>('/movie/now_playing');
  return data.results;
}

export async function getTopRatedMovies(): Promise<TMDBMovie[]> {
  const data = await tmdbFetch<TMDBListResult<TMDBMovie>>('/movie/top_rated');
  return data.results;
}

export async function getMovieDetail(id: number): Promise<TMDBMovieDetail> {
  return tmdbFetch<TMDBMovieDetail>(`/movie/${id}`);
}

export async function getMovieCredits(id: number): Promise<TMDBCredits> {
  return tmdbFetch<TMDBCredits>(`/movie/${id}/credits`);
}

export async function getMovieVideos(id: number): Promise<TMDBVideosResult> {
  return tmdbFetch<TMDBVideosResult>(`/movie/${id}/videos`);
}

export async function getMovieRecommendations(id: number): Promise<TMDBMovie[]> {
  const data = await tmdbFetch<TMDBListResult<TMDBMovie>>(`/movie/${id}/recommendations`);
  return data.results;
}

export async function getPerson(id: number): Promise<TMDBPerson> {
  return tmdbFetch<TMDBPerson>(`/person/${id}`);
}

export async function getPersonMovieCredits(id: number): Promise<TMDBPersonMovieCredits> {
  return tmdbFetch<TMDBPersonMovieCredits>(`/person/${id}/movie_credits`);
}

export async function getMoviesByGenre(genreId: number, page = 1): Promise<TMDBMovie[]> {
  const data = await tmdbFetch<TMDBListResult<TMDBMovie>>('/discover/movie', {
    with_genres: String(genreId),
    sort_by: 'popularity.desc',
    page: String(page),
  });
  return data.results;
}

export async function searchMovies(query: string, page = 1): Promise<TMDBListResult<TMDBMovie>> {
  return tmdbFetch<TMDBListResult<TMDBMovie>>('/search/movie', {
    query,
    page: String(page),
  });
}
