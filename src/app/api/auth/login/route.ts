import { NextRequest, NextResponse } from 'next/server'
import { compare } from 'bcryptjs'
import { db } from '@/lib/db'
import { createSessionToken, SESSION_COOKIE_NAME, SESSION_TTL, COOKIE_SECURE } from '@/lib/session'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
    }

    const sql = db()
    const rows = await sql<{ id: string; email: string; password_hash: string }[]>`
      SELECT id, email, password_hash
      FROM public.users
      WHERE email = ${email.toLowerCase().trim()}
      LIMIT 1
    `

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Invalid login credentials' }, { status: 401 })
    }

    const user = rows[0]
    const valid = await compare(password, user.password_hash)

    if (!valid) {
      return NextResponse.json({ error: 'Invalid login credentials' }, { status: 401 })
    }

    const token = await createSessionToken({ id: user.id, email: user.email })

    const response = NextResponse.json({
      user: { id: user.id, email: user.email },
    })

    response.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: 'lax',
      maxAge: SESSION_TTL,
      path: '/',
    })

    return response
  } catch (err) {
    console.error('[auth/login]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
