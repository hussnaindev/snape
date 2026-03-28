import type { NextRequest } from 'next/server';

// Edge runtime runs on Cloudflare's global network — IPs are far less likely
// to be blocked by streaming providers than Vercel's serverless (AWS) IPs.
export const runtime = 'edge';

type Provider = { url: string; referer: string };

function getProviders(movieId: number): Provider[] {
  return [
    { url: `https://vidsrc.icu/embed/movie/${movieId}`,  referer: 'https://vidsrc.icu/' },
    { url: `https://embed.su/embed/movie/${movieId}`,     referer: 'https://embed.su/' },
    { url: `https://moviesapi.club/movie/${movieId}`,     referer: 'https://moviesapi.club/' },
  ];
}

// Headers that mimic a real Chrome browser navigation request.
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
} as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const movieId = Number(id);
  if (Number.isNaN(movieId)) return errorPage(404, 'Not found');

  for (const provider of getProviders(movieId)) {
    const res = await tryProvider(provider);
    if (res) return res;
  }

  return errorPage(502, 'All video providers are currently unavailable');
}

async function tryProvider(provider: Provider): Promise<Response | null> {
  let html: string;
  try {
    const res = await fetch(provider.url, {
      headers: { ...BROWSER_HEADERS, Referer: provider.referer },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    html = await res.text();
  } catch {
    return null;
  }

  // Extract the inner iframe src — the real ad-free player embedded by the outer page.
  const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
  const rawSrc = iframeMatch?.[1];
  if (!rawSrc) return null;

  let playerUrl: URL;
  try {
    const base = new URL(provider.url);
    playerUrl = new URL(
      rawSrc.startsWith('http') ? rawSrc : `${base.origin}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`,
    );
    if (playerUrl.protocol !== 'https:' && playerUrl.protocol !== 'http:') return null;
  } catch {
    return null;
  }

  const safeUrl = playerUrl.toString().replace(/"/g, '%22');

  // Minimal shell embedding only the inner player.
  // sandbox WITHOUT allow-popups: JS runs, video plays, popups silently blocked.
  // referrerpolicy="no-referrer": prevents referer-mismatch from breaking the player.
  const playerHtml = `<!doctype html>
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

  return new Response(playerHtml, {
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
