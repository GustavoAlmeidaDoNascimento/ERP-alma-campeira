import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { permissoesVazias, permissoesFromArray } from '@/lib/permissoes'
import { withTiming } from '@/lib/perf/timing'
import type { PermMap } from '@/lib/permissoes'
import { MODULOS } from '@/types'
import type { ModuloKey } from '@/types'
import { getSessionUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { mapPermRows } from '@/lib/prisma-auth-mappers'

type Acao = 'ver' | 'criar' | 'editar' | 'deletar'

// Tipo enxuto usado pelos helpers de sessão locais.
export type AuthUser = { id: string; email: string }

export const getAuthenticatedUser = cache(async (): Promise<AuthUser | null> => {
  return withTiming('auth.getUser', async () => {
    return getSessionUser()
  })
})

export async function requireAuthenticatedUserId(): Promise<string> {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error('Não autenticado')
  return user.id
}

/** Evita COUNT(*) em `usuarios_perfis` a cada resolução de permissão sem perfil. */
const systemHasAnyProfile = unstable_cache(
  async (): Promise<boolean> => {
    const count = await prisma.usuarioPerfil.count()
    return count > 0
  },
  ['system-has-any-profile'],
  { revalidate: 3600, tags: ['system-has-any-profile'] },
)

const getPermissoesEfetivasCached = unstable_cache(
  async (userId: string): Promise<PermMap> => {
    // Permissões customizadas têm prioridade
    const customPerms = await prisma.usuarioPermissao.findMany({
      where: { userId },
      orderBy: { modulo: 'asc' },
    })

    if (customPerms.length > 0) {
      return permissoesFromArray(mapPermRows(customPerms))
    }

    // Cargo do usuário
    const perfil = await prisma.usuarioPerfil.findUnique({
      where: { id: userId },
      select: {
        cargoId: true,
        cargo: {
          select: {
            permissions: {
              orderBy: { modulo: 'asc' },
            },
          },
        },
      },
    })

    if (!perfil) {
      const hasAnyProfile = await systemHasAnyProfile()
      if (!hasAnyProfile) return acesso_total()
      return permissoesVazias()
    }

    if (!perfil.cargoId || !perfil.cargo) {
      return permissoesVazias()
    }

    return permissoesFromArray(mapPermRows(perfil.cargo.permissions))
  },
  ['user-permissions'],
  // Permissões mudam raramente. Cache de 10min reduz drasticamente queries em toda
  // server action. Mutações em cargos/permissões já chamam revalidateTag('user-permissions').
  { revalidate: 600, tags: ['user-permissions'] }
)

/**
 * Resolve as permissões efetivas do usuário logado.
 * Prioridade: permissões customizadas > cargo > nenhuma.
 * Cacheado com unstable_cache (30s) + React cache (intra-request).
 * Se o usuário não tem perfil ainda (primeiro admin), retorna acesso total.
 */
export const getPermissoesEfetivas = cache(async (): Promise<PermMap> => {
  return withTiming('getPermissoesEfetivas', async () => {
    const user = await getAuthenticatedUser()
    if (!user) return permissoesVazias()
    return getPermissoesEfetivasCached(user.id)
  })
})

/** Lança erro se o usuário não tiver a permissão solicitada */
export async function assertPermissao(modulo: ModuloKey, acao: Acao): Promise<void> {
  const perms = await getPermissoesEfetivas()
  if (!perms[modulo][acao]) {
    throw new Error(`Acesso negado: sem permissão para "${acao}" em "${modulo}".`)
  }
}

function acesso_total(): PermMap {
  const full = { ver: true, criar: true, editar: true, deletar: true }
  return Object.fromEntries(MODULOS.map((m) => [m.key, full])) as PermMap
}
