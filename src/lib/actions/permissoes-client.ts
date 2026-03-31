'use server'

import { getPermissoesEfetivas } from '@/lib/auth'

/**
 * Retorna apenas o campo `ver` de cada módulo para o usuário logado.
 * Usado pelo Sidebar para ocultar itens de navegação sem permissão.
 */
export async function getMinhasPermissoesVer(): Promise<Record<string, boolean>> {
  const perms = await getPermissoesEfetivas()
  return Object.fromEntries(
    Object.entries(perms).map(([modulo, p]) => [modulo, p.ver])
  )
}
