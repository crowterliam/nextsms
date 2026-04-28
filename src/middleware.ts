import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_API_PREFIXES = [
  '/api/auth/',
  '/_vinext/',
];

const PUBLIC_API_EXACT = new Set([
  '/api/auth',
]);

function isPublicApiPath(pathname: string): boolean {
  if (PUBLIC_API_EXACT.has(pathname)) return true;
  for (const prefix of PUBLIC_API_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}

export function middleware(request: NextRequest) {
  if (isPublicApiPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  if (request.nextUrl.pathname.startsWith('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const requestedWith = request.headers.get('X-Requested-With');
    const contentType = request.headers.get('Content-Type') || '';
    const isMultipart = contentType.includes('multipart/form-data');
    if (!requestedWith && !isMultipart) {
      return NextResponse.json({ error: 'CSRF token missing' }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/).*)'],
};
