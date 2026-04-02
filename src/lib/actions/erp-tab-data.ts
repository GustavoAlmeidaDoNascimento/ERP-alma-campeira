'use server'

import { getPermissoesEfetivas } from '@/lib/auth'
import { getMatériasPrimas, getMPDetalhe, type MPDetalheData } from '@/lib/actions/materias-primas'
import { getFornecedores } from '@/lib/actions/fornecedores'
import { getFacas, getFacaDetalhe, type FacaDetalheData } from '@/lib/actions/facas'
import { getCategoriasFaca } from '@/lib/actions/categorias-faca'
import { getCategoriasMateriaPrima } from '@/lib/actions/categorias-materia-prima'
import { getConsumiveis } from '@/lib/actions/consumiveis'
import { getCategoriasConsumivel } from '@/lib/actions/categorias-consumivel'
import { getVendas } from '@/lib/actions/vendas'
import { getClientes } from '@/lib/actions/clientes'
import { getUsuarios } from '@/lib/actions/usuarios'
import { getCargos } from '@/lib/actions/cargos'
import { getFilaReposicao, getOrdensCompra } from '@/lib/actions/ordens-compra'

import { getMetricasVendas, getMetricasEstoque, type MetricasVendasData, type MetricasEstoqueData } from '@/lib/actions/metricas'
import { getConciliacao, type ResultadoConciliacao } from '@/lib/actions/conciliacao'
import { getTaxasLucroConfig, type TaxasLucroConfig } from '@/lib/actions/app-config'
import type { MateriaPrima, Fornecedor, Faca, CategoriaFacaDB, CategoriaMateriaPrimaDB, Pedido, Cliente, Usuario, Cargo, Consumivel, CategoriaConsumivelDB } from '@/types'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }

export type ErpTabData =
  | {
      kind: 'mp-detalhe'
      detalhe: MPDetalheData
      perm: Perm
    }
  | {
      kind: 'materias-primas'
      materiasPrimas: MateriaPrima[]
      fornecedores: Fornecedor[]
      categoriasMateriaPrima: CategoriaMateriaPrimaDB[]
      perm: Perm
    }
  | {
      kind: 'facas'
      facas: Faca[]
      categorias: CategoriaFacaDB[]
      materiasPrimas: MateriaPrima[]
      perm: Perm
      verPrecoVenda: boolean
      verLucro: boolean
      taxasLucro: TaxasLucroConfig
    }
  | {
      kind: 'faca-detalhe'
      detalhe: FacaDetalheData
      materiasPrimas: MateriaPrima[]
      categorias: CategoriaFacaDB[]
      perm: Perm
      verPrecoVenda: boolean
    }
  | {
      kind: 'fornecedores'
      fornecedores: Fornecedor[]
      perm: Perm
    }
  | {
      kind: 'ordens-compra'
      fila: Awaited<ReturnType<typeof getFilaReposicao>>
      ordens: Awaited<ReturnType<typeof getOrdensCompra>>
      perm: Perm
    }
  | {
      kind: 'vendas'
      pedidos: Pedido[]
      clientes: Cliente[]
      facas: Faca[]
      perm: Perm
    }
  | {
      kind: 'clientes'
      clientes: Cliente[]
      perm: Perm
    }
  | {
      kind: 'usuarios'
      usuarios: Usuario[]
      cargos: Cargo[]
      perm: Perm
    }
  | {
      kind: 'cargos'
      cargos: Cargo[]
      perm: Perm
    }
  | {
      kind: 'consumiveis'
      consumiveis: Consumivel[]
      fornecedores: Fornecedor[]
      categoriasConsumivel: CategoriaConsumivelDB[]
      perm: Perm
    }
  | {
      kind: 'configuracoes'
      categorias: CategoriaFacaDB[]
      categoriasMateriaPrima: CategoriaMateriaPrimaDB[]
      categoriasConsumivel: CategoriaConsumivelDB[]
      taxasLucro: TaxasLucroConfig
      permTaxasLucro: Perm
    }
  | {
      kind: 'metricas-vendas'
      data: MetricasVendasData
    }
  | {
      kind: 'metricas-estoque'
      data: MetricasEstoqueData
    }
  | {
      kind: 'metricas-conciliacao'
      data: ResultadoConciliacao
    }

function assertAllowed(perm: Perm | undefined, label: string): void {
  if (!perm || !perm.ver) throw new Error(`Acesso negado: ${label}.`)
}

function normalizePathOnly(href: string) {
  const [pathOnly] = href.split('?')
  return pathOnly
}

export async function getErpTabData(href: string): Promise<ErpTabData> {
  const path = normalizePathOnly(href)

  // Detalhe de matéria-prima: /materias-primas/{uuid}
  const mpDetalheMatch = path.match(/^\/materias-primas\/([a-f0-9-]+)$/)
  if (mpDetalheMatch) {
    const mpId = mpDetalheMatch[1]
    const [perms, detalhe] = await Promise.all([
      getPermissoesEfetivas(),
      getMPDetalhe(mpId),
    ])
    const perm = perms.materias_primas as Perm
    assertAllowed(perm, 'materias_primas')
    return { kind: 'mp-detalhe', detalhe, perm }
  }

  if (path === '/materias-primas') {
    const [perms, materiasPrimas, fornecedores, categoriasMateriaPrima] = await Promise.all([
      getPermissoesEfetivas(),
      getMatériasPrimas(120),
      getFornecedores(80),
      getCategoriasMateriaPrima(),
    ])
    const perm = perms.materias_primas as Perm
    assertAllowed(perm, 'materias_primas')
    return { kind: 'materias-primas', materiasPrimas, fornecedores, categoriasMateriaPrima, perm }
  }

  if (path === '/facas') {
    const [perms, facas, categorias, materiasPrimas] = await Promise.all([
      getPermissoesEfetivas(),
      getFacas(120),
      getCategoriasFaca(),
      getMatériasPrimas(200),
    ])
    const perm = perms.facas as Perm
    assertAllowed(perm, 'facas')
    const verLucro = perms.lucro.ver
    const taxasLucro = verLucro ? await getTaxasLucroConfig() : { taxa_producao: 0, taxa_comissao: 0 }
    return {
      kind: 'facas',
      facas,
      categorias,
      materiasPrimas,
      perm,
      verPrecoVenda: perms.preco_venda.ver,
      verLucro,
      taxasLucro,
    }
  }

  // Detalhe de faca: /facas/{uuid}
  const facaDetalheMatch = path.match(/^\/facas\/([a-f0-9-]+)$/)
  if (facaDetalheMatch) {
    const facaId = facaDetalheMatch[1]
    const [perms, detalhe, materiasPrimas, categorias] = await Promise.all([
      getPermissoesEfetivas(),
      getFacaDetalhe(facaId),
      getMatériasPrimas(200),
      getCategoriasFaca(),
    ])
    const perm = perms.facas as Perm
    assertAllowed(perm, 'facas')
    return { kind: 'faca-detalhe', detalhe, materiasPrimas, categorias, perm, verPrecoVenda: perms.preco_venda.ver }
  }

  if (path === '/fornecedores') {
    const [perms, fornecedores] = await Promise.all([
      getPermissoesEfetivas(),
      getFornecedores(120),
    ])
    const perm = perms.fornecedores as Perm
    assertAllowed(perm, 'fornecedores')
    return { kind: 'fornecedores', fornecedores, perm }
  }

  if (path === '/ordens-compra') {
    const [perms, fila, ordens] = await Promise.all([
      getPermissoesEfetivas(),
      getFilaReposicao(),
      getOrdensCompra(),
    ])
    const perm = perms.ordens_compra as Perm
    assertAllowed(perm, 'ordens_compra')
    return { kind: 'ordens-compra', fila, ordens, perm }
  }

  if (path === '/vendas') {
    const [perms, pedidos, clientes, facas] = await Promise.all([
      getPermissoesEfetivas(),
      getVendas(80),
      getClientes(80),
      getFacas(120),
    ])
    const perm = perms.vendas as Perm
    assertAllowed(perm, 'vendas')
    return { kind: 'vendas', pedidos, clientes, facas, perm }
  }

  if (path === '/clientes') {
    const [perms, clientes] = await Promise.all([
      getPermissoesEfetivas(),
      getClientes(120),
    ])
    const perm = perms.clientes as Perm
    assertAllowed(perm, 'clientes')
    return { kind: 'clientes', clientes, perm }
  }

  if (path === '/usuarios') {
    const [perms, usuarios, cargos] = await Promise.all([
      getPermissoesEfetivas(),
      getUsuarios(120),
      getCargos(80),
    ])
    const perm = perms.usuarios as Perm
    assertAllowed(perm, 'usuarios')
    return { kind: 'usuarios', usuarios, cargos, perm }
  }

  if (path === '/cargos') {
    const [perms, cargos] = await Promise.all([
      getPermissoesEfetivas(),
      getCargos(120),
    ])
    const perm = perms.cargos as Perm
    assertAllowed(perm, 'cargos')
    return { kind: 'cargos', cargos, perm }
  }

  if (path === '/consumiveis') {
    const [perms, consumiveis, fornecedores, categoriasConsumivel] = await Promise.all([
      getPermissoesEfetivas(),
      getConsumiveis(120),
      getFornecedores(80),
      getCategoriasConsumivel(),
    ])
    const perm = perms.consumiveis as Perm
    assertAllowed(perm, 'consumiveis')
    return { kind: 'consumiveis', consumiveis, fornecedores, categoriasConsumivel, perm }
  }

  if (path === '/configuracoes') {
    const [perms, categorias, categoriasMateriaPrima, categoriasConsumivel, taxasLucro] = await Promise.all([
      getPermissoesEfetivas(),
      getCategoriasFaca(),
      getCategoriasMateriaPrima(),
      getCategoriasConsumivel(),
      getTaxasLucroConfig(),
    ])
    return {
      kind: 'configuracoes',
      categorias,
      categoriasMateriaPrima,
      categoriasConsumivel,
      taxasLucro,
      permTaxasLucro: perms.taxas_lucro as Perm,
    }
  }

  if (path === '/metricas' || path === '/metricas/vendas') {
    const perms = await getPermissoesEfetivas()
    const perm = perms.metricas as Perm
    assertAllowed(perm, 'metricas')
    const data = await getMetricasVendas()
    return { kind: 'metricas-vendas', data }
  }

  if (path === '/metricas/estoque') {
    const perms = await getPermissoesEfetivas()
    const perm = perms.metricas as Perm
    assertAllowed(perm, 'metricas')
    const data = await getMetricasEstoque()
    return { kind: 'metricas-estoque', data }
  }

  if (path === '/metricas/conciliacao') {
    const perms = await getPermissoesEfetivas()
    const perm = perms.metricas as Perm
    assertAllowed(perm, 'metricas')
    const data = await getConciliacao()
    return { kind: 'metricas-conciliacao', data }
  }

  throw new Error(`Rota de aba não suportada: ${path}`)
}

