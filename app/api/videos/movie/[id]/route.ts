import { getEmbeddableTrailerKey, getMovieVideos } from '@/lib/tmdb';

export const runtime = 'edge';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movieId = Number.parseInt(id, 10);

  if (!movieId) {
    return Response.json({ ok: false, error: 'Invalid movie ID', code: 400 }, { status: 400 });
  }

  try {
    const videos = await getMovieVideos(movieId);
    const trailerKey = await getEmbeddableTrailerKey(videos);
    return Response.json({ ok: true, data: { trailerKey } });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return Response.json({ ok: false, error: message, code: 500 }, { status: 500 });
  }
}
