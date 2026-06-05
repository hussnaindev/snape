import { type NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';

const UPSTREAM = 'https://peachify.top';

// Inject before any player script. No history.replaceState needed here —
// the iframe is loaded at the correct /embed/... URL already, so the player
// reads the right pathname without any URL manipulation. Eliminating
// replaceState also prevents Next.js's router from doing an RSC refetch
// (which happened when the URL changed and caused React hydration errors).
const buildInject = (origin: string) => `<base href="${UPSTREAM}/">
<script>
(function(){
  var NOOP=function(){return null;};
  window.open=NOOP;
  try{window.parent.open=NOOP;}catch(e){}
  try{window.top.open=NOOP;}catch(e){}
  var _ac=HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click=function(){
    var t=this.getAttribute('target')||'';
    if(t&&t!=='_self'&&t!=='_top'&&t!=='_parent')return;
    return _ac.call(this);
  };
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
  var B='${UPSTREAM}';
  var H=${JSON.stringify(origin)};
  var P='/api/peachify-proxy';
  function rw(u){
    if(typeof u!=='string')return u;
    if(u.startsWith(B))return P+u.slice(B.length);
    if(H&&u.startsWith(H))return P+u.slice(H.length);
    if(u[0]==='/'){
      // Static Next.js assets resolve via <base href> as script tags from peachify.top.
      // Don't proxy them — they would hit our own Next.js server and 404.
      if(u.startsWith('/_next/static/'))return u;
      return P+u;
    }
    try{
      var pu=new URL(u);
      if(pu.hostname.endsWith('.eat-peach.sbs')||pu.hostname.endsWith('.peachify.top'))
        return P+'/~eph/'+pu.hostname+pu.pathname+pu.search;
    }catch(e){}
    return u;
  }
  var _f=window.fetch;
  window.fetch=function(u,o){return _f.call(this,rw(u),o);};
  var _xo=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){
    return _xo.apply(this,[m,rw(u)].concat(Array.prototype.slice.call(arguments,2)));
  };
  // Intercept HTMLScriptElement.src assignments for Turbopack chunk loading.
  // Turbopack constructs chunk URLs via new URL(path, window.location) — not
  // document.baseURI — so chunks resolve to our server which lacks Peachify's
  // static chunks. Rewrite them through our proxy at the source.
  var _sd=Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype,'src');
  if(_sd&&_sd.set){
    Object.defineProperty(HTMLScriptElement.prototype,'src',{
      set:function(v){_sd.set.call(this,rw(String(v)));},
      get:_sd.get,
      configurable:true,
      enumerable:_sd.enumerable,
    });
  }
})();
</script>`;

const FETCH_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  // This route is mounted at /embed/[...slug], so slug contains segments
  // after /embed/ — e.g. ['movie','1022789']. Reconstruct the full embed path.
  const path = `/embed/${slug.join('/')}`;

  const { searchParams } = req.nextUrl;
  const upstreamUrl = new URL(`${UPSTREAM}${path}`);
  for (const [k, v] of searchParams.entries()) {
    upstreamUrl.searchParams.set(k, v);
  }

  // RSC refetch: Next.js router calls this URL with RSC: 1 after hydration.
  // Forward with proper RSC headers so peachify returns wire-format RSC data
  // instead of full HTML, preventing the "unexpected response" React error.
  const isRsc = req.headers.get('rsc') !== null;
  if (isRsc) {
    const rscHeaders: Record<string, string> = {
      'User-Agent': FETCH_HEADERS['User-Agent'],
      Origin: UPSTREAM,
      Referer: `${UPSTREAM}/`,
    };
    for (const h of ['rsc', 'next-router-state-tree', 'next-router-prefetch', 'next-url', 'accept']) {
      const v = req.headers.get(h);
      if (v !== null) rscHeaders[h] = v;
    }
    try {
      const res = await fetch(upstreamUrl.toString(), { headers: rscHeaders });
      const body = await res.arrayBuffer();
      const resHeaders = new Headers();
      const ct = res.headers.get('content-type');
      if (ct) resHeaders.set('Content-Type', ct);
      resHeaders.set('Cache-Control', 'no-store');
      return new NextResponse(body, { status: res.status, headers: resHeaders });
    } catch {
      return new NextResponse('Bad Gateway', { status: 502 });
    }
  }

  // Normal HTML request: fetch, strip Rocket Loader, inject ad-blocker script.
  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl.toString(), { headers: FETCH_HEADERS });
  } catch {
    return new NextResponse('Bad Gateway', { status: 502 });
  }

  if (!upstream.ok) {
    return new NextResponse('Bad Gateway', { status: 502 });
  }

  let html = await upstream.text();

  html = html
    .replace(/\s+type="[0-9a-f]{20,}-text\/javascript"/gi, '')
    .replace(/<script\b[^>]*src="[^"]*\/cdn-cgi\/[^"]*rocket-loader[^"]*"[^>]*>\s*<\/script>/gi, '');

  const origin = new URL(req.url).origin;
  const inject = buildInject(origin);
  const headMatch = /<head[^>]*>/i.exec(html);
  if (headMatch !== null) {
    const pos = headMatch.index + headMatch[0].length;
    html = `${html.slice(0, pos)}${inject}${html.slice(pos)}`;
  } else {
    html = inject + html;
  }

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-transform',
    },
  });
}
