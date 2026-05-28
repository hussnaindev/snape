/**
 * Server-only TMDB API helpers.
 * Never import this file from client components.
 */
import type {
  TMDBCollection,
  TMDBCollectionSearchHit,
  TMDBCredits,
  TMDBListResult,
  TMDBMovie,
  TMDBMovieDetail,
  TMDBPerson,
  TMDBPersonMovieCredits,
  TMDBPersonSearchHit,
  TMDBPersonSeriesCredits,
  TMDBSeason,
  TMDBSeries,
  TMDBSeriesDetail,
  TMDBVideosResult,
  TMDBWatchProvidersResult,
} from '@/types/tmdb';
import type { CuratedProviderKey } from '@/lib/curated-providers';
import {
  filterReleasedSearchMovies,
  filterReleasedSearchSeries,
} from '@/lib/search-release-filter';

const TMDB_BASE = 'https://api.themoviedb.org/3';

/** ISO date (YYYY-MM-DD) for today in UTC. */
function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Cached per UTC day — search runs filter on every result set; avoids repeated Date work. */
let cachedSearchReleaseCutoff = '';
let cachedSearchReleaseCutoffDay = -1;

function searchReleaseCutoff(): string {
  const day = Math.floor(Date.now() / 86_400_000);
  if (day !== cachedSearchReleaseCutoffDay) {
    cachedSearchReleaseCutoffDay = day;
    cachedSearchReleaseCutoff = todayIsoDate();
  }
  return cachedSearchReleaseCutoff;
}

/** TMDB discover/movie — only titles whose primary release is on or before today. */
function releasedMovieDiscoverParams(params: Record<string, string> = {}): Record<string, string> {
  return {
    'primary_release_date.lte': todayIsoDate(),
    ...params,
  };
}

/** TMDB discover/tv — only shows that have aired on or before today. */
function releasedTvDiscoverParams(params: Record<string, string> = {}): Record<string, string> {
  return {
    'first_air_date.lte': todayIsoDate(),
    include_null_first_air_dates: 'false',
    ...params,
  };
}

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

/** Uses discover + release-date filters when genre IDs are available (recommendations endpoint has no date filter). */
export async function getMovieRecommendations(id: number, genreIds: number[] = []): Promise<TMDBMovie[]> {
  if (genreIds.length > 0) {
    const data = await tmdbFetch<TMDBListResult<TMDBMovie>>(
      '/discover/movie',
      releasedMovieDiscoverParams({
        with_genres: genreIds.slice(0, 5).join('|'),
        sort_by: 'popularity.desc',
      }),
    );
    return data.results.filter((m) => m.id !== id).slice(0, 20);
  }
  const data = await tmdbFetch<TMDBListResult<TMDBMovie>>(`/movie/${id}/recommendations`);
  return data.results;
}

export async function getMovieWatchProviders(id: number): Promise<TMDBWatchProvidersResult> {
  return tmdbFetch<TMDBWatchProvidersResult>(`/movie/${id}/watch/providers`, undefined, 86400);
}

export async function getPerson(id: number): Promise<TMDBPerson> {
  return tmdbFetch<TMDBPerson>(`/person/${id}`);
}

export async function getPersonMovieCredits(id: number): Promise<TMDBPersonMovieCredits> {
  return tmdbFetch<TMDBPersonMovieCredits>(`/person/${id}/movie_credits`);
}

export async function getPersonSeriesCredits(id: number): Promise<TMDBPersonSeriesCredits> {
  return tmdbFetch<TMDBPersonSeriesCredits>(`/person/${id}/tv_credits`);
}

export async function getMoviesByGenre(
  genreId: number,
  page = 1,
): Promise<TMDBListResult<TMDBMovie>> {
  return tmdbFetch<TMDBListResult<TMDBMovie>>(
    '/discover/movie',
    releasedMovieDiscoverParams({
      with_genres: String(genreId),
      sort_by: 'popularity.desc',
      page: String(page),
    }),
  );
}

export async function getMoviesByProvider(providerId: number, region = 'US'): Promise<TMDBMovie[]> {
  const data = await tmdbFetch<TMDBListResult<TMDBMovie>>(
    '/discover/movie',
    releasedMovieDiscoverParams({
      with_watch_providers: String(providerId),
      watch_region: region,
      sort_by: 'popularity.desc',
    }),
  );
  return data.results;
}

export async function getSeriesByProvider(providerId: number, region = 'US'): Promise<TMDBSeries[]> {
  const data = await tmdbFetch<TMDBListResult<TMDBSeries>>(
    '/discover/tv',
    releasedTvDiscoverParams({
      with_watch_providers: String(providerId),
      watch_region: region,
      sort_by: 'popularity.desc',
    }),
  );
  return data.results;
}

export async function getBollywoodMovies(page = 1): Promise<TMDBMovie[]> {
  const data = await tmdbFetch<TMDBListResult<TMDBMovie>>(
    '/discover/movie',
    releasedMovieDiscoverParams({
      with_original_language: 'hi',
      sort_by: 'popularity.desc',
      page: String(page),
    }),
  );
  return data.results;
}

export async function getPunjabiMovies(page = 1): Promise<TMDBMovie[]> {
  const data = await tmdbFetch<TMDBListResult<TMDBMovie>>(
    '/discover/movie',
    releasedMovieDiscoverParams({
      with_original_language: 'pa',
      sort_by: 'popularity.desc',
      page: String(page),
    }),
  );
  return data.results;
}

export async function getTamilMovies(page = 1): Promise<TMDBMovie[]> {
  const data = await tmdbFetch<TMDBListResult<TMDBMovie>>(
    '/discover/movie',
    releasedMovieDiscoverParams({
      with_original_language: 'ta',
      sort_by: 'popularity.desc',
      page: String(page),
    }),
  );
  return data.results;
}

export async function getKoreanSeries(page = 1): Promise<TMDBSeries[]> {
  const data = await tmdbFetch<TMDBListResult<TMDBSeries>>(
    '/discover/tv',
    releasedTvDiscoverParams({
      with_original_language: 'ko',
      sort_by: 'popularity.desc',
      page: String(page),
    }),
  );
  return data.results;
}

export async function getTurkishSeries(page = 1): Promise<TMDBSeries[]> {
  const data = await tmdbFetch<TMDBListResult<TMDBSeries>>(
    '/discover/tv',
    releasedTvDiscoverParams({
      with_original_language: 'tr',
      sort_by: 'popularity.desc',
      page: String(page),
    }),
  );
  return data.results;
}

export async function getAnimationMovies(page = 1): Promise<TMDBMovie[]> {
  const data = await tmdbFetch<TMDBListResult<TMDBMovie>>(
    '/discover/movie',
    releasedMovieDiscoverParams({
      with_genres: '16',
      sort_by: 'popularity.desc',
      page: String(page),
    }),
  );
  return data.results;
}

/** Animation genre (16) + Japanese — trending anime films. */
export async function getAnimeMovies(page = 1): Promise<TMDBMovie[]> {
  const data = await tmdbFetch<TMDBListResult<TMDBMovie>>(
    '/discover/movie',
    releasedMovieDiscoverParams({
      with_genres: '16',
      with_original_language: 'ja',
      sort_by: 'popularity.desc',
      page: String(page),
    }),
  );
  return data.results;
}

export async function getHollywoodMovies(page = 1): Promise<TMDBMovie[]> {
  const data = await tmdbFetch<TMDBListResult<TMDBMovie>>(
    '/discover/movie',
    releasedMovieDiscoverParams({
      with_original_language: 'en',
      with_origin_country: 'US',
      sort_by: 'popularity.desc',
      page: String(page),
    }),
  );
  return data.results;
}

const CURATED_FETCHERS: Record<
  CuratedProviderKey,
  (page?: number) => Promise<TMDBMovie[] | TMDBSeries[]>
> = {
  hollywood: getHollywoodMovies,
  bollywood: getBollywoodMovies,
  punjabi: getPunjabiMovies,
  tamil: getTamilMovies,
  korean: getKoreanSeries,
  turkish: getTurkishSeries,
  animation: getAnimationMovies,
  anime: getAnimeMovies,
};

export async function getCuratedProviderMovies(key: CuratedProviderKey, page = 1): Promise<TMDBMovie[] | TMDBSeries[]> {
  return CURATED_FETCHERS[key](page);
}

/** Alternate query strings to try when the exact title yields no TMDB hits (typos, extra words). */
function buildSearchQueryVariants(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const seen = new Set<string>();
  const variants: string[] = [];
  const add = (s: string) => {
    const t = s.trim();
    if (t.length < 2) return;
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    variants.push(t);
  };

  add(trimmed);

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    add(words.slice(0, -1).join(' '));
    const longest = words.reduce((a, b) => (a.length >= b.length ? a : b), '');
    if (longest.length > 3) add(longest);
    const firstWord = words[0];
    if (firstWord !== undefined) add(firstWord);
  }

  if (trimmed.length > 3) add(trimmed.slice(0, -1));
  if (trimmed.length > 4) add(trimmed.slice(0, -2));

  return variants;
}

async function searchTmdbListWithFallback<T>(endpoint: string, query: string, includeAdult = false): Promise<T[]> {
  for (const q of buildSearchQueryVariants(query)) {
    const data = await tmdbFetch<TMDBListResult<T>>(endpoint, { query: q, page: '1', include_adult: String(includeAdult) }, 600);
    if (data.results.length > 0) return data.results;
  }
  return [];
}

export type SearchPagedResult<T> = TMDBListResult<T> & { resolvedQuery: string | null };

export async function searchMovies(
  query: string,
  page = 1,
  resolvedQuery?: string,
  includeAdult = false,
): Promise<SearchPagedResult<TMDBMovie>> {
  if (resolvedQuery) {
    const data = await tmdbFetch<TMDBListResult<TMDBMovie>>(
      '/search/movie',
      { query: resolvedQuery, page: String(page), include_adult: String(includeAdult) },
      600,
    );
    data.results = filterReleasedSearchMovies(data.results, searchReleaseCutoff());
    return { ...data, resolvedQuery };
  }
  if (page !== 1) {
    throw new Error('searchMovies: resolvedQuery is required when page > 1');
  }
  for (const variant of buildSearchQueryVariants(query)) {
    const data = await tmdbFetch<TMDBListResult<TMDBMovie>>(
      '/search/movie',
      { query: variant, page: '1', include_adult: String(includeAdult) },
      600,
    );
    data.results = filterReleasedSearchMovies(data.results, searchReleaseCutoff());
    if (data.results.length > 0) {
      return { ...data, resolvedQuery: variant };
    }
  }
  return { page: 1, results: [], total_pages: 0, total_results: 0, resolvedQuery: null };
}

export async function searchTvShows(
  query: string,
  page = 1,
  resolvedQuery?: string,
  includeAdult = false,
): Promise<SearchPagedResult<TMDBSeries>> {
  if (resolvedQuery) {
    const data = await tmdbFetch<TMDBListResult<TMDBSeries>>(
      '/search/tv',
      { query: resolvedQuery, page: String(page), include_adult: String(includeAdult) },
      600,
    );
    data.results = filterReleasedSearchSeries(data.results, searchReleaseCutoff());
    return { ...data, resolvedQuery };
  }
  if (page !== 1) {
    throw new Error('searchTvShows: resolvedQuery is required when page > 1');
  }
  for (const variant of buildSearchQueryVariants(query)) {
    const data = await tmdbFetch<TMDBListResult<TMDBSeries>>(
      '/search/tv',
      { query: variant, page: '1', include_adult: String(includeAdult) },
      600,
    );
    data.results = filterReleasedSearchSeries(data.results, searchReleaseCutoff());
    if (data.results.length > 0) {
      return { ...data, resolvedQuery: variant };
    }
  }
  return { page: 1, results: [], total_pages: 0, total_results: 0, resolvedQuery: null };
}

export async function searchPeople(query: string, includeAdult = false): Promise<TMDBPersonSearchHit[]> {
  return searchTmdbListWithFallback<TMDBPersonSearchHit>('/search/person', query, includeAdult);
}

// ── TV Series ────────────────────────────────────────────────────────────────

export async function getTrendingSeries(): Promise<TMDBSeries[]> {
  const data = await tmdbFetch<TMDBListResult<TMDBSeries>>('/trending/tv/week');
  return data.results;
}

export async function getPopularSeries(page = 1): Promise<TMDBListResult<TMDBSeries>> {
  return tmdbFetch<TMDBListResult<TMDBSeries>>('/tv/popular', { page: String(page) });
}

export async function getTopRatedSeries(): Promise<TMDBSeries[]> {
  const data = await tmdbFetch<TMDBListResult<TMDBSeries>>('/tv/top_rated');
  return data.results;
}

export async function getSeriesByGenre(genreId: number, page = 1): Promise<TMDBSeries[]> {
  const data = await tmdbFetch<TMDBListResult<TMDBSeries>>(
    '/discover/tv',
    releasedTvDiscoverParams({
      with_genres: String(genreId),
      sort_by: 'popularity.desc',
      page: String(page),
    }),
  );
  return data.results;
}

export async function getSeriesDetail(id: number): Promise<TMDBSeriesDetail> {
  return tmdbFetch<TMDBSeriesDetail>(`/tv/${id}`);
}

export async function getSeriesCredits(id: number): Promise<TMDBCredits> {
  return tmdbFetch<TMDBCredits>(`/tv/${id}/credits`);
}

export async function getSeriesVideos(id: number): Promise<TMDBVideosResult> {
  return tmdbFetch<TMDBVideosResult>(`/tv/${id}/videos`);
}

/** Uses discover + air-date filters when genre IDs are available (recommendations endpoint has no date filter). */
export async function getSeriesRecommendations(id: number, genreIds: number[] = []): Promise<TMDBSeries[]> {
  if (genreIds.length > 0) {
    const data = await tmdbFetch<TMDBListResult<TMDBSeries>>(
      '/discover/tv',
      releasedTvDiscoverParams({
        with_genres: genreIds.slice(0, 5).join('|'),
        sort_by: 'popularity.desc',
      }),
    );
    return data.results.filter((s) => s.id !== id).slice(0, 20);
  }
  const data = await tmdbFetch<TMDBListResult<TMDBSeries>>(`/tv/${id}/recommendations`);
  return data.results;
}

export async function getSeriesWatchProviders(id: number): Promise<TMDBWatchProvidersResult> {
  return tmdbFetch<TMDBWatchProvidersResult>(`/tv/${id}/watch/providers`, undefined, 86400);
}

export async function getSeriesSeason(seriesId: number, seasonNumber: number): Promise<TMDBSeason> {
  return tmdbFetch<TMDBSeason>(`/tv/${seriesId}/season/${seasonNumber}`);
}

/** Returns the YouTube key of the first embeddable trailer/teaser, or null. */
export async function getEmbeddableTrailerKey(videos: TMDBVideosResult): Promise<string | null> {
  const candidates = videos.results.filter(
    (v) => v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser'),
  );
  candidates.sort((a, b) => {
    if (a.official !== b.official) return a.official ? -1 : 1;
    if (a.type !== b.type) return a.type === 'Trailer' ? -1 : 1;
    return 0;
  });

  for (const v of candidates) {
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${v.key}&format=json`,
        { next: { revalidate: 86400 } },
      );
      if (res.ok) return v.key;
    } catch {
      // network error, skip
    }
  }
  return null;
}

// ── Collections ─────────────────────────────────────────────────────────

export async function getCollection(id: number): Promise<TMDBCollection> {
  return tmdbFetch<TMDBCollection>(`/collection/${id}`);
}

export async function searchCollections(query: string, includeAdult = false): Promise<TMDBCollectionSearchHit[]> {
  return searchTmdbListWithFallback<TMDBCollectionSearchHit>('/search/collection', query, includeAdult);
}
