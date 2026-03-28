import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const apiKey = process.env.TMDB_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: 'TMDB API key not configured', code: 500 },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(request.url);
  const tmdbUrl = new URL(`https://api.themoviedb.org/3/${path.join('/')}`);
  tmdbUrl.searchParams.set('api_key', apiKey);

  for (const [key, value] of searchParams.entries()) {
    tmdbUrl.searchParams.set(key, value);
  }

  const res = await fetch(tmdbUrl.toString(), { next: { revalidate: 3600 } });

  if (!res.ok) {
    return NextResponse.json(
      { ok: false, error: `TMDB error ${res.status}`, code: res.status },
      { status: res.status },
    );
  }

  const data: unknown = await res.json();
  return NextResponse.json(
    { ok: true, data },
    { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' } },
  );
}
