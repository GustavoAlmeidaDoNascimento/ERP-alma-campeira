import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/session'

export async function GET() {
  try {
    const user = await getSessionUser()

    if (!user) {
      return NextResponse.json({ user: null }, { status: 401 })
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        identities: [{ provider: 'email' }],
      },
    })
  } catch (err) {
    console.error('[auth/user]', err)
    return NextResponse.json({ user: null }, { status: 500 })
  }
}
