import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PROTECTED = ['/profile', '/settings', '/watchlist'];

export function middleware(request: NextRequest) {
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
  matcher: ['/profile/:path*', '/settings/:path*', '/watchlist/:path*'],
};
