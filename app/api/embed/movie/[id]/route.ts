import type { NextRequest } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const movieId = Number(id);
  if (Number.isNaN(movieId)) return errorPage(404, 'Not found');

  // Fetch the outer vidsrc embed page server-side.
  // The outer page contains the ad-triggering JS; we strip it entirely.
  let outerHtml: string;
  try {
    const res = await fetch(`https://vidsrc.icu/embed/movie/${movieId}`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Referer: 'https://vidsrc.icu/',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      cache: 'no-store',
    });
    if (!res.ok) return errorPage(res.status, `Provider returned ${res.status}`);
    outerHtml = await res.text();
  } catch {
    return errorPage(502, 'Could not reach video provider');
  }

  // Extract the inner iframe src — the real player (e.g. whisperingauroras.com).
  // It has no ads; popups only originate from the outer vidsrc wrapper we just discarded.
  const iframeMatch = outerHtml.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  const rawSrc = iframeMatch?.[1];
  if (!rawSrc) return errorPage(502, 'Player not found');

  // Normalise and validate the URL before inserting into HTML.
  let playerUrl: URL;
  try {
    playerUrl = new URL(
      rawSrc.startsWith('http')
        ? rawSrc
        : `https://vidsrc.icu${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`,
    );
    if (playerUrl.protocol !== 'https:' && playerUrl.protocol !== 'http:') {
      return errorPage(502, 'Invalid player URL');
    }
  } catch {
    return errorPage(502, 'Invalid player URL');
  }

  const safeUrl = playerUrl.toString().replace(/"/g, '%22');

  // Serve a minimal shell that embeds ONLY the inner player.
  // sandbox WITHOUT allow-popups: player JS runs normally but can't open new windows/tabs.
  // referrerpolicy="no-referrer": avoids referer mismatch that could break the player load.
  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:#000}iframe{width:100%;height:100%;border:0;display:block}</style>
</head>
<body>
<iframe
  src="${safeUrl}"
  allowfullscreen
  referrerpolicy="no-referrer"
  allow="autoplay; fullscreen; accelerometer; gyroscope; picture-in-picture"
  sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
></iframe>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function errorPage(status: number, message: string): Response {
  const html = `<!doctype html><html><body style="background:#000;color:rgba(255,255,255,.5);display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font:14px/1 sans-serif"><span>${message}</span></body></html>`;
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
