import { type NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { SESSION_COOKIE_NAME } from '@/lib/session'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout', '/uploads']

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (publicPath) => pathname === publicPath || pathname.startsWith(`${publicPath}/`)
  )
}

/**
 * Fail closed: sem JWT_SECRET nenhuma sessão é aceita.
 * (Nunca cair para string vazia, que permitiria assinar tokens com segredo vazio.)
 */
function getJwtSecret(): Uint8Array | null {
  const secret = process.env.JWT_SECRET
  if (!secret) return null
  return new TextEncoder().encode(secret)
}

function redirectToLogin(request: NextRequest, clearSession: boolean) {
  const loginUrl = request.nextUrl.clone()
  loginUrl.pathname = '/login'
  const response = NextResponse.redirect(loginUrl)
  if (clearSession) {
    response.cookies.set(SESSION_COOKIE_NAME, '', { maxAge: 0, path: '/' })
  }
  return response
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublicPath(pathname)) {
    return NextResponse.next()
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  if (!token) {
    return redirectToLogin(request, false)
  }

  const secret = getJwtSecret()
  if (!secret) {
    console.error('[proxy] JWT_SECRET não configurado: bloqueando acesso')
    return new NextResponse('Servidor sem configuração de autenticação', { status: 500 })
  }

  // O JWT é verificado em TODA requisição (HS256 é barato). Não existe atalho por
  // cookie: qualquer cookie enviado pelo cliente pode ser forjado.
  try {
    await jwtVerify(token, secret, { algorithms: ['HS256'] })
  } catch {
    return redirectToLogin(request, true)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
