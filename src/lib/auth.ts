import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createClient, withSupabaseCookieContext } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { permissoesVazias, permissoesFromArray } from '@/lib/permissoes'
import { withTiming } from '@/lib/perf/timing'
import type { PermMap } from '@/lib/permissoes'
import { MODULOS } from '@/types'
import type { ModuloKey } from '@/types'
import { getSessionUser } from '@/lib/session'

type Acao = 'ver' | 'criar' | 'editar' | 'deletar'

// Tipo compatível com o uso anterior de User do Supabase
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
    const supabase = createAdminClient()
    const { count } = await supabase
      .from('usuarios_perfis')
      .select('id', { count: 'exact', head: true })
    return (count ?? 0) > 0
  },
  ['system-has-any-profile'],
  { revalidate: 3600, tags: ['system-has-any-profile'] },
)

const getPermissoesEfetivasCached = unstable_cache(
  async (userId: string): Promise<PermMap> => {
    // Usa admin (service_role) para bypasear RLS — permissões são lógica interna do servidor
    const supabase = createAdminClient()

    // Permissões customizadas têm prioridade
    const { data: customPerms } = await supabase
      .from('usuario_permissoes')
      .select('*')
      .eq('usuario_id', userId)

    if (customPerms && customPerms.length > 0) {
      return permissoesFromArray(customPerms as Parameters<typeof permissoesFromArray>[0])
    }

    // Cargo do usuário
    const { data: perfil, error: perfilError } = await supabase
      .from('usuarios_perfis')
      .select('cargo_id, cargo:cargos(permissoes:cargo_permissoes(*))')
      .eq('id', userId)
      .single()

    // Se a query falhou por um motivo que não seja "nenhuma linha encontrada",
    // bloqueamos o acesso em vez de conceder acesso total.
    // PGRST116 = "The result contains 0 rows" (sem perfil = pode ser bootstrap).
    if (perfilError && perfilError.code !== 'PGRST116') {
      return permissoesVazias()
    }

    if (!perfil) {
      const hasAnyProfile = await systemHasAnyProfile()
      if (!hasAnyProfile) return acesso_total()
      return permissoesVazias()
    }

    if (!perfil.cargo_id || !perfil.cargo) {
      return permissoesVazias()
    }

    const cargoRaw = Array.isArray(perfil.cargo) ? perfil.cargo[0] : perfil.cargo
    const cargo = cargoRaw as { permissoes: Parameters<typeof permissoesFromArray>[0] }
    return permissoesFromArray(cargo.permissoes)
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
    return withSupabaseCookieContext(() => getPermissoesEfetivasCached(user.id))
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
