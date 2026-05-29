import { NextRequest, NextResponse } from 'next/server'
import { compare, hash } from 'bcryptjs'
import { db } from '@/lib/db'
import { getSessionUser } from '@/lib/session'

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await getSessionUser()
    if (!sessionUser) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { password, currentPassword } = await req.json()

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Senha deve ter ao menos 6 caracteres' }, { status: 400 })
    }

    const sql = db()

    // Se currentPassword enviado, valida antes de trocar
    if (currentPassword) {
      const rows = await sql<{ password_hash: string }[]>`
        SELECT password_hash FROM public.users WHERE id = ${sessionUser.id} LIMIT 1
      `
      if (rows.length === 0) {
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
      }
      const valid = await compare(currentPassword, rows[0].password_hash)
      if (!valid) {
        return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })
      }
    }

    const passwordHash = await hash(password, 12)
    await sql`
      UPDATE public.users SET password_hash = ${passwordHash} WHERE id = ${sessionUser.id}
    `

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[auth/password]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
