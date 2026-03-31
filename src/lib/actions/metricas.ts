'use server'

import { createClient, withSupabaseCookieContext } from '@/lib/supabase/server'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import type { StatusPedido, StatusOC } from '@/types'
import type { PeriodoId } from '@/lib/metricas-periodos'

function calcularDatasPerido(periodo: PeriodoId): { desde: string | null; ate: string | null } {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const d = now.getDate()

  switch (periodo) {
    case 'este_mes':
      return { desde: new Date(y, m, 1).toISOString(), ate: null }
    case 'mes_passado':
      return { desde: new Date(y, m - 1, 1).toISOString(), ate: new Date(y, m, 1).toISOString() }
    case '30d':
      return { desde: new Date(y, m, d - 30).toISOString(), ate: null }
    case '60d':
      return { desde: new Date(y, m, d - 60).toISOString(), ate: null }
    case '90d':
      return { desde: new Date(y, m, d - 90).toISOString(), ate: null }
    case '1ano':
      return { desde: new Date(y - 1, m, d).toISOString(), ate: null }
    case 'tudo':
      return { desde: null, ate: null }
  }
}

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

export type MetricasVendasData = {
  kpi: KpiVendas
  vendasPorMes: VendasPorMes[]
  rankingClientes: ClienteRanking[]
  rankingProdutos: ProdutoRanking[]
  pipeline: StatusPipeline[]
  vendasPorTipo: VendasPorTipoCliente[]
  periodo: PeriodoId
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

export type MetricasEstoqueData = {
  kpi: KpiEstoque
  saudeFacas: SaudeEstoqueFaca[]
  saudeMp: SaudeEstoqueMp[]
  movimentacoesRecentes: MovimentacaoRecente[]
  consumoBom: ConsumoBom[]
  resumoOC: ResumoOC[]
  alertas: AlertaEstoque[]
  periodo: PeriodoId
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

// ── Vendas Queries ────────────────────────────────────────────────────────────

export async function getMetricasVendas(periodo: PeriodoId = 'tudo'): Promise<MetricasVendasData> {
  await requireAuthenticatedUserId()
  await assertPermissao('metricas', 'ver')

  return withSupabaseCookieContext(async () => {
    const supabase = await createClient()
    const { desde, ate } = calcularDatasPerido(periodo)

    let pedidosQuery = supabase
      .from('pedidos')
      .select('id, codigo, cliente_id, data_pedido, status, valor_total, entregue_at, created_at, cliente:clientes(id, nome, tipo)')

    if (desde) pedidosQuery = pedidosQuery.gte('data_pedido', desde.split('T')[0])
    if (ate) pedidosQuery = pedidosQuery.lt('data_pedido', ate.split('T')[0])

    const [pedidosRes, itensRes] = await Promise.all([
      pedidosQuery,
      supabase
        .from('pedido_itens')
        .select('id, pedido_id, faca_id, quantidade, preco_unitario, subtotal, faca:facas(id, codigo, nome)'),
    ])

    if (pedidosRes.error) throw new Error(pedidosRes.error.message)
    if (itensRes.error) throw new Error(itensRes.error.message)

    const pedidos = pedidosRes.data ?? []
    const allItens = itensRes.data ?? []

    // Filter itens to only those belonging to fetched pedidos
    const pedidoIds = new Set(pedidos.map((p) => p.id))
    const itens = allItens.filter((i) => pedidoIds.has(i.pedido_id))

    // ── KPIs ──
    const faturamentoTotal = pedidos.reduce((s, p) => s + Number(p.valor_total ?? 0), 0)
    const totalPedidos = pedidos.length
    const ticketMedio = totalPedidos > 0 ? faturamentoTotal / totalPedidos : 0
    const pedidosEntregues = pedidos.filter((p) => p.status === 'entregue').length
    const taxaEntrega = totalPedidos > 0 ? (pedidosEntregues / totalPedidos) * 100 : 0

    const kpi: KpiVendas = { faturamentoTotal, totalPedidos, ticketMedio, taxaEntrega, pedidosEntregues }

    // ── Vendas por Mês ──
    const mesMap = new Map<string, { totalValor: number; totalPedidos: number; totalItens: number }>()

    for (const p of pedidos) {
      const d = new Date(p.data_pedido)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const entry = mesMap.get(key) ?? { totalValor: 0, totalPedidos: 0, totalItens: 0 }
      entry.totalValor += Number(p.valor_total ?? 0)
      entry.totalPedidos += 1
      const pedidoItens = itens.filter((i) => i.pedido_id === p.id)
      entry.totalItens += pedidoItens.reduce((s, i) => s + Number(i.quantidade), 0)
      mesMap.set(key, entry)
    }

    const vendasPorMes: VendasPorMes[] = Array.from(mesMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([mes, v]) => ({ mes, mesLabel: mesLabel(mes), ...v }))

    // ── Ranking Clientes ──
    const clienteMap = new Map<string, { nome: string; tipo: string; totalValor: number; totalPedidos: number }>()
    for (const p of pedidos) {
      const cid = p.cliente_id ?? '__sem_cliente__'
      const cli = Array.isArray(p.cliente) ? p.cliente[0] : p.cliente
      const entry = clienteMap.get(cid) ?? {
        nome: (cli as any)?.nome ?? 'Sem cliente',
        tipo: (cli as any)?.tipo ?? '-',
        totalValor: 0,
        totalPedidos: 0,
      }
      entry.totalValor += Number(p.valor_total ?? 0)
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

    // ── Ranking Produtos ──
    const produtoMap = new Map<string, { codigo: string; nome: string; totalValor: number; totalQuantidade: number }>()
    const totalItensValor = itens.reduce((s, i) => s + Number(i.subtotal ?? 0), 0)
    for (const item of itens) {
      const faca = Array.isArray(item.faca) ? item.faca[0] : item.faca
      const fid = item.faca_id
      const entry = produtoMap.get(fid) ?? {
        codigo: (faca as any)?.codigo ?? '-',
        nome: (faca as any)?.nome ?? 'Desconhecida',
        totalValor: 0,
        totalQuantidade: 0,
      }
      entry.totalValor += Number(item.subtotal ?? 0)
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
      entry.valorTotal += Number(p.valor_total ?? 0)
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
      const cli = Array.isArray(p.cliente) ? p.cliente[0] : p.cliente
      const tipo = (cli as any)?.tipo ?? 'Sem tipo'
      const entry = tipoMap.get(tipo) ?? { totalValor: 0, totalPedidos: 0 }
      entry.totalValor += Number(p.valor_total ?? 0)
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

    return { kpi, vendasPorMes, rankingClientes, rankingProdutos, pipeline, vendasPorTipo, periodo }
  })
}

// ── Estoque Queries ───────────────────────────────────────────────────────────

export async function getMetricasEstoque(periodo: PeriodoId = 'tudo'): Promise<MetricasEstoqueData> {
  await requireAuthenticatedUserId()
  await assertPermissao('metricas', 'ver')

  return withSupabaseCookieContext(async () => {
    const supabase = await createClient()
    const { desde, ate } = calcularDatasPerido(periodo)

    // Movimentações filtradas por período
    let movQuery = supabase
      .from('movimentacoes_estoque')
      .select('id, tipo, quantidade, created_at, materia_prima:materias_primas(codigo, nome), faca:facas(codigo, nome)')
      .order('created_at', { ascending: false })

    if (desde) movQuery = movQuery.gte('created_at', desde)
    if (ate) movQuery = movQuery.lt('created_at', ate)

    // OCs filtradas por período
    let ocQuery = supabase
      .from('ordens_compra')
      .select('id, status, created_at, itens:ordem_compra_itens(quantidade, preco_unitario)')

    if (desde) ocQuery = ocQuery.gte('created_at', desde)
    if (ate) ocQuery = ocQuery.lt('created_at', ate)

    const [facasRes, mpRes, movRes, bomRes, ocRes] = await Promise.all([
      supabase.from('facas').select('id, codigo, nome, estoque_atual, estoque_minimo, taxa_venda, preco_venda'),
      supabase.from('materias_primas').select('id, codigo, nome, estoque_atual, estoque_minimo, preco_custo, fornecedor:fornecedores(nome)'),
      movQuery.limit(50),
      supabase.from('faca_materias_primas').select('faca_id, materia_prima_id, quantidade, faca:facas(id, codigo, nome), mp:materias_primas(id, codigo, nome, preco_custo)'),
      ocQuery,
    ])

    if (facasRes.error) throw new Error(facasRes.error.message)
    if (mpRes.error) throw new Error(mpRes.error.message)
    if (movRes.error) throw new Error(movRes.error.message)
    if (bomRes.error) throw new Error(bomRes.error.message)
    if (ocRes.error) throw new Error(ocRes.error.message)

    const facas = facasRes.data ?? []
    const mps = mpRes.data ?? []
    const movs = movRes.data ?? []
    const boms = bomRes.data ?? []
    const ocs = ocRes.data ?? []

    // ── KPIs (estoque atual é sempre snapshot, não depende de período) ──
    const facasCriticas = facas.filter((f) => f.estoque_atual === 0).length
    const facasAtencao = facas.filter((f) => f.estoque_atual > 0 && f.estoque_atual <= f.estoque_minimo).length
    const mpCriticas = mps.filter((m) => m.estoque_atual === 0).length
    const mpAtencao = mps.filter((m) => m.estoque_atual > 0 && m.estoque_atual <= m.estoque_minimo).length

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
      .map((f) => {
        const taxa = Number(f.taxa_venda ?? 0)
        return {
          id: f.id,
          codigo: f.codigo,
          nome: f.nome,
          estoqueAtual: Number(f.estoque_atual),
          estoqueMinimo: Number(f.estoque_minimo),
          status: estoqueStatus(Number(f.estoque_atual), Number(f.estoque_minimo)),
          coberturaDias: taxa > 0 ? Math.round(Number(f.estoque_atual) / taxa) : null,
        }
      })
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])

    // ── Saúde Estoque MP ──
    const saudeMp: SaudeEstoqueMp[] = mps
      .map((m) => {
        const forn = Array.isArray(m.fornecedor) ? m.fornecedor[0] : m.fornecedor
        return {
          id: m.id,
          codigo: m.codigo,
          nome: m.nome,
          fornecedorNome: (forn as any)?.nome ?? null,
          estoqueAtual: Number(m.estoque_atual),
          estoqueMinimo: Number(m.estoque_minimo),
          status: estoqueStatus(Number(m.estoque_atual), Number(m.estoque_minimo)),
        }
      })
      .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status])

    // ── Movimentações (já filtradas pelo período na query) ──
    const movimentacoesRecentes: MovimentacaoRecente[] = movs.map((m) => {
      const mp = Array.isArray(m.materia_prima) ? m.materia_prima[0] : m.materia_prima
      const faca = Array.isArray(m.faca) ? m.faca[0] : m.faca
      const item = (mp as any) ?? (faca as any)
      return {
        id: m.id,
        tipo: m.tipo,
        itemNome: item?.nome ?? '-',
        itemCodigo: item?.codigo ?? '-',
        quantidade: Number(m.quantidade),
        createdAt: m.created_at,
      }
    })

    // ── Consumo BOM ──
    const bomMap = new Map<string, ConsumoBom>()
    for (const b of boms) {
      const faca = Array.isArray(b.faca) ? b.faca[0] : b.faca
      const mp = Array.isArray(b.mp) ? b.mp[0] : b.mp
      if (!faca || !mp) continue
      const fid = (faca as any).id as string
      if (!bomMap.has(fid)) {
        bomMap.set(fid, {
          facaId: fid,
          facaCodigo: (faca as any).codigo,
          facaNome: (faca as any).nome,
          materiais: [],
          custoTotalFaca: 0,
        })
      }
      const entry = bomMap.get(fid)!
      const custoUnit = Number((mp as any).preco_custo ?? 0)
      const qtd = Number(b.quantidade)
      const custoTotal = custoUnit * qtd
      entry.materiais.push({
        mpId: (mp as any).id,
        mpCodigo: (mp as any).codigo,
        mpNome: (mp as any).nome,
        quantidade: qtd,
        custoUnitario: custoUnit,
        custoTotal,
      })
      entry.custoTotalFaca += custoTotal
    }

    const consumoBom = Array.from(bomMap.values()).sort((a, b) => a.facaNome.localeCompare(b.facaNome))

    // ── Resumo OC (já filtradas pelo período na query) ──
    const ocMap = new Map<StatusOC, { quantidade: number; valorTotal: number }>()
    for (const oc of ocs) {
      const st = oc.status as StatusOC
      const entry = ocMap.get(st) ?? { quantidade: 0, valorTotal: 0 }
      entry.quantidade += 1
      const ocItens = Array.isArray(oc.itens) ? oc.itens : []
      entry.valorTotal += ocItens.reduce(
        (s: number, i: any) => s + Number(i.quantidade ?? 0) * Number(i.preco_unitario ?? 0),
        0,
      )
      ocMap.set(st, entry)
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

    return { kpi, saudeFacas, saudeMp, movimentacoesRecentes, consumoBom, resumoOC, alertas, periodo }
  })
}
