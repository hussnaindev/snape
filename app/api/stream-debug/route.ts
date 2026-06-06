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

  await tryFetch('referer+origin+ua', {
    Referer: PEACHIFY_REFERER,
    Origin: PEACHIFY_REFERER.replace(/\/$/, ''),
    'User-Agent': PEACHIFY_UA,
  });
  await tryFetch('referer-only', { Referer: PEACHIFY_REFERER });
  await tryFetch('origin-only', { Origin: PEACHIFY_REFERER.replace(/\/$/, '') });
  await tryFetch('no-headers', {});

  return NextResponse.json({ ok: true, attempts });
}
