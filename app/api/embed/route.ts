import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const UPSTREAM = 'https://peachify.top';
const ALLOWED_PATH_PREFIX = '/embed/';

// Injected immediately after <head> — runs before any player script.
// Covers all known ad-popup mechanisms:
//   • window.open (and parent/top variants since the proxied iframe is same-origin)
//   • <a target="_blank"> clicks, including programmatic el.click() tricks
//   • relative fetch/XHR paths rewritten to peachify.top so the player API works
const HEAD_INJECT = `<base href="${UPSTREAM}/">
<script>
(function(){
  var NOOP=function(){return null;};
  // Kill window.open on this frame and any accessible ancestor
  window.open=NOOP;
  try{window.parent.open=NOOP;}catch(e){}
  try{window.top.open=NOOP;}catch(e){}
  // Block target!=_self anchor navigations in capture phase so we run
  // before ad listeners and before the browser acts on the link
  document.addEventListener('click',function(e){
    var el=e.target;
    for(var i=0;i<10&&el&&el!==document;i++,el=el.parentElement){
      if(el.nodeName==='A'){
        var t=el.getAttribute('target')||'';
        if(t&&t!=='_self'){e.preventDefault();e.stopImmediatePropagation();}
        break;
      }
    }
  },true);
  // Rewrite relative fetch/XHR paths so the player API resolves correctly
  var B='${UPSTREAM}';
  var _f=window.fetch;
  window.fetch=function(u,o){
    if(typeof u==='string'&&u[0]==='/')u=B+u;
    return _f.call(this,u,o);
  };
  var _xo=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){
    if(typeof u==='string'&&u[0]==='/')u=B+u;
    return _xo.apply(this,arguments);
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
