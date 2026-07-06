'use client'

/**
 * Hooks de leitura por recurso. Cada hook:
 * - usa `qk.<recurso>` como queryKey
 * - chama a Server Action correspondente como queryFn
 * - aceita `initialData` opcional (vinda do RSC) — permite hidratação instantânea
 * - é invalidado automaticamente pelo `RealtimeProvider` quando a tabela muda
 */

import { useQuery } from '@tanstack/react-query'

import { qk } from '@/lib/query/keys'
import { getMatériasPrimas, getMPDetalhe } from '@/lib/actions/materias-primas'
import { getFacas, getFacaDetalhe, getFacaBOM } from '@/lib/actions/facas'
import { getFornecedores } from '@/lib/actions/fornecedores'
import { getClientes } from '@/lib/actions/clientes'
import { getVendas } from '@/lib/actions/vendas'
import { getOrcamentos } from '@/lib/actions/orcamentos'
import { getOrdensCompra, getFilaReposicaoList, getUsuariosParaRegistroOC } from '@/lib/actions/ordens-compra'
import { getConsumiveis } from '@/lib/actions/consumiveis'
import { listarGastos } from '@/lib/actions/gastos'
import { listarMovimentacoes } from '@/lib/actions/movimentacao'
import { listarTiposGasto } from '@/lib/actions/tipos-gasto'
import { listarBoletos } from '@/lib/actions/boletos'
import { getUsuarios } from '@/lib/actions/usuarios'
import { getCargos } from '@/lib/actions/cargos'
import { getCategoriasFaca } from '@/lib/actions/categorias-faca'
import { getCategoriasMateriaPrima } from '@/lib/actions/categorias-materia-prima'
import { getCategoriasConsumivel } from '@/lib/actions/categorias-consumivel'

import type {
  MateriaPrima,
  Faca,
  Fornecedor,
  Cliente,
  Pedido,
  Orcamento,
  Consumivel,
  Gasto,
  Boleto,
  BoletoTipo,
  Usuario,
  Cargo,
  CategoriaFacaDB,
  CategoriaMateriaPrimaDB,
  CategoriaConsumivelDB,
  TipoGastoDB,
  Movimentacao,
} from '@/types'
import type { MPDetalheData } from '@/lib/actions/materias-primas'
import type { FacaDetalheData } from '@/lib/actions/facas'

type Opts<T> = { initialData?: T }

function queryOptsWithInitialData<T>(opts: Opts<T>) {
  if (opts.initialData === undefined) return {}
  return {
    initialData: opts.initialData,
    staleTime: 60_000,
    refetchOnMount: false as const,
  }
}

export function useMateriasPrimas(opts: Opts<MateriaPrima[]> = {}) {
  return useQuery({
    queryKey: qk.materiasPrimas.list(),
    queryFn: () => getMatériasPrimas(),
    ...queryOptsWithInitialData(opts),
  })
}

export function useMPDetalhe(id: string, opts: Opts<MPDetalheData> = {}) {
  return useQuery({
    queryKey: qk.materiasPrimas.detalhe(id),
    queryFn: () => getMPDetalhe(id),
    initialData: opts.initialData,
    enabled: !!id,
  })
}

export function useFacas(opts: Opts<Faca[]> = {}) {
  return useQuery({
    queryKey: qk.facas.list(),
    queryFn: () => getFacas(120),
    ...queryOptsWithInitialData(opts),
  })
}

export function useFacaDetalhe(id: string, opts: Opts<FacaDetalheData> = {}) {
  return useQuery({
    queryKey: qk.facas.detalhe(id),
    queryFn: () => getFacaDetalhe(id),
    initialData: opts.initialData,
    enabled: !!id,
  })
}

/** BOM da faca — chave dentro do escopo da faca para ser invalidada em conjunto. */
export function useFacaBOM(facaId: string) {
  return useQuery({
    queryKey: [...qk.facas.detalhe(facaId), 'bom'] as const,
    queryFn: () => getFacaBOM(facaId),
    enabled: !!facaId,
  })
}

export function useFornecedores(opts: Opts<Fornecedor[]> = {}) {
  return useQuery({
    queryKey: qk.fornecedores.list(),
    queryFn: () => getFornecedores(80),
    ...queryOptsWithInitialData(opts),
  })
}

export function useClientes(opts: Opts<Cliente[]> = {}) {
  return useQuery({
    queryKey: qk.clientes.list(),
    queryFn: () => getClientes(120),
    initialData: opts.initialData,
  })
}

export function useVendas(opts: Opts<Pedido[]> = {}) {
  return useQuery({
    queryKey: qk.vendas.list(),
    queryFn: () => getVendas(80),
    initialData: opts.initialData,
  })
}

export function useOrcamentos(opts: Opts<Orcamento[]> = {}) {
  return useQuery({
    queryKey: qk.orcamentos.list(),
    queryFn: () => getOrcamentos(80),
    initialData: opts.initialData,
  })
}

export function useOrdensCompra(opts: Opts<Awaited<ReturnType<typeof getOrdensCompra>>> = {}) {
  return useQuery({
    queryKey: qk.ordensCompra.list(),
    queryFn: () => getOrdensCompra(),
    initialData: opts.initialData,
  })
}

/** Usuários ativos para registrar quem alterou OC — cache longo; compartilhado entre aberturas do modal. */
export function useUsuariosParaRegistroOC(
  opts: { enabled?: boolean; initialData?: Awaited<ReturnType<typeof getUsuariosParaRegistroOC>> } = {},
) {
  return useQuery({
    queryKey: qk.usuarios.registroOC(),
    queryFn: () => getUsuariosParaRegistroOC(),
    enabled: opts.enabled ?? true,
    staleTime: 5 * 60_000,
    gcTime: 15 * 60_000,
    initialData: opts.initialData,
  })
}

export function useFilaReposicao(opts: Opts<Awaited<ReturnType<typeof getFilaReposicaoList>>> = {}) {
  return useQuery({
    queryKey: qk.ordensCompra.fila(),
    queryFn: () => getFilaReposicaoList(),
    initialData: opts.initialData,
  })
}

export function useConsumiveis(opts: Opts<Consumivel[]> = {}) {
  return useQuery({
    queryKey: qk.consumiveis.list(),
    queryFn: () => getConsumiveis(120),
    initialData: opts.initialData,
  })
}

export function useGastos(opts: Opts<Gasto[]> = {}) {
  return useQuery({
    queryKey: qk.gastos.list(),
    queryFn: () => listarGastos(),
    initialData: opts.initialData,
  })
}

export function useMovimentacoes(opts: Opts<Movimentacao[]> = {}) {
  return useQuery({
    queryKey: qk.movimentacao.list(),
    queryFn: () => listarMovimentacoes(),
    initialData: opts.initialData,
  })
}

export function useTiposGasto(opts: Opts<TipoGastoDB[]> = {}) {
  return useQuery({
    queryKey: qk.tiposGasto.list(),
    queryFn: () => listarTiposGasto(),
    initialData: opts.initialData,
  })
}

export function useBoletos(tipo?: BoletoTipo, opts: Opts<Boleto[]> = {}) {
  return useQuery({
    queryKey: qk.boletos.list(tipo),
    queryFn: () => listarBoletos(tipo),
    initialData: opts.initialData,
  })
}

export function useUsuarios(opts: Opts<Usuario[]> = {}) {
  return useQuery({
    queryKey: qk.usuarios.list(),
    queryFn: () => getUsuarios(100),
    initialData: opts.initialData,
  })
}

export function useCargos(opts: Opts<Cargo[]> = {}) {
  return useQuery({
    queryKey: qk.cargos.list(),
    queryFn: () => getCargos(50),
    initialData: opts.initialData,
  })
}

export function useCategoriasFaca(opts: Opts<CategoriaFacaDB[]> = {}) {
  return useQuery({
    queryKey: qk.categorias.faca(),
    queryFn: () => getCategoriasFaca(),
    initialData: opts.initialData,
  })
}

export function useCategoriasMateriaPrima(opts: Opts<CategoriaMateriaPrimaDB[]> = {}) {
  return useQuery({
    queryKey: qk.categorias.materiaPrima(),
    queryFn: () => getCategoriasMateriaPrima(),
    ...queryOptsWithInitialData(opts),
  })
}

export function useCategoriasConsumivel(opts: Opts<CategoriaConsumivelDB[]> = {}) {
  return useQuery({
    queryKey: qk.categorias.consumivel(),
    queryFn: () => getCategoriasConsumivel(),
    initialData: opts.initialData,
  })
}
