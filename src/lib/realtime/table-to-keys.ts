import { qk } from '@/lib/query/keys'

/**
 * Mapa: tabela do Postgres → query keys do TanStack Query a invalidar quando
 * houver mudança naquela tabela. Uma tabela pode invalidar várias áreas
 * (ex.: `movimentacoes_estoque` afeta MP, facas, OCs).
 */
export const TABLE_TO_KEYS: Record<string, ReadonlyArray<readonly unknown[]>> = {
  // Estoque & catálogo
  materias_primas: [qk.materiasPrimas.all, qk.facas.all, qk.ordensCompra.all],
  facas: [qk.facas.all],
  faca_materias_primas: [qk.facas.all],
  movimentacoes_estoque: [qk.materiasPrimas.all, qk.facas.all, qk.ordensCompra.all],
  consumiveis: [qk.consumiveis.all],

  // Comercial
  pedidos: [qk.vendas.all, qk.metricas.all, qk.ordensCompra.all, qk.movimentacao.all],
  pedido_itens: [qk.vendas.all, qk.metricas.all],
  orcamentos: [qk.orcamentos.all],
  orcamento_itens: [qk.orcamentos.all],
  clientes: [qk.clientes.all, qk.vendas.all, qk.orcamentos.all],

  // Suprimentos
  fornecedores: [qk.fornecedores.all, qk.materiasPrimas.all, qk.ordensCompra.all],
  ordens_compra: [qk.ordensCompra.all, qk.materiasPrimas.all],
  ordem_compra_itens: [qk.ordensCompra.all],
  fila_reposicao: [qk.ordensCompra.all],
  fila_reposicao_itens: [qk.ordensCompra.all],

  // Financeiro
  gastos: [qk.gastos.all, qk.metricas.all, qk.movimentacao.all],
  entradas: [qk.entradas.all, qk.movimentacao.all],
  tipos_gasto: [qk.tiposGasto.all, qk.gastos.all, qk.metricas.all],
  boletos: [qk.boletos.all, qk.metricas.all, qk.movimentacao.all],
  boleto_parcelas: [qk.boletos.all, qk.gastos.all, qk.metricas.all, qk.movimentacao.all],

  // Pessoas
  usuarios_perfis: [qk.usuarios.all, qk.vendas.all, qk.orcamentos.all, qk.gastos.all],
  cargos: [qk.cargos.all, qk.usuarios.all],

  // Categorias
  categorias_faca: [qk.categorias.faca(), qk.facas.all],
  categorias_materia_prima: [qk.categorias.materiaPrima(), qk.materiasPrimas.all],
  categorias_consumivel: [qk.categorias.consumivel(), qk.consumiveis.all],
}

export const REALTIME_TABLES = Object.keys(TABLE_TO_KEYS)
