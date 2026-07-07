import { qk } from '@/lib/query/keys'

type QueryKey = readonly unknown[]

export const RESOURCE_TO_KEYS = {
  clientes: [qk.clientes.all, qk.vendas.all, qk.orcamentos.all],
  fornecedores: [qk.fornecedores.all, qk.materiasPrimas.all, qk.consumiveis.all, qk.ordensCompra.all],
  materias_primas: [qk.materiasPrimas.all, qk.facas.all, qk.ordensCompra.all],
  facas: [qk.facas.all],
  consumiveis: [qk.consumiveis.all],
  vendas: [qk.vendas.all, qk.metricas.all, qk.ordensCompra.all, qk.movimentacao.all],
  orcamentos: [qk.orcamentos.all],
  ordens_compra: [qk.ordensCompra.all, qk.materiasPrimas.all, qk.gastos.all, qk.boletos.all],
  movimentacao: [qk.movimentacao.all, qk.gastos.all, qk.entradas.all, qk.metricas.all],
  gastos: [qk.gastos.all, qk.metricas.all, qk.movimentacao.all, qk.tiposGasto.all],
  boletos: [qk.boletos.all, qk.gastos.all, qk.metricas.all, qk.movimentacao.all],
  usuarios_perfis: [
    qk.usuarios.all,
    qk.usuarios.registroOC(),
    qk.vendas.all,
    qk.orcamentos.all,
    qk.gastos.all,
    qk.ordensCompra.all,
  ],
  cargos: [qk.cargos.all, qk.usuarios.all],
  categorias_faca: [qk.categorias.faca(), qk.facas.all],
  categorias_materia_prima: [qk.categorias.materiaPrima(), qk.materiasPrimas.all, qk.ordensCompra.all],
  categorias_consumivel: [qk.categorias.consumivel(), qk.consumiveis.all],
  tipos_gasto: [qk.tiposGasto.all, qk.gastos.all, qk.metricas.all],
} as const satisfies Record<string, ReadonlyArray<QueryKey>>

export type RealtimeResource = keyof typeof RESOURCE_TO_KEYS

const PATH_TO_RESOURCES: Array<{ prefix: string; resources: readonly RealtimeResource[] }> = [
  { prefix: '/clientes', resources: ['clientes'] },
  { prefix: '/fornecedores', resources: ['fornecedores'] },
  { prefix: '/materias-primas', resources: ['materias_primas'] },
  { prefix: '/facas', resources: ['facas'] },
  { prefix: '/consumiveis', resources: ['consumiveis'] },
  { prefix: '/vendas', resources: ['vendas'] },
  { prefix: '/orcamentos', resources: ['orcamentos'] },
  { prefix: '/ordens-compra', resources: ['ordens_compra'] },
  { prefix: '/movimentacao', resources: ['movimentacao'] },
  { prefix: '/gastos', resources: ['gastos'] },
  { prefix: '/boletos', resources: ['boletos'] },
  { prefix: '/usuarios', resources: ['usuarios_perfis', 'cargos'] },
  { prefix: '/cargos', resources: ['cargos', 'usuarios_perfis'] },
  {
    prefix: '/configuracoes',
    resources: ['categorias_faca', 'categorias_materia_prima', 'categorias_consumivel'],
  },
]

function dedupeQueryKeys(keys: ReadonlyArray<QueryKey>): QueryKey[] {
  const seen = new Set<string>()
  const deduped: QueryKey[] = []

  for (const key of keys) {
    const serialized = JSON.stringify(key)
    if (seen.has(serialized)) continue
    seen.add(serialized)
    deduped.push(key)
  }

  return deduped
}

export function getQueryKeysForResources(resources: ReadonlyArray<RealtimeResource>): QueryKey[] {
  return dedupeQueryKeys(
    resources.flatMap((resource) => (RESOURCE_TO_KEYS[resource] ?? []) as ReadonlyArray<QueryKey>)
  )
}

export function getResourcesForPath(path: string): RealtimeResource[] {
  const normalizedPath = path || '/'
  const matches = PATH_TO_RESOURCES.filter(({ prefix }) => normalizedPath.startsWith(prefix))
  return Array.from(new Set(matches.flatMap(({ resources }) => resources)))
}
