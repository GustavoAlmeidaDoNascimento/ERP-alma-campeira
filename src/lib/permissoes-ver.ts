import type { PermMap } from '@/lib/permissoes'

/** Mapa módulo → pode ver (para sidebar e navegação). */
export function permissoesParaVer(perms: PermMap): Record<string, boolean> {
  return Object.fromEntries(
    Object.entries(perms).map(([modulo, p]) => [modulo, p.ver]),
  )
}
