import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Middleware runs on every matched request before the route handler.
 * Use this for: auth checks, redirects, A/B testing, locale detection.
 */
export function middleware(_request: NextRequest) {
  // Example: redirect unauthenticated users
  // const token = request.cookies.get('token');
  // if (!token) return NextResponse.redirect(new URL('/login', request.url));

  return NextResponse.next();
}

export const config = {
  // Matches all routes except static files and API health check
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/health).*)'],
};
