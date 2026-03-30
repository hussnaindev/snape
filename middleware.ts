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
  // No routes matched — middleware is a no-op until auth is needed.
  // An empty matcher prevents the edge function from running on every request.
  matcher: [],
};
