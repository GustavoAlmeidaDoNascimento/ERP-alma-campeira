/**
 * Fábrica hierárquica de query keys do TanStack Query.
 *
 * Convenção: `qk.<recurso>.all` é a chave-base; sub-chaves estendem `all`.
 * Para invalidar tudo de um recurso, use `qk.<recurso>.all`.
 */
export const qk = {
  materiasPrimas: {
    all: ['materias-primas'] as const,
    list: () => [...qk.materiasPrimas.all, 'list'] as const,
    /** Lista com limite maior (ex.: modal OC). Chave distinta do `list` 120. */
    listLimit: (limit: number) => [...qk.materiasPrimas.all, 'list', limit] as const,
    detalhe: (id: string) => [...qk.materiasPrimas.all, 'detalhe', id] as const,
  },
  facas: {
    all: ['facas'] as const,
    list: () => [...qk.facas.all, 'list'] as const,
    detalhe: (id: string) => [...qk.facas.all, 'detalhe', id] as const,
  },
  fornecedores: {
    all: ['fornecedores'] as const,
    list: () => [...qk.fornecedores.all, 'list'] as const,
  },
  clientes: {
    all: ['clientes'] as const,
    list: () => [...qk.clientes.all, 'list'] as const,
  },
  vendas: {
    all: ['vendas'] as const,
    list: () => [...qk.vendas.all, 'list'] as const,
  },
  orcamentos: {
    all: ['orcamentos'] as const,
    list: () => [...qk.orcamentos.all, 'list'] as const,
  },
  ordensCompra: {
    all: ['ordens-compra'] as const,
    list: () => [...qk.ordensCompra.all, 'list'] as const,
    fila: () => [...qk.ordensCompra.all, 'fila'] as const,
  },
  consumiveis: {
    all: ['consumiveis'] as const,
    list: () => [...qk.consumiveis.all, 'list'] as const,
  },
  gastos: {
    all: ['gastos'] as const,
    list: () => [...qk.gastos.all, 'list'] as const,
  },
  entradas: {
    all: ['entradas'] as const,
    list: () => [...qk.entradas.all, 'list'] as const,
  },
  movimentacao: {
    all: ['movimentacao'] as const,
    list: () => [...qk.movimentacao.all, 'list'] as const,
  },
  tiposGasto: {
    all: ['tipos-gasto'] as const,
    list: () => [...qk.tiposGasto.all, 'list'] as const,
  },
  boletos: {
    all: ['boletos'] as const,
    list: (tipo?: 'entrada' | 'saida') =>
      (tipo ? [...qk.boletos.all, 'list', tipo] : [...qk.boletos.all, 'list']) as readonly unknown[],
  },
  usuarios: {
    all: ['usuarios'] as const,
    list: () => [...qk.usuarios.all, 'list'] as const,
    /** Lista para "Quem registrou" em OCs (usuarios_perfis ativos). */
    registroOC: () => [...qk.usuarios.all, 'registro-oc'] as const,
  },
  cargos: {
    all: ['cargos'] as const,
    list: () => [...qk.cargos.all, 'list'] as const,
  },
  metricas: {
    all: ['metricas'] as const,
  },
  categorias: {
    all: ['categorias'] as const,
    faca: () => [...qk.categorias.all, 'faca'] as const,
    materiaPrima: () => [...qk.categorias.all, 'materia-prima'] as const,
    consumivel: () => [...qk.categorias.all, 'consumivel'] as const,
  },
} as const
