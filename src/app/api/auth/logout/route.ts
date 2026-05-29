import { NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME, COOKIE_SECURE } from '@/lib/session'

export async function POST() {
  const response = NextResponse.json({ success: true })
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
  return response
}
