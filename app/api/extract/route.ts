import type { NextRequest } from 'next/server';

export const runtime = 'nodejs';

// Local dev extract — runs netlify/functions/extract.mjs in-process so `bun run dev`
// always uses the latest extraction logic (no stale Netlify dev server on :8899).
export async function GET(req: NextRequest) {
  const { default: extract } = await import('../../../netlify/functions/extract.mjs');
  const extractUrl = new URL('http://local/extract');
  extractUrl.search = req.nextUrl.search;
  return extract(new Request(extractUrl.toString()));
}
