'use server'

import { getPermissoesEfetivas } from '@/lib/auth'
import { permissoesParaVer } from '@/lib/permissoes-ver'

/**
 * Retorna apenas o campo `ver` de cada módulo para o usuário logado.
 * Preferir `PermissoesVerProvider` no layout (evita Server Action extra no cliente).
 */
export async function getMinhasPermissoesVer(): Promise<Record<string, boolean>> {
  const perms = await getPermissoesEfetivas()
  return permissoesParaVer(perms)
}
