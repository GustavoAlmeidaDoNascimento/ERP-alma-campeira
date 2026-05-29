import { type NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { SESSION_COOKIE_NAME, SESSION_TTL } from '@/lib/session'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout', '/uploads']

const MW_FRESH_COOKIE = 'mw-fresh'
const MW_FRESH_TTL = 300 // 5 minutos

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? ''
  return new TextEncoder().encode(secret)
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Passa rotas públicas sem verificar
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value

  // Sem token → redireciona para login
  if (!token) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  // Fast-path: se o cookie mw-fresh existe, pula verificação JWT
  const freshCookie = request.cookies.get(MW_FRESH_COOKIE)?.value
  if (freshCookie === '1') {
    return NextResponse.next()
  }

  // Verifica JWT
  try {
    await jwtVerify(token, getJwtSecret())
  } catch {
    // Token inválido → limpa cookie e redireciona
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    const response = NextResponse.redirect(loginUrl)
    response.cookies.set(SESSION_COOKIE_NAME, '', { maxAge: 0, path: '/' })
    return response
  }

  // JWT válido → seta mw-fresh para evitar verificação nas próximas requisições
  const response = NextResponse.next()
  response.cookies.set(MW_FRESH_COOKIE, '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MW_FRESH_TTL,
    path: '/',
  })

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
