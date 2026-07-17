import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Every real request should live on the WAF-protected custom domain. The default
// *.pages.dev hostname sits OUTSIDE the Cloudflare zone, so Under Attack Mode /
// WAF / rate-limiting configured on the custom domain do NOT apply to it — it is
// the main unprotected surface that bots hammer. Funnel any pages.dev hit onto
// the canonical host with a permanent redirect so the zone's protections take
// over (and most bots simply drop the redirect). NOTE: this is defense-in-depth
// — the request still costs one Function invocation before this runs. The hard
// block for pages.dev must be a Cloudflare Access policy (see docs/ABUSE.md).
const CANONICAL_HOST = process.env.NEXT_PUBLIC_CANONICAL_HOST || 'snape.hussnainraza.cv';

const PROTECTED = ['/profile', '/settings', '/watchlist'];

export function middleware(request: NextRequest) {
  const host = request.headers.get('host') ?? '';
  if (host.endsWith('.pages.dev')) {
    const target = new URL(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
      `https://${CANONICAL_HOST}`,
    );
    return NextResponse.redirect(target, 301);
  }

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname.startsWith(p));
  if (isProtected) {
    const token = request.cookies.get('session_token')?.value;
    if (!token) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/login';
      url.searchParams.set('from', pathname);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

export const config = {
  // Run on all routes (so the pages.dev redirect covers everything) except Next
  // static assets and static files that never need it.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.json|sw.js|workbox-|icons/).*)',
  ],
};
