import type { CargoPermissao, ModuloKey } from '@/types'
import { MODULOS } from '@/types'

export type PermMap = Record<ModuloKey, { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }>
type PermRow = Pick<CargoPermissao, 'modulo' | 'ver' | 'criar' | 'editar' | 'deletar'>

export type PermColKey = 'ver' | 'criar' | 'editar' | 'deletar'

/**
 * Colunas ativas na matriz de permissões por módulo.
 * Módulos de somente leitura: dashboard, metricas, lucro.
 * Módulos sem criar/excluir: taxas_lucro, preco_venda.
 * Demais módulos: todas as quatro colunas.
 */
export function colunasPermissaoModulo(modulo: ModuloKey): PermColKey[] {
  if (modulo === 'dashboard') return ['ver']
  if (modulo === 'metricas') return ['ver']
  if (modulo === 'lucro') return ['ver']
  if (modulo === 'taxas_lucro') return ['ver', 'editar']
  if (modulo === 'preco_venda') return ['ver', 'editar']
  if (modulo === 'movimentacoes_estoque') return ['ver', 'editar']
  return ['ver', 'criar', 'editar', 'deletar']
}

export function permissoesVazias(): PermMap {
  return Object.fromEntries(
    MODULOS.map((m) => [m.key, { ver: false, criar: false, editar: false, deletar: false }])
  ) as PermMap
}

export function permissoesFromArray(arr: PermRow[]): PermMap {
  const base = permissoesVazias()
  const explicit = new Set<ModuloKey>()
  for (const p of arr) {
    base[p.modulo] = { ver: p.ver, criar: p.criar, editar: p.editar, deletar: p.deletar }
    explicit.add(p.modulo)
  }
  // Fallback defensivo: se `gastos` ainda não tiver linha própria em
  // `cargo_permissoes`, espelha a permissão de `ordens_compra` para manter
  // compatibilidade com bases antigas já existentes.
  if (!explicit.has('gastos') && explicit.has('ordens_compra')) {
    base.gastos = { ...base.ordens_compra }
  }
  return base
}

// Compara duas PermMap — true se forem idênticas
export function permissoesIguais(a: PermMap, b: PermMap): boolean {
  return MODULOS.every((m) => {
    const pa = a[m.key]
    const pb = b[m.key]
    return pa.ver === pb.ver && pa.criar === pb.criar && pa.editar === pb.editar && pa.deletar === pb.deletar
  })
}
