import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const UPSTREAM = 'https://peachify.top';
const ALLOWED_PATH_PREFIX = '/embed/';

// Build the injection dynamically so we can include the correct embed path.
// history.replaceState is the critical fix: Peachify's Next.js client router
// reads window.location on boot to know what movie/episode to load. Without
// it the router sees our proxy path (/api/embed) and renders 404 for everything.
function buildHeadInject(embedPath: string, embedSearch: string): string {
  const pathAndQuery = JSON.stringify(`${embedPath}${embedSearch}`);
  return `<base href="${UPSTREAM}/">
<script>
(function(){
  // Restore the correct embed URL so Peachify's Next.js router initialises
  // with the right route segments instead of our proxy path.
  history.replaceState(null,'',${pathAndQuery});
  var NOOP=function(){return null;};
  window.open=NOOP;
  try{window.parent.open=NOOP;}catch(e){}
  try{window.top.open=NOOP;}catch(e){}
  // Patch HTMLAnchorElement.prototype.click — the most common ad bypass:
  // create a detached <a target="_blank">, never append it, call .click().
  // Document-level listeners never fire for detached elements.
  var _ac=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){
    var t=this.getAttribute('target')||'';
    if(t&&t!=='_self'&&t!=='_top'&&t!=='_parent')return;
    return _ac.call(this);
  };
  // Capture-phase block for attached anchor navigations
  document.addEventListener('click',function(e){
    var el=e.target;
    for(var i=0;i<10&&el&&el!==document;i++,el=el.parentElement){
      if(el.nodeName==='A'){
        var t=el.getAttribute('target')||'';
        if(t&&t!=='_self'&&t!=='_top'&&t!=='_parent'){
          e.preventDefault();
          e.stopImmediatePropagation();
        }
        break;
      }
    }
  },true);
  // Route ALL peachify.top fetch/XHR calls through our same-origin proxy so
  // the browser never sees a cross-origin request (Peachify's CORS blocks them).
  // Static assets (script src, link href) resolve via <base href> to peachify.top
  // directly — CDN-served files are CORS-open so those don't need proxying.
  var B='${UPSTREAM}';
  var P='/api/peachify-proxy';
  function rw(u){
    if(typeof u!=='string')return u;
    if(u.startsWith(B))return P+u.slice(B.length);
    if(u[0]==='/')return P+u;
    return u;
  }
  var _f=window.fetch;
  window.fetch=function(u,o){return _f.call(this,rw(u),o);};
  var _xo=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){
    return _xo.apply(this,[m,rw(u)].concat(Array.prototype.slice.call(arguments,2)));
  };
})();
</script>`;
}

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

  // Peachify is Cloudflare-hosted with Rocket Loader enabled, which rewrites
  // all <script src> type attributes to a custom token and injects a loader
  // script. Strip it so scripts run directly without the loader.
  html = html
    .replace(/\s+type="[0-9a-f]{20,}-text\/javascript"/gi, '')
    .replace(/<script\b[^>]*src="[^"]*\/cdn-cgi\/[^"]*rocket-loader[^"]*"[^>]*>\s*<\/script>/gi, '');

  const headInject = buildHeadInject(parsed.pathname, parsed.search);
  const headMatch = /<head[^>]*>/i.exec(html);
  if (headMatch !== null) {
    const pos = headMatch.index + headMatch[0].length;
    html = `${html.slice(0, pos)}${headInject}${html.slice(pos)}`;
  } else {
    html = headInject + html;
  }

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // no-transform: prevent Cloudflare Pages from applying its own Rocket
      // Loader on top of the already-stripped upstream HTML
      'Cache-Control': 'no-store, no-transform',
    },
  });
}
