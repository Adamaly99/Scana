import createMiddleware from 'next-intl/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const intlMiddleware = createMiddleware({
  locales: ['fr', 'en', 'es', 'de', 'ar', 'zh'],
  defaultLocale: 'fr',
  localePrefix: 'as-needed'
});

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip next-intl for API routes, static files, and auth callback
  if (pathname.startsWith('/api/') || 
      pathname.startsWith('/_next/') || 
      pathname.startsWith('/icons/') ||
      pathname.startsWith('/ocr/') ||
      pathname === '/sw.js') {
    return NextResponse.next();
  }
  
  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api|_next|icons|ocr|sw\\.js).*)']
};
