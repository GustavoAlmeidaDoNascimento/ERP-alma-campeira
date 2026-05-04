'use server'

import { getAuthenticatedUser, getPermissoesEfetivas, requireAuthenticatedUserId } from '@/lib/auth'
import { getMatériasPrimas, getMPDetalhe, type MPDetalheData } from '@/lib/actions/materias-primas'
import { getFornecedores } from '@/lib/actions/fornecedores'
import { getFacas, getFacaDetalhe, type FacaDetalheData } from '@/lib/actions/facas'
import { getCategoriasFaca } from '@/lib/actions/categorias-faca'
import { getCategoriasMateriaPrima } from '@/lib/actions/categorias-materia-prima'
import { getConsumiveis } from '@/lib/actions/consumiveis'
import { getCategoriasConsumivel } from '@/lib/actions/categorias-consumivel'
import { getVendas } from '@/lib/actions/vendas'
import { getOrcamentos } from '@/lib/actions/orcamentos'
import { getClientes } from '@/lib/actions/clientes'
import { getUsuarios, getUsuariosPerfisList } from '@/lib/actions/usuarios'
import { getCargos } from '@/lib/actions/cargos'
import { getFilaReposicaoList, getOrdensCompra } from '@/lib/actions/ordens-compra'

import { getMetricasVendas, getMetricasEstoque, getMetricasFinanceiro, type MetricasVendasData, type MetricasEstoqueData, type MetricasFinanceiroData } from '@/lib/actions/metricas'
import { listarGastos } from '@/lib/actions/gastos'
import { getAuditLogs, getAuditLogTabelas, getAuditLogUsuarios, type AuditLog } from '@/lib/actions/auditoria'
import { defaultDateRange } from '@/lib/metricas-periodos'
import { getTaxasLucroConfig, type TaxasLucroConfig } from '@/lib/actions/app-config'
import { getEmpresa } from '@/lib/actions/empresa'
import type { MateriaPrima, Fornecedor, Faca, CategoriaFacaDB, CategoriaMateriaPrimaDB, Pedido, Orcamento, Cliente, Usuario, Cargo, Consumivel, CategoriaConsumivelDB, Empresa, Gasto } from '@/types'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }

export type ErpTabData =
  | {
      kind: 'mp-detalhe'
      detalhe: MPDetalheData
      perm: Perm
      permEditarMov: boolean
      permVerMov: boolean
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
      usuarios: { id: string; nome: string }[]
      /** auth user id — mesmo id da lista `usuarios` (perfil). */
      usuarioAtualId: string
      permEditarMovAdmin: boolean
    }
  | {
      kind: 'fornecedores'
      fornecedores: Fornecedor[]
      perm: Perm
    }
  | {
      kind: 'ordens-compra'
      fila: Awaited<ReturnType<typeof getFilaReposicaoList>>
      ordens: Awaited<ReturnType<typeof getOrdensCompra>>
      perm: Perm
    }
  | {
      kind: 'vendas'
      pedidos: Pedido[]
      clientes: Cliente[]
      facas: Faca[]
      usuarios: { id: string; nome: string }[]
      perm: Perm
      usuarioLogadoId: string | null
    }
  | {
      kind: 'orcamentos'
      orcamentos: Orcamento[]
      clientes: Cliente[]
      facas: Faca[]
      usuarios: { id: string; nome: string }[]
      perm: Perm
      permVendasCriar: boolean
      usuarioLogadoId: string | null
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
      empresa: Empresa | null
    }
  | {
      kind: 'metricas-relatorios'
      vendas: MetricasVendasData
      estoque: MetricasEstoqueData
      financeiro: MetricasFinanceiroData
      atividade: {
        logs: AuditLog[]
        total: number
        tabelas: string[]
        usuarios: { id: string; nome: string }[]
      }
    }
  | {
      kind: 'gastos'
      gastos: Gasto[]
      usuarios: { id: string; nome: string }[]
      usuarioLogadoId: string | null
      perm: Perm
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
    const permEditarMov = !!(perms as any).movimentacoes_estoque?.editar
    const permVerMov = !!(perms as any).movimentacoes_estoque?.ver
    return { kind: 'mp-detalhe', detalhe, perm, permEditarMov, permVerMov }
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
    const taxasLucro = verLucro ? await getTaxasLucroConfig() : { taxa_producao: 0, margem_lucro: 0, taxa_comissao: 0 }
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
    const [perms, detalhe, materiasPrimas, categorias, todosUsuarios, usuarioAtualId] = await Promise.all([
      getPermissoesEfetivas(),
      getFacaDetalhe(facaId),
      getMatériasPrimas(200),
      getCategoriasFaca(),
      getUsuarios(200),
      requireAuthenticatedUserId(),
    ])
    const perm = perms.facas as Perm
    assertAllowed(perm, 'facas')
    const usuarios = todosUsuarios.map((u: Usuario) => ({ id: u.id, nome: u.nome }))
    const permEditarMovAdmin = !!(perms as any).usuarios?.editar
    return {
      kind: 'faca-detalhe',
      detalhe,
      materiasPrimas,
      categorias,
      perm,
      verPrecoVenda: perms.preco_venda.ver,
      usuarios,
      usuarioAtualId,
      permEditarMovAdmin,
    }
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
      getFilaReposicaoList(),
      getOrdensCompra(),
    ])
    const perm = perms.ordens_compra as Perm
    assertAllowed(perm, 'ordens_compra')
    return { kind: 'ordens-compra', fila, ordens, perm }
  }

  if (path === '/vendas') {
    const [perms, pedidos, clientes, facas, usuarios, authUser] = await Promise.all([
      getPermissoesEfetivas(),
      getVendas(80),
      getClientes(80),
      getFacas(120),
      getUsuariosPerfisList(),
      getAuthenticatedUser(),
    ])
    const perm = perms.vendas as Perm
    assertAllowed(perm, 'vendas')
    return {
      kind: 'vendas',
      pedidos,
      clientes,
      facas,
      usuarios,
      perm,
      usuarioLogadoId: authUser?.id ?? null,
    }
  }

  if (path === '/orcamentos') {
    const [perms, orcamentos, clientes, facas, usuarios, authUser] = await Promise.all([
      getPermissoesEfetivas(),
      getOrcamentos(80),
      getClientes(80),
      getFacas(120),
      getUsuariosPerfisList(),
      getAuthenticatedUser(),
    ])
    const perm = (perms as Record<string, Perm>).orcamentos
    assertAllowed(perm, 'orcamentos')
    return {
      kind: 'orcamentos',
      orcamentos,
      clientes,
      facas,
      usuarios,
      perm,
      permVendasCriar: !!perms.vendas?.criar,
      usuarioLogadoId: authUser?.id ?? null,
    }
  }

  if (path === '/gastos') {
    const [perms, gastos, usuarios, authUser] = await Promise.all([
      getPermissoesEfetivas(),
      listarGastos(),
      getUsuariosPerfisList(),
      getAuthenticatedUser(),
    ])
    const perm = (perms as Record<string, Perm>).gastos
    assertAllowed(perm, 'gastos')
    return { kind: 'gastos', gastos, usuarios, usuarioLogadoId: authUser?.id ?? null, perm }
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
    const [perms, categorias, categoriasMateriaPrima, categoriasConsumivel, taxasLucro, empresa] = await Promise.all([
      getPermissoesEfetivas(),
      getCategoriasFaca(),
      getCategoriasMateriaPrima(),
      getCategoriasConsumivel(),
      getTaxasLucroConfig(),
      getEmpresa().catch(() => null),
    ])
    return {
      kind: 'configuracoes',
      categorias,
      categoriasMateriaPrima,
      categoriasConsumivel,
      taxasLucro,
      permTaxasLucro: perms.taxas_lucro as Perm,
      empresa,
    }
  }

  const metricasRelatoriosPaths = new Set([
    '/metricas',
    '/metricas/relatorios',
    '/metricas/vendas',
    '/metricas/estoque',
    '/metricas/conciliacao',
  ])
  if (metricasRelatoriosPaths.has(path)) {
    const perms = await getPermissoesEfetivas()
    const perm = perms.metricas as Perm
    assertAllowed(perm, 'metricas')
    const range = defaultDateRange()
    const [vendas, estoque, financeiro, auditoria, tabelas, usuarios] = await Promise.all([
      getMetricasVendas(range),
      getMetricasEstoque(range),
      getMetricasFinanceiro(range),
      getAuditLogs({ limit: 100 }),
      getAuditLogTabelas(),
      getAuditLogUsuarios(),
    ])
    return {
      kind: 'metricas-relatorios',
      vendas,
      estoque,
      financeiro,
      atividade: {
        logs: auditoria.logs,
        total: auditoria.total,
        tabelas,
        usuarios,
      },
    }
  }

  throw new Error(`Rota de aba não suportada: ${path}`)
}

