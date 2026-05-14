'use server'

import { createClient, withSupabaseCookieContext } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
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

// ── Vendas Queries ────────────────────────────────────────────────────────────

export async function getMetricasVendas(dateRange: DateRange = defaultDateRange()): Promise<MetricasVendasData> {
  await requireAuthenticatedUserId()
  await assertPermissao('metricas', 'ver')

  return withSupabaseCookieContext(async () => {
    const supabase = await createClient()
    const admin = createAdminClient()

    // ate é inclusivo: vamos até o fim do dia (usa lte com a data)
    let pedidosQuery = supabase
      .from('pedidos')
      .select('id, codigo, cliente_id, vendedor_id, data_pedido, status, valor_total, entregue_at, created_at, cliente:clientes(id, nome, tipo, tipo_documento, documento, cidade, estado), vendedor:usuarios_perfis(id, nome)')
      .gte('data_pedido', dateRange.desde)
      .lte('data_pedido', dateRange.ate)

    const [pedidosRes, itensRes, configRes] = await Promise.all([
      pedidosQuery,
      supabase
        .from('pedido_itens')
        .select('id, pedido_id, faca_id, quantidade, preco_unitario, subtotal, faca:facas(id, codigo, nome)'),
      admin.from('app_config').select('taxa_comissao_lucro').limit(1).maybeSingle(),
    ])

    if (pedidosRes.error) throw new Error(pedidosRes.error.message)
    if (itensRes.error) throw new Error(itensRes.error.message)

    const pedidos = pedidosRes.data ?? []
    const allItens = itensRes.data ?? []
    const taxaComissao = Number(configRes.data?.taxa_comissao_lucro ?? 0)

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

    // ── Ranking Vendedores ──
    const vendedorMap = new Map<string, { nome: string; totalValor: number; totalPedidos: number }>()
    for (const p of pedidos) {
      const vid = (p as any).vendedor_id ?? '__sem_vendedor__'
      const vend = Array.isArray((p as any).vendedor) ? (p as any).vendedor[0] : (p as any).vendedor
      const entry = vendedorMap.get(vid) ?? {
        nome: (vend as any)?.nome ?? 'Sem vendedor',
        totalValor: 0,
        totalPedidos: 0,
      }
      entry.totalValor += Number(p.valor_total ?? 0)
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
      const vid = (p as any).vendedor_id ?? '__sem_vendedor__'
      const vend = Array.isArray((p as any).vendedor) ? (p as any).vendedor[0] : (p as any).vendedor
      const nome = (vend as any)?.nome ?? 'Sem vendedor'

      if (!relatorioMap.has(vid)) {
        relatorioMap.set(vid, { nome, meses: new Map() })
      }
      const entry = relatorioMap.get(vid)!
      const d = new Date(p.data_pedido)
      const mesKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const mesEntry = entry.meses.get(mesKey) ?? { totalValor: 0, totalPedidos: 0 }
      mesEntry.totalValor += Number(p.valor_total ?? 0)
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
  })
}

// ── Estoque Queries ───────────────────────────────────────────────────────────

export async function getMetricasEstoque(dateRange: DateRange = defaultDateRange()): Promise<MetricasEstoqueData> {
  await requireAuthenticatedUserId()
  await assertPermissao('metricas', 'ver')

  return withSupabaseCookieContext(async () => {
    const supabase = await createClient()
    const admin = createAdminClient()

    // Movimentações filtradas por período
    const movQuery = admin
      .from('movimentacoes_estoque')
      .select(
        'id, tipo, quantidade, created_at, usuario_id, materia_prima:materias_primas(codigo, nome), faca:facas(codigo, nome)',
      )
      .order('created_at', { ascending: false })
      .gte('created_at', dateRange.desde)
      .lte('created_at', dateRange.ate + 'T23:59:59.999Z')

    // OCs filtradas por período
    const ocQuery = supabase
      .from('ordens_compra')
      .select('id, status, created_at, itens:ordem_compra_itens(quantidade, preco_unitario)')
      .gte('created_at', dateRange.desde)
      .lte('created_at', dateRange.ate + 'T23:59:59.999Z')

    const [facasRes, mpRes, movRes, bomRes, ocRes, usuariosRes] = await Promise.all([
      supabase.from('facas').select('id, codigo, nome, estoque_atual, estoque_minimo, preco_venda'),
      supabase.from('materias_primas').select('id, codigo, nome, estoque_atual, estoque_minimo, preco_custo, fornecedor:fornecedores(nome)'),
      movQuery.limit(500),
      supabase.from('faca_materias_primas').select('faca_id, materia_prima_id, quantidade, faca:facas(id, codigo, nome), mp:materias_primas(id, codigo, nome, preco_custo)'),
      ocQuery,
      admin.from('usuarios_perfis').select('id, nome').order('nome'),
    ])

    if (facasRes.error) throw new Error(facasRes.error.message)
    if (mpRes.error) throw new Error(mpRes.error.message)
    if (movRes.error) throw new Error(movRes.error.message)
    if (bomRes.error) throw new Error(bomRes.error.message)
    if (ocRes.error) throw new Error(ocRes.error.message)

    const facas = facasRes.data ?? []
    const mps = mpRes.data ?? []
    const usuariosMap = new Map((usuariosRes.data ?? []).map((u) => [u.id, u.nome as string]))
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
      .map((f) => ({
        id: f.id,
        codigo: f.codigo,
        nome: f.nome,
        estoqueAtual: Number(f.estoque_atual),
        estoqueMinimo: Number(f.estoque_minimo),
        status: estoqueStatus(Number(f.estoque_atual), Number(f.estoque_minimo)),
        coberturaDias: null,
      }))
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
      const item = (mp as { nome?: string; codigo?: string } | null) ??
        (faca as { nome?: string; codigo?: string } | null)
      return {
        id: m.id,
        tipo: m.tipo,
        itemNome: item?.nome ?? '-',
        itemCodigo: item?.codigo ?? '-',
        quantidade: Number(m.quantidade),
        createdAt: m.created_at,
        usuarioNome: (m as any).usuario_id ? (usuariosMap.get((m as any).usuario_id) ?? null) : null,
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
        (s: number, i: any) => s + Number(i.quantidade ?? 0) * Number(i.preco_unitario ?? 0),
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
      const uid = (m as any).usuario_id as string | null
      if (!uid) continue
      const nome = usuariosMap.get(uid) ?? 'Desconhecido'
      const entry = usuarioMovMap.get(uid) ?? { nome, total: 0, entradas: 0, saidas: 0 }
      entry.total += 1
      if ((m as any).tipo === 'entrada') entry.entradas += 1
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
  })
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

  return withSupabaseCookieContext(async () => {
    const supabase = await createClient()

    const [pedidosRes, gastosRes] = await Promise.all([
      supabase
        .from('pedidos')
        .select('data_pedido, valor_total')
        .gte('data_pedido', dateRange.desde)
        .lte('data_pedido', dateRange.ate),
      supabase
        .from('gastos')
        .select('id, tipo, descricao, valor, forma_pagamento, data_gasto, ordem_compra:ordens_compra(codigo)')
        .gte('data_gasto', dateRange.desde)
        .lte('data_gasto', dateRange.ate),
    ])

    if (pedidosRes.error) throw new Error(pedidosRes.error.message)
    if (gastosRes.error) throw new Error(gastosRes.error.message)

    const pedidos = pedidosRes.data ?? []
    const gastos = gastosRes.data ?? []

    const receitaTotal = pedidos.reduce((s, p) => s + Number(p.valor_total ?? 0), 0)
    const despesaTotal = gastos.reduce((s, g) => s + Number(g.valor ?? 0), 0)
    const lucroLiquido = receitaTotal - despesaTotal
    const margemLiquida = receitaTotal > 0 ? (lucroLiquido / receitaTotal) * 100 : 0

    const tipoMap = new Map<TipoGasto, { total: number; quantidade: number }>()
    for (const g of gastos) {
      const t = g.tipo as TipoGasto
      const entry = tipoMap.get(t) ?? { total: 0, quantidade: 0 }
      entry.total += Number(g.valor ?? 0)
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
      const d = new Date(p.data_pedido)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const e = mesMap.get(key) ?? { receita: 0, despesa: 0 }
      e.receita += Number(p.valor_total ?? 0)
      mesMap.set(key, e)
    }
    for (const g of gastos) {
      const d = new Date(g.data_gasto)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const e = mesMap.get(key) ?? { receita: 0, despesa: 0 }
      e.despesa += Number(g.valor ?? 0)
      mesMap.set(key, e)
    }

    const serieMensal: DespesaPorMes[] = Array.from(mesMap.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([mes, v]) => ({ mes, mesLabel: mesLabel(mes), ...v }))

    const topGastos: GastoTopo[] = gastos
      .slice()
      .sort((a, b) => Number(b.valor ?? 0) - Number(a.valor ?? 0))
      .slice(0, 10)
      .map((g) => {
        const oc = Array.isArray(g.ordem_compra) ? g.ordem_compra[0] : g.ordem_compra
        return {
          id: g.id,
          data: g.data_gasto,
          tipo: g.tipo as TipoGasto,
          descricao: g.descricao,
          valor: Number(g.valor ?? 0),
          forma_pagamento: g.forma_pagamento as FormaPagamento,
          ordem_compra_codigo: oc?.codigo ?? null,
        }
      })

    const kpi: KpiFinanceiro = { receitaTotal, despesaTotal, lucroLiquido, margemLiquida }

    return { kpi, despesasPorTipo, serieMensal, topGastos, dateRange }
  })
}
