import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

export const SESSION_COOKIE_NAME = 'erp-session'
export const SESSION_TTL = 7 * 24 * 60 * 60 // 7 dias em segundos

/**
 * Flag `secure` dos cookies de sessão.
 *
 * Um cookie `secure` só é armazenado/enviado pelo navegador via HTTPS. Se a app
 * roda em HTTP puro (ex.: produção em http://IP sem TLS), `secure: true` faz o
 * navegador DESCARTAR o cookie de sessão — o login "funciona" (200) mas a sessão
 * nunca persiste, gerando loop de redirect /login (tela piscando).
 *
 * Por isso o default é `false` (compatível com HTTP). Quando a produção tiver
 * HTTPS, defina `COOKIE_SECURE=true` no ambiente.
 */
export const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true'

export interface SessionUser {
  id: string
  email: string
}

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET não configurado')
  return new TextEncoder().encode(secret)
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    role: 'authenticated',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(getJwtSecret())
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    if (!payload.sub || !payload.email) return null
    return { id: payload.sub, email: payload.email as string }
  } catch {
    return null
  }
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await getSessionToken()
  if (!token) return null
  return verifySessionToken(token)
}
