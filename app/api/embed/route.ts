import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const UPSTREAM = 'https://peachify.top';
const ALLOWED_PATH_PREFIX = '/embed/';

// Injected immediately after <head> — runs before any player script:
//   1. <base href> makes relative HTML asset URLs (img, link) resolve to peachify.top
//   2. window.open override kills ad popups
//   3. fetch / XHR patches rewrite relative API paths to peachify.top
//      (absolute URLs are already correct; they just need CORS to pass)
const HEAD_INJECT = `<base href="${UPSTREAM}/">
<script>
(function(){
  window.open=function(){return null;};
  var _f=window.fetch;
  window.fetch=function(u,o){
    if(typeof u==='string'&&u.startsWith('/'))u='${UPSTREAM}'+u;
    return _f.call(this,u,o);
  };
  var _x=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){
    if(typeof u==='string'&&u.startsWith('/'))u='${UPSTREAM}'+u;
    return _x.apply(this,arguments);
  };
})();
</script>`;

export async function GET(req: NextRequest) {
  const rawUrl = req.nextUrl.searchParams.get('url') ?? '';

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return new NextResponse('Bad Request', { status: 400 });
  }

  if (parsed.origin !== UPSTREAM || !parsed.pathname.startsWith(ALLOWED_PATH_PREFIX)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  let upstream: Response;
  try {
    upstream = await fetch(rawUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
  } catch {
    return new NextResponse('Bad Gateway', { status: 502 });
  }

  if (!upstream.ok) {
    return new NextResponse('Bad Gateway', { status: 502 });
  }

  let html = await upstream.text();

  const headMatch = /<head[^>]*>/i.exec(html);
  if (headMatch !== null) {
    const pos = headMatch.index + headMatch[0].length;
    html = `${html.slice(0, pos)}${HEAD_INJECT}${html.slice(pos)}`;
  } else {
    html = HEAD_INJECT + html;
  }

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
