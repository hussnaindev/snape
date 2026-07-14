import { NextResponse } from 'next/server';

export const runtime = 'edge';

// Only these TMDB v3 top-level resources may be proxied. This stops the
// endpoint from being used as a general free TMDB-key proxy — it can only serve
// the read-only catalog data the app itself requests.
const ALLOWED_ROOTS = new Set([
  'movie',
  'tv',
  'collection',
  'trending',
  'person',
  'search',
  'discover',
  'genre',
]);

const forbidden = (error: string) =>
  NextResponse.json({ ok: false, error, code: 403 }, { status: 403 });

/**
 * Reject anything that isn't a same-origin browser request. The app only ever
 * calls this proxy via same-origin `fetch()`, so this blocks cross-site embeds
 * and header-less scrapers/bots hitting the endpoint directly for its (billable)
 * CF Function invocations and our TMDB key.
 */
function isSameOrigin(request: Request): boolean {
  // `Sec-Fetch-Site` is set by the browser and cannot be forged by page JS.
  const site = request.headers.get('sec-fetch-site');
  if (site) return site === 'same-origin' || site === 'same-site';

  // Non-browser client: fall back to Origin/Referer host matching. Absent both
  // (typical curl/bot) → reject.
  const host = request.headers.get('host');
  const source = request.headers.get('origin') ?? request.headers.get('referer');
  if (!host || !source) return false;
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  if (!isSameOrigin(request)) {
    return forbidden('Forbidden');
  }

  const { path } = await params;
  const root = path[0];
  if (!root || !ALLOWED_ROOTS.has(root)) {
    return forbidden('Unsupported TMDB resource');
  }

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
