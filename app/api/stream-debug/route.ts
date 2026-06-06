import { NextResponse } from 'next/server';

import { PEACHIFY_REFERER, PEACHIFY_UA } from '@/lib/peachify-config';

export const runtime = 'edge';

// TEMPORARY diagnostic: hit one source API from the edge and report exactly
// what comes back, so we can tell header-stripping from IP-blocking. Remove
// once the prod extraction issue is resolved.
export async function GET() {
  const url = 'https://usa.eat-peach.sbs/multi/movie/1439930';

  const attempts: Record<string, unknown> = {};

  const tryFetch = async (label: string, headers: Record<string, string>) => {
    try {
      const res = await fetch(url, { headers });
      const text = await res.text();
      attempts[label] = {
        status: res.status,
        ok: res.ok,
        len: text.length,
        snippet: text.slice(0, 120),
      };
    } catch (e) {
      attempts[label] = { error: e instanceof Error ? e.message : String(e) };
    }
  };

  await tryFetch('source:usa.eat-peach', {
    Referer: PEACHIFY_REFERER,
    'User-Agent': PEACHIFY_UA,
  });

  // Are the media CDNs reachable from the CF edge, or also IP-blocked?
  const tryHost = async (label: string, hostUrl: string) => {
    try {
      const res = await fetch(hostUrl, { headers: { 'User-Agent': PEACHIFY_UA } });
      const text = await res.text();
      attempts[label] = { status: res.status, len: text.length, snippet: text.slice(0, 80) };
    } catch (e) {
      attempts[label] = { error: e instanceof Error ? e.message : String(e) };
    }
  };
  await tryHost('media:hakunaymatata', 'https://bcdnxw.hakunaymatata.com/');
  await tryHost('media:goodstream', 'https://goodstream.cc/');
  await tryHost('media:workers.dev', 'https://jolly-sun-08b9.sdfsaefwqa.workers.dev/');

  return NextResponse.json({ ok: true, attempts });
}
