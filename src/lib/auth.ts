import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { createClient, withSupabaseCookieContext } from '@/lib/supabase/server'
import { permissoesVazias, permissoesFromArray } from '@/lib/permissoes'
import type { PermMap } from '@/lib/permissoes'
import type { ModuloKey } from '@/types'
import type { User } from '@supabase/supabase-js'

type Acao = 'ver' | 'criar' | 'editar' | 'deletar'

export const getAuthenticatedUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export async function requireAuthenticatedUserId(): Promise<string> {
  const user = await getAuthenticatedUser()
  if (!user) throw new Error('Não autenticado')
  return user.id
}

const getPermissoesEfetivasCached = unstable_cache(
  async (userId: string): Promise<PermMap> => {
    const supabase = await createClient()

    // Permissões customizadas têm prioridade
    const { data: customPerms } = await supabase
      .from('usuario_permissoes')
      .select('*')
      .eq('usuario_id', userId)

    if (customPerms && customPerms.length > 0) {
      return permissoesFromArray(customPerms as Parameters<typeof permissoesFromArray>[0])
    }

    // Cargo do usuário
    const { data: perfil } = await supabase
      .from('usuarios_perfis')
      .select('cargo_id, cargo:cargos(permissoes:cargo_permissoes(*))')
      .eq('id', userId)
      .single()

    // Sem perfil = bootstrap (primeiro admin) → acesso total
    if (!perfil) {
      return acesso_total()
    }

    if (!perfil.cargo_id || !perfil.cargo) {
      return permissoesVazias()
    }

    const cargoRaw = Array.isArray(perfil.cargo) ? perfil.cargo[0] : perfil.cargo
    const cargo = cargoRaw as { permissoes: Parameters<typeof permissoesFromArray>[0] }
    return permissoesFromArray(cargo.permissoes)
  },
  ['user-permissions'],
  { revalidate: 30, tags: ['user-permissions'] }
)

/**
 * Resolve as permissões efetivas do usuário logado.
 * Prioridade: permissões customizadas > cargo > nenhuma.
 * Cacheado com unstable_cache (30s) + React cache (intra-request).
 * Se o usuário não tem perfil ainda (primeiro admin), retorna acesso total.
 */
export const getPermissoesEfetivas = cache(async (): Promise<PermMap> => {
  const user = await getAuthenticatedUser()
  if (!user) return permissoesVazias()
  return withSupabaseCookieContext(() => getPermissoesEfetivasCached(user.id))
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
  return Object.fromEntries(
    ['dashboard','materias_primas','fornecedores','facas','estoque',
     'vendas','clientes','ordens_compra','usuarios','cargos'].map((k) => [k, full])
  ) as PermMap
}
