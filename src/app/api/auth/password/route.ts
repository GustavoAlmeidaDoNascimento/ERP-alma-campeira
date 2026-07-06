import { NextRequest, NextResponse } from 'next/server'
import { compare, hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
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

    // Se currentPassword enviado, valida antes de trocar
    if (currentPassword) {
      const user = await prisma.user.findUnique({
        where: { id: sessionUser.id },
        select: { passwordHash: true },
      })
      if (!user) {
        return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
      }
      const valid = await compare(currentPassword, user.passwordHash)
      if (!valid) {
        return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })
      }
    }

    const passwordHash = await hash(password, 12)
    await prisma.user.update({
      where: { id: sessionUser.id },
      data: { passwordHash },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[auth/password]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
