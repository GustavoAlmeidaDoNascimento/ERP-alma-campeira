'use server'

import { Prisma } from '@prisma/client'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import { fetchTaxasLucroConfig } from '@/lib/cache/list-data'
import { prisma } from '@/lib/prisma'
import type { StatusPedido, StatusOC, TipoGasto, FormaPagamento } from '@/types'
import { type DateRange, defaultDateRange } from '@/lib/metricas-periodos'

// ── Vendas Types ──────────────────────────────────────────────────────────────

export type KpiVendas = {
  faturamentoTotal: number
  totalPedidos: number
  ticketMedio: number
  taxaEntrega: number
  pedidosEntregues: number
}

export type VendasPorMes = {
  mes: string
  mesLabel: string
  totalValor: number
  totalPedidos: number
  totalItens: number
}

export type ClienteRanking = {
  clienteId: string | null
  clienteNome: string
  clienteTipo: string
  totalValor: number
  totalPedidos: number
  participacao: number
}

export type ProdutoRanking = {
  facaId: string
  facaCodigo: string
  facaNome: string
  totalValor: number
  totalQuantidade: number
  participacao: number
}

export type StatusPipeline = {
  status: StatusPedido
  quantidade: number
  valorTotal: number
  percentual: number
}

export type VendasPorTipoCliente = {
  tipo: string
  totalValor: number
  totalPedidos: number
  percentual: number
}

export type VendedorRanking = {
  vendedorId: string | null
  vendedorNome: string
  totalValor: number
  totalPedidos: number
  participacao: number
}

export type RelatorioMesVendedor = {
  mes: string
  mesLabel: string
  totalValor: number
  totalPedidos: number
  comissao: number
}

export type RelatorioVendedor = {
  vendedorId: string | null
  vendedorNome: string
  totalValor: number
  totalPedidos: number
  totalComissao: number
  porMes: RelatorioMesVendedor[]
}

export type MetricasVendasData = {
  kpi: KpiVendas
  vendasPorMes: VendasPorMes[]
  rankingClientes: ClienteRanking[]
  rankingProdutos: ProdutoRanking[]
  pipeline: StatusPipeline[]
  vendasPorTipo: VendasPorTipoCliente[]
  rankingVendedores: VendedorRanking[]
  relatorioVendedores: RelatorioVendedor[]
  taxaComissao: number
  dateRange: DateRange
}

// ── Estoque Types ─────────────────────────────────────────────────────────────

export type KpiEstoque = {
  totalSkusFacas: number
  totalSkusMp: number
  facasCriticas: number
  facasAtencao: number
  mpCriticas: number
  mpAtencao: number
}

export type SaudeEstoqueFaca = {
  id: string
  codigo: string
  nome: string
  estoqueAtual: number
  estoqueMinimo: number
  status: 'ok' | 'atencao' | 'critico'
  coberturaDias: number | null
}

export type SaudeEstoqueMp = {
  id: string
  codigo: string
  nome: string
  fornecedorNome: string | null
  estoqueAtual: number
  estoqueMinimo: number
  status: 'ok' | 'atencao' | 'critico'
}

export type MovimentacaoRecente = {
  id: string
  tipo: string
  itemNome: string
  itemCodigo: string
  quantidade: number
  createdAt: string
  usuarioNome: string | null
}

export type ConsumoBom = {
  facaId: string
  facaCodigo: string
  facaNome: string
  materiais: {
    mpId: string
    mpCodigo: string
    mpNome: string
    quantidade: number
    custoUnitario: number
    custoTotal: number
  }[]
  custoTotalFaca: number
}

export type ResumoOC = {
  status: StatusOC
  quantidade: number
  valorTotal: number
}

export type AlertaEstoque = {
  tipo: 'zero' | 'abaixo_minimo'
  itemTipo: 'faca' | 'materia_prima'
  itemId: string
  itemCodigo: string
  itemNome: string
  detalhe: string
}

export type RankingUsuarioEstoque = {
  usuarioId: string
  usuarioNome: string
  totalMovimentacoes: number
  entradas: number
  saidas: number
}

export type MetricasEstoqueData = {
  kpi: KpiEstoque
  saudeFacas: SaudeEstoqueFaca[]
  saudeMp: SaudeEstoqueMp[]
  movimentacoesRecentes: MovimentacaoRecente[]
  rankingUsuarios: RankingUsuarioEstoque[]
  consumoBom: ConsumoBom[]
  resumoOC: ResumoOC[]
  alertas: AlertaEstoque[]
  dateRange: DateRange
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function estoqueStatus(atual: number, minimo: number): 'ok' | 'atencao' | 'critico' {
  if (atual === 0) return 'critico'
  if (atual <= minimo) return 'atencao'
  return 'ok'
}

const STATUS_ORDER: Record<string, number> = { critico: 0, atencao: 1, ok: 2 }

function mesLabel(yyyymm: string): string {
  const [y, m] = yyyymm.split('-')
  const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
  return `${meses[parseInt(m, 10) - 1]}/${y.slice(2)}`
}

function numberFrom(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value == null) return 0
  if (typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
    return value.toNumber()
  }
  return Number(value) || 0
}

type MovimentacaoRecenteRow = {
  id: string
  tipo: string
  quantidade: number
  createdAt: Date | string
  usuarioId: string | null
  materiaPrima: {
    codigo: string
    nome: string
  } | null
  faca: {
    codigo: string
    nome: string
  } | null
}

// ── Vendas Queries ────────────────────────────────────────────────────────────

export async function getMetricasVendas(dateRange: DateRange = defaultDateRange()): Promise<MetricasVendasData> {
  await requireAuthenticatedUserId()
  await assertPermissao('metricas', 'ver')

  const [pedidos, taxasConfig] = await Promise.all([
    prisma.pedido.findMany({
      where: {
        dataPedido: {
          gte: dateRange.desde,
          lte: dateRange.ate,
        },
      },
      select: {
        id: true,
        codigo: true,
        clienteId: true,
        vendedorId: true,
        dataPedido: true,
        status: true,
        valorTotal: true,
        entregueAt: true,
        createdAt: true,
        cliente: {
          select: {
            id: true,
            nome: true,
            tipo: true,
            tipoDocumento: true,
            documento: true,
            cidade: true,
            estado: true,
          },
        },
        vendedor: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    }),
    fetchTaxasLucroConfig(),
  ])

  const pedidoIds = pedidos.map((p) => p.id)
  const itens = pedidoIds.length
    ? await prisma.pedidoItem.findMany({
        where: { pedidoId: { in: pedidoIds } },
        select: {
          id: true,
          pedidoId: true,
          facaId: true,
          quantidade: true,
          precoUnitario: true,
          subtotal: true,
          faca: {
            select: {
              id: true,
              codigo: true,
              nome: true,
            },
          },
        },
      })
    : []

  const taxaComissao = numberFrom(taxasConfig.taxa_comissao)

    // ── KPIs ──
    const faturamentoTotal = pedidos.reduce((s, p) => s + numberFrom(p.valorTotal), 0)
    const totalPedidos = pedidos.length
    const ticketMedio = totalPedidos > 0 ? faturamentoTotal / totalPedidos : 0
    const pedidosEntregues = pedidos.filter((p) => p.status === 'entregue').length
    const taxaEntrega = totalPedidos > 0 ? (pedidosEntregues / totalPedidos) * 100 : 0

    const kpi: KpiVendas = { faturamentoTotal, totalPedidos, ticketMedio, taxaEntrega, pedidosEntregues }

    // ── Vendas por Mês ──
    const mesMap = new Map<string, { totalValor: number; totalPedidos: number; totalItens: number }>()

    for (const p of pedidos) {
      const d = new Date(p.dataPedido)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const entry = mesMap.get(key) ?? { totalValor: 0, totalPedidos: 0, totalItens: 0 }
      entry.totalValor += numberFrom(p.valorTotal)
      entry.totalPedidos += 1
      const pedidoItens = itens.filter((i) => i.pedidoId === p.id)
      entry.totalItens += pedidoItens.reduce((s, i) => s + Number(i.quantidade), 0)
      mesMap.set(key, entry)
    }

    const vendasPorMes: VendasPorMes[] = Array.from(mesMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([mes, v]) => ({ mes, mesLabel: mesLabel(mes), ...v }))

    // ── Ranking Clientes ──
    const clienteMap = new Map<string, { nome: string; tipo: string; totalValor: number; totalPedidos: number }>()
    for (const p of pedidos) {
      const cid = p.clienteId ?? '__sem_cliente__'
      const cli = p.cliente
      const entry = clienteMap.get(cid) ?? {
        nome: cli?.nome ?? 'Sem cliente',
        tipo: cli?.tipo ?? '-',
        totalValor: 0,
        totalPedidos: 0,
      }
      entry.totalValor += numberFrom(p.valorTotal)
      entry.totalPedidos += 1
      clienteMap.set(cid, entry)
    }

    const rankingClientes: ClienteRanking[] = Array.from(clienteMap.entries())
      .map(([cid, c]) => ({
        clienteId: cid === '__sem_cliente__' ? null : cid,
        clienteNome: c.nome,
        clienteTipo: c.tipo,
        totalValor: c.totalValor,
        totalPedidos: c.totalPedidos,
        participacao: faturamentoTotal > 0 ? (c.totalValor / faturamentoTotal) * 100 : 0,
      }))
      .sort((a, b) => b.totalValor - a.totalValor)
      .slice(0, 10)

    // ── Ranking Vendedores ──
    const vendedorMap = new Map<string, { nome: string; totalValor: number; totalPedidos: number }>()
    for (const p of pedidos) {
      const vid = p.vendedorId ?? '__sem_vendedor__'
      const vend = p.vendedor
      const entry = vendedorMap.get(vid) ?? {
        nome: vend?.nome ?? 'Sem vendedor',
        totalValor: 0,
        totalPedidos: 0,
      }
      entry.totalValor += numberFrom(p.valorTotal)
      entry.totalPedidos += 1
      vendedorMap.set(vid, entry)
    }

    const rankingVendedores: VendedorRanking[] = Array.from(vendedorMap.entries())
      .map(([vid, v]) => ({
        vendedorId: vid === '__sem_vendedor__' ? null : vid,
        vendedorNome: v.nome,
        totalValor: v.totalValor,
        totalPedidos: v.totalPedidos,
        participacao: faturamentoTotal > 0 ? (v.totalValor / faturamentoTotal) * 100 : 0,
      }))
      .sort((a, b) => b.totalValor - a.totalValor)
      .slice(0, 10)

    // ── Relatório completo por Vendedor (com breakdown mensal + comissões) ──
    const relatorioMap = new Map<string, {
      nome: string
      meses: Map<string, { totalValor: number; totalPedidos: number }>
    }>()

    for (const p of pedidos) {
      const vid = p.vendedorId ?? '__sem_vendedor__'
      const nome = p.vendedor?.nome ?? 'Sem vendedor'

      if (!relatorioMap.has(vid)) {
        relatorioMap.set(vid, { nome, meses: new Map() })
      }
      const entry = relatorioMap.get(vid)!
      const d = new Date(p.dataPedido)
      const mesKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const mesEntry = entry.meses.get(mesKey) ?? { totalValor: 0, totalPedidos: 0 }
      mesEntry.totalValor += numberFrom(p.valorTotal)
      mesEntry.totalPedidos += 1
      entry.meses.set(mesKey, mesEntry)
    }

    const relatorioVendedores: RelatorioVendedor[] = Array.from(relatorioMap.entries())
      .map(([vid, v]) => {
        const porMes: RelatorioMesVendedor[] = Array.from(v.meses.entries())
          .sort(([a], [b]) => b.localeCompare(a))
          .map(([mes, m]) => ({
            mes,
            mesLabel: mesLabel(mes),
            totalValor: m.totalValor,
            totalPedidos: m.totalPedidos,
            comissao: m.totalValor * (taxaComissao / 100),
          }))

        const totalValor = porMes.reduce((s, m) => s + m.totalValor, 0)
        const totalPedidos = porMes.reduce((s, m) => s + m.totalPedidos, 0)
        const totalComissao = porMes.reduce((s, m) => s + m.comissao, 0)

        return {
          vendedorId: vid === '__sem_vendedor__' ? null : vid,
          vendedorNome: v.nome,
          totalValor,
          totalPedidos,
          totalComissao,
          porMes,
        }
      })
      .sort((a, b) => b.totalValor - a.totalValor)

    // ── Ranking Produtos ──
    const produtoMap = new Map<string, { codigo: string; nome: string; totalValor: number; totalQuantidade: number }>()
    const totalItensValor = itens.reduce((s, i) => s + numberFrom(i.subtotal), 0)
    for (const item of itens) {
      const faca = item.faca
      const fid = item.facaId
      const entry = produtoMap.get(fid) ?? {
        codigo: faca?.codigo ?? '-',
        nome: faca?.nome ?? 'Desconhecida',
        totalValor: 0,
        totalQuantidade: 0,
      }
      entry.totalValor += numberFrom(item.subtotal)
      entry.totalQuantidade += Number(item.quantidade)
      produtoMap.set(fid, entry)
    }

    const rankingProdutos: ProdutoRanking[] = Array.from(produtoMap.entries())
      .map(([fid, p]) => ({
        facaId: fid,
        facaCodigo: p.codigo,
        facaNome: p.nome,
        totalValor: p.totalValor,
        totalQuantidade: p.totalQuantidade,
        participacao: totalItensValor > 0 ? (p.totalValor / totalItensValor) * 100 : 0,
      }))
      .sort((a, b) => b.totalValor - a.totalValor)
      .slice(0, 10)

    // ── Pipeline ──
    const statusMap = new Map<StatusPedido, { quantidade: number; valorTotal: number }>()
    for (const p of pedidos) {
      const st = p.status as StatusPedido
      const entry = statusMap.get(st) ?? { quantidade: 0, valorTotal: 0 }
      entry.quantidade += 1
      entry.valorTotal += numberFrom(p.valorTotal)
      statusMap.set(st, entry)
    }

    const pipeline: StatusPipeline[] = (['em_espera', 'em_producao', 'entregue'] as StatusPedido[]).map((status) => {
      const entry = statusMap.get(status) ?? { quantidade: 0, valorTotal: 0 }
      return {
        status,
        ...entry,
        percentual: totalPedidos > 0 ? (entry.quantidade / totalPedidos) * 100 : 0,
      }
    })

    // ── Vendas por Tipo de Cliente ──
    const tipoMap = new Map<string, { totalValor: number; totalPedidos: number }>()
    for (const p of pedidos) {
      const tipo = p.cliente?.tipo ?? 'Sem tipo'
      const entry = tipoMap.get(tipo) ?? { totalValor: 0, totalPedidos: 0 }
      entry.totalValor += numberFrom(p.valorTotal)
      entry.totalPedidos += 1
      tipoMap.set(tipo, entry)
    }

    const vendasPorTipo: VendasPorTipoCliente[] = Array.from(tipoMap.entries())
      .map(([tipo, v]) => ({
        tipo,
        ...v,
        percentual: faturamentoTotal > 0 ? (v.totalValor / faturamentoTotal) * 100 : 0,
      }))
      .sort((a, b) => b.totalValor - a.totalValor)

  return {
    kpi,
    vendasPorMes,
    rankingClientes,
    rankingProdutos,
    pipeline,
    vendasPorTipo,
    rankingVendedores,
    relatorioVendedores,
    taxaComissao,
    dateRange,
  }
}

// ── Estoque Queries ───────────────────────────────────────────────────────────

export async function getMetricasEstoque(dateRange: DateRange = defaultDateRange()): Promise<MetricasEstoqueData> {
  await requireAuthenticatedUserId()
  await assertPermissao('metricas', 'ver')

  const [facas, mps, movs, boms, ocs, usuarios] = await Promise.all([
    prisma.faca.findMany({
      select: {
        id: true,
        codigo: true,
        nome: true,
        estoqueAtual: true,
        estoqueMinimo: true,
        precoVenda: true,
      },
    }),
    prisma.materiaPrima.findMany({
      select: {
        id: true,
        codigo: true,
        nome: true,
        estoqueAtual: true,
        estoqueMinimo: true,
        precoCusto: true,
        fornecedor: {
          select: { nome: true },
        },
      },
    }),
    prisma.movimentacaoEstoque.findMany({
      where: {
        createdAt: {
          gte: new Date(`${dateRange.desde}T00:00:00.000Z`),
          lte: new Date(`${dateRange.ate}T23:59:59.999Z`),
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        tipo: true,
        quantidade: true,
        createdAt: true,
        usuarioId: true,
        materiaPrima: {
          select: {
            codigo: true,
            nome: true,
          },
        },
        faca: {
          select: {
            codigo: true,
            nome: true,
          },
        },
      },
    }),
    prisma.facaMateriaPrima.findMany({
      include: {
        faca: {
          select: { id: true, codigo: true, nome: true },
        },
        materiaPrima: {
          select: { id: true, codigo: true, nome: true, precoCusto: true },
        },
      },
    }),
    prisma.ordemCompra.findMany({
      where: {
        createdAt: {
          gte: new Date(dateRange.desde),
          lte: new Date(`${dateRange.ate}T23:59:59.999Z`),
        },
      },
      select: {
        id: true,
        status: true,
        createdAt: true,
        itens: {
          select: {
            quantidade: true,
            precoUnitario: true,
          },
        },
      },
    }),
    prisma.usuarioPerfil.findMany({
      where: { ativo: true },
      select: { id: true, nome: true },
      orderBy: { nome: 'asc' },
    }),
  ])

  const usuariosMap = new Map<string, string>(
    usuarios.map((u) => [u.id, u.nome] as [string, string]),
  )

    // ── KPIs (estoque atual é sempre snapshot, não depende de período) ──
  const facasCriticas = facas.filter((f) => f.estoqueAtual === 0).length
  const facasAtencao = facas.filter((f) => f.estoqueAtual > 0 && f.estoqueAtual <= f.estoqueMinimo).length
  const mpCriticas = mps.filter((m) => numberFrom(m.estoqueAtual) === 0).length
  const mpAtencao = mps.filter((m) => numberFrom(m.estoqueAtual) > 0 && numberFrom(m.estoqueAtual) <= numberFrom(m.estoqueMinimo)).length

  const kpi: KpiEstoque = {
    totalSkusFacas: facas.length,
    totalSkusMp: mps.length,
    facasCriticas,
    facasAtencao,
    mpCriticas,
    mpAtencao,
  }

    // ── Saúde Estoque Facas ──
  const saudeFacas: SaudeEstoqueFaca[] = facas
    .map((f) => ({
      id: f.id,
      codigo: f.codigo,
      nome: f.nome,
      estoqueAtual: Number(f.estoqueAtual),
      estoqueMinimo: Number(f.estoqueMinimo),
      status: estoqueStatus(Number(f.estoqueAtual), Number(f.estoqueMinimo)),
      coberturaDias: null,
    }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])

    // ── Saúde Estoque MP ──
  const saudeMp: SaudeEstoqueMp[] = mps
    .map((m) => ({
      id: m.id,
      codigo: m.codigo,
      nome: m.nome,
      fornecedorNome: m.fornecedor?.nome ?? null,
      estoqueAtual: numberFrom(m.estoqueAtual),
      estoqueMinimo: numberFrom(m.estoqueMinimo),
      status: estoqueStatus(numberFrom(m.estoqueAtual), numberFrom(m.estoqueMinimo)),
    }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])

    // ── Movimentações (já filtradas pelo período na query) ──
  const movimentacoesRecentes: MovimentacaoRecente[] = movs.map((m) => ({
    id: m.id,
    tipo: m.tipo,
    itemNome: m.materiaPrima?.nome ?? m.faca?.nome ?? '-',
    itemCodigo: m.materiaPrima?.codigo ?? m.faca?.codigo ?? '-',
    quantidade: Number(m.quantidade),
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt),
    usuarioNome: m.usuarioId ? (usuariosMap.get(m.usuarioId) ?? null) : null,
  }))

    // ── Consumo BOM ──
  const bomMap = new Map<string, ConsumoBom>()
  for (const b of boms) {
    const faca = b.faca
    const mp = b.materiaPrima
    if (!faca || !mp) continue
    const fid = faca.id
    if (!bomMap.has(fid)) {
      bomMap.set(fid, {
        facaId: fid,
        facaCodigo: faca.codigo,
        facaNome: faca.nome,
        materiais: [],
        custoTotalFaca: 0,
      })
    }
    const entry = bomMap.get(fid)!
    const custoUnit = numberFrom(mp.precoCusto)
    const qtd = numberFrom(b.quantidade)
    const custoTotal = custoUnit * qtd
    entry.materiais.push({
      mpId: mp.id,
      mpCodigo: mp.codigo,
      mpNome: mp.nome,
      quantidade: qtd,
      custoUnitario: custoUnit,
      custoTotal,
    })
    entry.custoTotalFaca += custoTotal
  }

  const consumoBom = Array.from(bomMap.values()).sort((a, b) => a.facaNome.localeCompare(b.facaNome))

    // ── Resumo OC ──
    const ocMap = new Map<StatusOC, { quantidade: number; valorTotal: number }>()
    for (const oc of ocs) {
      let st = String(oc.status)
      if (st === 'pago') st = 'enviada'
      if (st !== 'pendente' && st !== 'enviada' && st !== 'recebida') st = 'pendente'
      const stFinal = st as StatusOC
      const entry = ocMap.get(stFinal) ?? { quantidade: 0, valorTotal: 0 }
      entry.quantidade += 1
      const ocItens = Array.isArray(oc.itens) ? oc.itens : []
      entry.valorTotal += ocItens.reduce(
        (s: number, i: any) => s + Number(i.quantidade?.toNumber?.() ?? i.quantidade ?? 0) * Number(i.precoUnitario?.toNumber?.() ?? i.precoUnitario ?? 0),
        0,
      )
      ocMap.set(stFinal, entry)
    }

  const resumoOC: ResumoOC[] = (['pendente', 'enviada', 'recebida'] as StatusOC[]).map((status) => ({
    status,
    ...(ocMap.get(status) ?? { quantidade: 0, valorTotal: 0 }),
  }))

    // ── Alertas ──
  const alertas: AlertaEstoque[] = []
  for (const f of saudeFacas) {
    if (f.status === 'critico') {
      alertas.push({ tipo: 'zero', itemTipo: 'faca', itemId: f.id, itemCodigo: f.codigo, itemNome: f.nome, detalhe: 'Estoque zerado' })
    } else if (f.status === 'atencao') {
      alertas.push({ tipo: 'abaixo_minimo', itemTipo: 'faca', itemId: f.id, itemCodigo: f.codigo, itemNome: f.nome, detalhe: `${f.estoqueAtual} unid. (min: ${f.estoqueMinimo})` })
    }
  }
  for (const m of saudeMp) {
    if (m.status === 'critico') {
      alertas.push({ tipo: 'zero', itemTipo: 'materia_prima', itemId: m.id, itemCodigo: m.codigo, itemNome: m.nome, detalhe: 'Estoque zerado' })
    } else if (m.status === 'atencao') {
      alertas.push({ tipo: 'abaixo_minimo', itemTipo: 'materia_prima', itemId: m.id, itemCodigo: m.codigo, itemNome: m.nome, detalhe: `${m.estoqueAtual} unid. (min: ${m.estoqueMinimo})` })
    }
  }

  // ── Ranking de usuários por movimentações de estoque ──
  const usuarioMovMap = new Map<string, { nome: string; total: number; entradas: number; saidas: number }>()
  for (const m of movs) {
    const uid = m.usuarioId
    if (!uid) continue
    const nome = usuariosMap.get(uid) ?? 'Desconhecido'
    const entry = usuarioMovMap.get(uid) ?? { nome, total: 0, entradas: 0, saidas: 0 }
    entry.total += 1
    if (m.tipo === 'entrada') entry.entradas += 1
    else entry.saidas += 1
    usuarioMovMap.set(uid, entry)
  }
  const rankingUsuarios: RankingUsuarioEstoque[] = Array.from(usuarioMovMap.entries())
    .map(([uid, v]) => ({
      usuarioId: uid,
      usuarioNome: v.nome,
      totalMovimentacoes: v.total,
      entradas: v.entradas,
      saidas: v.saidas,
    }))
    .sort((a, b) => b.totalMovimentacoes - a.totalMovimentacoes)

  return { kpi, saudeFacas, saudeMp, movimentacoesRecentes, rankingUsuarios, consumoBom, resumoOC, alertas, dateRange }
}

// ── Financeiro ──────────────────────────────────────────────────────────────

export type KpiFinanceiro = {
  receitaTotal: number
  despesaTotal: number
  lucroLiquido: number
  margemLiquida: number
}

export type DespesaPorTipo = {
  tipo: TipoGasto
  total: number
  quantidade: number
  percentual: number
}

export type DespesaPorMes = {
  mes: string
  mesLabel: string
  receita: number
  despesa: number
}

export type GastoTopo = {
  id: string
  data: string
  tipo: TipoGasto
  descricao: string
  valor: number
  forma_pagamento: FormaPagamento
  ordem_compra_codigo: string | null
}

export type MetricasFinanceiroData = {
  kpi: KpiFinanceiro
  despesasPorTipo: DespesaPorTipo[]
  serieMensal: DespesaPorMes[]
  topGastos: GastoTopo[]
  dateRange: DateRange
}

export async function getMetricasFinanceiro(
  dateRange: DateRange = defaultDateRange(),
): Promise<MetricasFinanceiroData> {
  await requireAuthenticatedUserId()
  await assertPermissao('metricas', 'ver')

  const [pedidos, gastos] = await Promise.all([
    prisma.pedido.findMany({
      where: {
        dataPedido: {
          gte: dateRange.desde,
          lte: dateRange.ate,
        },
      },
      select: {
        dataPedido: true,
        valorTotal: true,
      },
    }),
    prisma.gasto.findMany({
      where: {
        dataGasto: {
          gte: new Date(dateRange.desde),
          lte: new Date(`${dateRange.ate}T23:59:59.999Z`),
        },
      },
      select: {
        id: true,
        tipo: true,
        descricao: true,
        valor: true,
        formaPagamento: true,
        dataGasto: true,
        ordemCompra: {
          select: { codigo: true },
        },
      },
    }),
  ])

  const receitaTotal = pedidos.reduce((s, p) => s + numberFrom(p.valorTotal), 0)
  const despesaTotal = gastos.reduce((s, g) => s + numberFrom(g.valor), 0)
  const lucroLiquido = receitaTotal - despesaTotal
  const margemLiquida = receitaTotal > 0 ? (lucroLiquido / receitaTotal) * 100 : 0

  const tipoMap = new Map<TipoGasto, { total: number; quantidade: number }>()
  for (const g of gastos) {
    const t = g.tipo as TipoGasto
    const entry = tipoMap.get(t) ?? { total: 0, quantidade: 0 }
    entry.total += numberFrom(g.valor)
    entry.quantidade += 1
    tipoMap.set(t, entry)
  }

  const despesasPorTipo: DespesaPorTipo[] = Array.from(tipoMap.entries())
    .map(([tipo, v]) => ({
      tipo,
      total: v.total,
      quantidade: v.quantidade,
      percentual: despesaTotal > 0 ? (v.total / despesaTotal) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total)

  const mesMap = new Map<string, { receita: number; despesa: number }>()
  for (const p of pedidos) {
    const d = new Date(p.dataPedido)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const e = mesMap.get(key) ?? { receita: 0, despesa: 0 }
    e.receita += numberFrom(p.valorTotal)
    mesMap.set(key, e)
  }
  for (const g of gastos) {
    const d = new Date(g.dataGasto)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const e = mesMap.get(key) ?? { receita: 0, despesa: 0 }
    e.despesa += numberFrom(g.valor)
    mesMap.set(key, e)
  }

  const serieMensal: DespesaPorMes[] = Array.from(mesMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([mes, v]) => ({ mes, mesLabel: mesLabel(mes), ...v }))

  const topGastos: GastoTopo[] = gastos
    .slice()
    .sort((a, b) => numberFrom(b.valor) - numberFrom(a.valor))
    .slice(0, 10)
    .map((g) => ({
      id: g.id,
      data: g.dataGasto.toISOString().slice(0, 10),
      tipo: g.tipo as TipoGasto,
      descricao: g.descricao,
      valor: numberFrom(g.valor),
      forma_pagamento: g.formaPagamento as FormaPagamento,
      ordem_compra_codigo: g.ordemCompra?.codigo ?? null,
    }))

  const kpi: KpiFinanceiro = { receitaTotal, despesaTotal, lucroLiquido, margemLiquida }

  return { kpi, despesasPorTipo, serieMensal, topGastos, dateRange }
}
