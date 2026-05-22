import { searchCollections } from '@/lib/tmdb';
import { NextResponse } from 'next/server';

export const runtime = 'edge';

const MAX_PAGE = 500;

function parsePositivePageParam(raw: string | null): number {
  const n = Number(raw ?? '');
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(Math.floor(n), MAX_PAGE);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();
  const page = parsePositivePageParam(searchParams.get('page'));
  const includeAdult = searchParams.get('adult') === 'true';

  if (!q) {
    return NextResponse.json({ ok: false, error: 'Missing q' }, { status: 400 });
  }

  try {
    const results = await searchCollections(q, includeAdult);
    return NextResponse.json({
      ok: true,
      page: 1,
      total_pages: 1,
      total_results: results.length,
      results: results.slice(0, 20),
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'TMDB request failed' }, { status: 502 });
  }
}
