import type { NextRequest } from 'next/server';

export const runtime = 'edge';

// import type { NextRequest } from 'next/server';

// // Edge runtime runs on Cloudflare's global network — IPs are far less likely
// // to be blocked by streaming providers than Vercel's serverless (AWS) IPs.
// export const runtime = 'edge';

// type Provider = { url: string; referer: string };

// function getProviders(movieId: number): Provider[] {
//   return [
//     { url: `https://vidsrc.icu/embed/movie/${movieId}`, referer: 'https://vidsrc.icu/' },
//     { url: `https://embed.su/embed/movie/${movieId}`, referer: 'https://embed.su/' },
//     { url: `https://moviesapi.club/movie/${movieId}`, referer: 'https://moviesapi.club/' },
//   ];
// }

// // Headers that mimic a real Chrome browser navigation request.
// const BROWSER_HEADERS = {
//   'User-Agent':
//     'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
//   Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
//   'Accept-Language': 'en-US,en;q=0.9',
//   'Sec-Fetch-Dest': 'document',
//   'Sec-Fetch-Mode': 'navigate',
//   'Sec-Fetch-Site': 'cross-site',
//   'Sec-Fetch-User': '?1',
//   'Upgrade-Insecure-Requests': '1',
// } as const;

// // Chrome enforces sandbox restrictions more aggressively than other browsers,
// // preventing the player's internal window.open() calls needed to start video.
// // Non-Chrome browsers work fine with a sandbox that blocks ad popups.
// function isChrome(req: NextRequest): boolean {
//   const ua = req.headers.get('user-agent') ?? '';
//   return /Chrome\//.test(ua) && !/Edg\/|OPR\//.test(ua);
// }

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movieId = Number(id);
  if (Number.isNaN(movieId)) return errorPage(404, 'Not found');

  // // const chrome = isChrome(req);
  // // const errors: string[] = [];

  // // for (const provider of getProviders(movieId)) {
  // //   const result = await tryProvider(provider, chrome);
  // //   if (result.res) return result.res;
  // //   errors.push(`${new URL(provider.url).hostname}: ${result.error}`);
  // // }

  // // return errorPage(502, 'All video providers are currently unavailable', errors);

  // Use videasy iframe embed
  const playerUrl = `https://player.videasy.net/movie/${movieId}`;

  return new Response(
    `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:#000}iframe{width:100%;height:100%;border:0;display:block}</style>
</head>
<body>
<iframe
  src="${playerUrl}"
  allowFullScreen
  allow="autoplay; fullscreen; accelerometer; gyroscope; picture-in-picture"
  // sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
></iframe>
</body>
</html>`,
    {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    },
  );
}

// type ProviderResult = { res: Response; error?: never } | { res: null; error: string };

// async function tryProvider(provider: Provider, chrome: boolean): Promise<ProviderResult> {
//   let html: string;
//   try {
//     const res = await fetch(provider.url, {
//       headers: { ...BROWSER_HEADERS, Referer: provider.referer },
//       // cache: 'no-store',
//     });
//     if (!res.ok) return { res: null, error: `HTTP ${res.status}` };
//     html = await res.text();
//   } catch (e) {
//     return { res: null, error: e instanceof Error ? e.message : 'fetch failed' };
//   }

//   // Extract the inner iframe src — the real ad-free player embedded by the outer page.
//   const iframeMatch = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
//   const rawSrc = iframeMatch?.[1];
//   if (!rawSrc) return { res: null, error: 'no iframe found in response' };

//   let playerUrl: URL;
//   try {
//     const base = new URL(provider.url);
//     playerUrl = new URL(
//       rawSrc.startsWith('http')
//         ? rawSrc
//         : `${base.origin}${rawSrc.startsWith('/') ? '' : '/'}${rawSrc}`,
//     );
//     if (playerUrl.protocol !== 'https:' && playerUrl.protocol !== 'http:')
//       return { res: null, error: 'invalid player URL protocol' };
//   } catch {
//     return { res: null, error: 'could not parse player URL' };
//   }

//   if (chrome) {
//     return buildChromeResponse(playerUrl, provider.referer);
//   }

//   // Non-Chrome: minimal sandbox without allow-popups blocks ad popups entirely.
//   // referrerpolicy="no-referrer": prevents referer-mismatch from blocking the player.
//   const safeUrl = playerUrl.toString().replace(/"/g, '%22');
//   const playerHtml = `<!doctype html>
// <html>
// <head>
// <meta charset="utf-8">
// <meta name="viewport" content="width=device-width,initial-scale=1">
// <meta name="referrer" content="no-referrer">
// <style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:#000}iframe{width:100%;height:100%;border:0;display:block}</style>
// </head>
// <body>
// <iframe
//   src="${safeUrl}"
//   allowfullscreen
//   referrerpolicy="no-referrer"
//   allow="autoplay; fullscreen; accelerometer; gyroscope; picture-in-picture"
//   sandbox="allow-scripts allow-same-origin allow-presentation allow-fullscreen"
// ></iframe>
// </body>
// </html>`;

//   return {
//     res: new Response(playerHtml, {
//       status: 200,
//       headers: {
//         'Content-Type': 'text/html; charset=utf-8',
//         // Cache at CDN for 1h, serve stale for up to 24h while revalidating.
//         // Provider URLs for a given movie ID are stable; no user-specific content.
//         'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
//       },
//     }),
//   };
// }

// // Chrome cannot sandbox the player iframe without breaking video (the player's
// // window.open() calls are needed for playback). Instead, fetch the player HTML
// // server-side, inject window.open blocker before any scripts run, and serve the
// // modified HTML from our origin — giving our injected code full same-origin access.
// // Relative fetch/XHR URLs are rewritten to the player's origin so API calls still work.
// async function buildChromeResponse(playerUrl: URL, referer: string): Promise<ProviderResult> {
//   let playerHtml: string;
//   try {
//     const res = await fetch(playerUrl.toString(), {
//       headers: { ...BROWSER_HEADERS, Referer: referer },
//       // cache: 'no-store',
//     });
//     if (!res.ok) return { res: null, error: `player fetch HTTP ${res.status}` };
//     playerHtml = await res.text();
//   } catch (e) {
//     return { res: null, error: e instanceof Error ? e.message : 'player fetch failed' };
//   }

//   const origin = playerUrl.origin.replace(/'/g, "\\'");

//   // Strip CSP meta tags so they don't block our injected script.
//   playerHtml = playerHtml.replace(
//     /<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*\/?>/gi,
//     '',
//   );

//   // Injected at the very top of <head> — order matters:
//   // 1. <base href> must come first so all subsequent relative HTML resource URLs
//   //    (script src, link href, img src) resolve to the player's origin, not ours.
//   // 2. <style> forces full-viewport layout.
//   // 3. <script> blocks window.open and rewrites relative fetch/XHR URLs (JS ignores
//   //    <base href>, so these need a runtime override).
//   const blocker =
//     `<base href="${playerUrl.origin}/">` +
//     `<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:100%;height:100%;overflow:hidden;background:#000}body>div,body>section,body>main{width:100%!important;height:100%!important}iframe{width:100%!important;height:100%!important;border:0;display:block}</style>` +
//     `<script>(function(){` +
//     `window.open=function(){return null;};` +
//     `var o='${origin}';` +
//     `var _f=window.fetch;window.fetch=function(u,a){if(typeof u==='string'&&u.startsWith('/'))u=o+u;return _f.call(this,u,a);};` +
//     `var _x=XMLHttpRequest.prototype.open;XMLHttpRequest.prototype.open=function(m,u){if(typeof u==='string'&&u.startsWith('/'))u=o+u;return _x.apply(this,arguments);};` +
//     `})();<\/script>`;

//   const modified = /<head/i.test(playerHtml)
//     ? playerHtml.replace(/(<head[^>]*>)/i, `$1${blocker}`)
//     : blocker + playerHtml;

//   return {
//     res: new Response(modified, {
//       status: 200,
//       headers: {
//         'Content-Type': 'text/html; charset=utf-8',
//         // Player HTML contains ephemeral stream tokens — never cache.
//         'Cache-Control': 'no-store',
//       },
//     }),
//   };
// }

function errorPage(status: number, message: string, errors?: string[]): Response {
  const detail = errors?.length
    ? `<ul style="margin:.5rem 0 0;padding:0;list-style:none;font-size:11px;opacity:.6">${errors.map((e) => `<li>${e}</li>`).join('')}</ul>`
    : '<div>No errors found</div>';
  const html = `<!doctype html><html><body style="background:#000;color:rgba(255,255,255,.5);display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0;font:14px/1 sans-serif;text-align:center"><span>${message}</span>${detail}</body></html>`;
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}