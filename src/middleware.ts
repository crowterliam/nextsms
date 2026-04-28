import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = new Set([
  '/login',
  '/register',
]);

const PUBLIC_API_PREFIXES = [
  '/api/auth/',
  '/_vinext/',
];

const PUBLIC_API_EXACT = new Set([
  '/api/auth',
]);

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (PUBLIC_API_EXACT.has(pathname)) return true;
  for (const prefix of PUBLIC_API_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  if (pathname.startsWith('/_next/static') || pathname.startsWith('/_next/image')) return true;
  if (pathname === '/favicon.ico') return true;
  if (pathname.startsWith('/icons/')) return true;
  return false;
}

export function middleware(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get('better-auth.session_token')?.value
    || request.cookies.get('better-auth.session-token')?.value;

  if (!sessionToken) {
    if (request.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
    const requestedWith = request.headers.get('X-Requested-With');
    const contentType = request.headers.get('Content-Type') || '';
    const isFormLike = contentType.includes('multipart/form-data');
    if (!requestedWith && !isFormLike) {
      return NextResponse.json({ error: 'CSRF token missing' }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/).*)'],
};
