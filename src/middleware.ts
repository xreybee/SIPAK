import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'super_secret_key_for_sipak_demo_only');

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('sipak_auth_token')?.value;
  const isLoginPage = request.nextUrl.pathname === '/login';

  // Exclude static files, api routes (partially), and public assets
  if (
    request.nextUrl.pathname.startsWith('/_next') || 
    request.nextUrl.pathname.startsWith('/api/auth') || 
    request.nextUrl.pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  if (!token) {
    if (isLoginPage) return NextResponse.next();
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    await jwtVerify(token, JWT_SECRET);
    if (isLoginPage) {
      // Already logged in, redirect to dashboard
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  } catch (err) {
    // Token invalid or expired
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('sipak_auth_token');
    return response;
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/|images/).*)'],
};
