export type MediaItem = {
  kind: 'movie' | 'series';
  id: number;
  title: string;
  poster_path: string | null;
  vote_average: number;
  popularity: number;
};
