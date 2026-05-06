import { extractMovieStream } from '@/lib/stream-extractor';

export const runtime = 'edge';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movieId = Number(id);
  if (Number.isNaN(movieId)) {
    return Response.json({ ok: false, error: 'Invalid ID', code: 400 }, { status: 400 });
  }

  const result = await extractMovieStream(movieId);
  if (!result.ok) {
    return Response.json({ ok: false, error: result.error, code: 502 }, { status: 502 });
  }

  return Response.json(
    { ok: true, data: result },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600',
      },
    },
  );
}
