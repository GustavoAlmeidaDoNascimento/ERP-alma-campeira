import { type NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { SESSION_COOKIE_NAME, COOKIE_SECURE } from '@/lib/session'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout', '/uploads']

const PROXY_FRESH_COOKIE = 'mw-fresh'
const PROXY_FRESH_TTL = 300 // 5 minutos

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? ''
  return new TextEncoder().encode(secret)
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC_PATHS.some((publicPath) => pathname.startsWith(publicPath))) {
    return NextResponse.next()
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  const freshCookie = request.cookies.get(PROXY_FRESH_COOKIE)?.value
  if (freshCookie === '1') {
    return NextResponse.next()
  }

  try {
    await jwtVerify(token, getJwtSecret())
  } catch {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    const response = NextResponse.redirect(loginUrl)
    response.cookies.set(SESSION_COOKIE_NAME, '', { maxAge: 0, path: '/' })
    return response
  }

  const response = NextResponse.next()
  response.cookies.set(PROXY_FRESH_COOKIE, '1', {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: PROXY_FRESH_TTL,
    path: '/',
  })

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
