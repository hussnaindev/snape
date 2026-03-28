import { MovieGrid } from '@/components/movie-grid';
import { Topbar } from '@/components/topbar';
import { searchMovies } from '@/lib/tmdb';
import { APP_NAME } from '@/lib/config';
import type { Metadata } from 'next';

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { q } = await searchParams;
  return { title: q ? `"${q}" — ${APP_NAME}` : `Search — ${APP_NAME}` };
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? '';

  const results = query ? await searchMovies(query).catch(() => ({ results: [] })) : { results: [] };

  return (
    <>
      <Topbar />
      <main className="pt-24 pb-16 px-4 md:px-8">
        {query ? (
          <>
            <h1 className="text-white text-xl font-semibold mb-6">
              {results.results.length > 0
                ? `Results for "${query}"`
                : `No results for "${query}"`}
            </h1>
            {results.results.length > 0 && <MovieGrid movies={results.results} />}
          </>
        ) : (
          <p className="text-white/50 text-sm">Enter a movie title to search.</p>
        )}
      </main>
    </>
  );
}
