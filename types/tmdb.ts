export interface TMDBGenre {
  id: number;
  name: string;
}

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genre_ids: number[];
  popularity: number;
}

export interface TMDBMovieDetail {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  vote_count: number;
  genres: TMDBGenre[];
  runtime: number | null;
  tagline: string;
  imdb_id: string | null;
  status: string;
  budget: number;
  revenue: number;
  popularity: number;
}

export interface TMDBCastMember {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
  known_for_department: string;
}

export interface TMDBCrewMember {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TMDBCredits {
  cast: TMDBCastMember[];
  crew: TMDBCrewMember[];
}

export interface TMDBVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official: boolean;
  published_at: string;
}

export interface TMDBVideosResult {
  results: TMDBVideo[];
}

export interface TMDBPerson {
  id: number;
  name: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  profile_path: string | null;
  known_for_department: string;
  popularity: number;
  also_known_as: string[];
}

export interface TMDBPersonMovieCredit {
  id: number;
  title: string;
  character: string;
  poster_path: string | null;
  release_date: string;
  vote_average: number;
  popularity: number;
}

export interface TMDBPersonMovieCredits {
  cast: TMDBPersonMovieCredit[];
  crew: TMDBPersonMovieCredit[];
}

export interface TMDBListResult<T> {
  results: T[];
  page: number;
  total_pages: number;
  total_results: number;
}
