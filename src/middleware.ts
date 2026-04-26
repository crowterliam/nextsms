import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_API_ROUTES = new Set([
  '/api/auth',
  '/api/league',
]);

export function middleware(request: NextRequest) {
  if (request.method === 'GET' && request.nextUrl.pathname === '/api/teams') {
    return NextResponse.next();
  }

  for (const prefix of PUBLIC_API_ROUTES) {
    if (request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(prefix + '/')) {
      return NextResponse.next();
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/).*)'],
};
