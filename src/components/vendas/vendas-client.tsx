'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { VendaFormModal } from './venda-form-modal'
import { VendaDetalheModal } from './venda-detalhe-modal'
import { avancarStatus, deletarVenda, getVendaDetalhe, marcarEntregue } from '@/lib/actions/vendas'
import { getErpTabData } from '@/lib/actions/erp-tab-data'
import { STATUS_PEDIDO } from '@/types'
import type { Pedido, Cliente, Faca, StatusPedido } from '@/types'
import { useErpTabs } from '@/components/layout/erp-tabs'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }

type Props = {
  pedidos: Pedido[]
  clientes: Cliente[]
  facas: Faca[]
  usuarios: { id: string; nome: string }[]
  perm: Perm
}

const STATUS_TABS: { value: StatusPedido | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'em_espera', label: 'Em espera' },
  { value: 'em_producao', label: 'Em Produção' },
  { value: 'entregue', label: 'Entregue' },
]

function normalizeDate(date: string) {
  const d = new Date(`${date}T12:00:00`)
  d.setHours(0, 0, 0, 0)
  return d
}

function parseStatusParam(value: string | null): StatusPedido | 'todos' {
  if (value === 'em_espera' || value === 'em_producao' || value === 'entregue') return value
  return 'todos'
}

function isFullDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function VendasClient({ pedidos: pedidosIniciais, clientes, facas, usuarios, perm }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const statusParam = searchParams.get('status')
  const vendedorParam = searchParams.get('vendedor')
  const clienteParam = searchParams.get('cliente')
  const valorMinParam = searchParams.get('valor_min')
  const valorMaxParam = searchParams.get('valor_max')
  const dataInicioParam = searchParams.get('data_inicio')
  const dataFimParam = searchParams.get('data_fim')
  const isVendasRoute = pathname === '/vendas'

  const [pedidos, setPedidos] = useState<Pedido[]>(pedidosIniciais)
  const { refreshActiveTab, refreshTab } = useErpTabs()
  const [formAberto, setFormAberto] = useState(false)
  const [editando, setEditando] = useState<Pedido | null>(null)
  const [detalhe, setDetalhe] = useState<Pedido | null>(null)
  const [loadingDetalheId, setLoadingDetalheId] = useState<string | null>(null)
  const [deletando, setDeletando] = useState<Pedido | null>(null)
  const [erroDelete, setErroDelete] = useState('')
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState<StatusPedido | 'todos'>(() => parseStatusParam(statusParam))
  const [filtroVendedor, setFiltroVendedor] = useState(() => vendedorParam ?? '')
  const [filtroCliente, setFiltroCliente] = useState(() => clienteParam ?? '')
  const [valorMin, setValorMin] = useState(() => valorMinParam ?? '')
  const [valorMax, setValorMax] = useState(() => valorMaxParam ?? '')
  const [dataInicio, setDataInicio] = useState(() => dataInicioParam ?? '')
  const [dataFim, setDataFim] = useState(() => dataFimParam ?? '')
  const [confirmarAcao, setConfirmarAcao] = useState<{ pedido: Pedido; tipo: 'producao' | 'entrega' } | null>(null)
  const [loadingAcaoConfirm, setLoadingAcaoConfirm] = useState(false)
  const [erroAcaoConfirm, setErroAcaoConfirm] = useState('')

  // Sincroniza quando TabPane re-busca dados (ex: ao reabrir a aba)
  useEffect(() => {
    setPedidos(pedidosIniciais)
  }, [pedidosIniciais])

  useEffect(() => {
    if (!isVendasRoute) return
    setFiltroStatus(parseStatusParam(statusParam))
    setFiltroVendedor(vendedorParam ?? '')
    setFiltroCliente(clienteParam ?? '')
    setValorMin(valorMinParam ?? '')
    setValorMax(valorMaxParam ?? '')
    setDataInicio(dataInicioParam ?? '')
    setDataFim(dataFimParam ?? '')
  }, [isVendasRoute, statusParam, vendedorParam, clienteParam, valorMinParam, valorMaxParam, dataInicioParam, dataFimParam])

  useEffect(() => {
    if (!isVendasRoute) return
    const nextParams = new URLSearchParams(searchParams.toString())
    const upsert = (key: string, value: string) => {
      if (value.trim()) nextParams.set(key, value.trim())
      else nextParams.delete(key)
    }

    upsert('status', filtroStatus === 'todos' ? '' : filtroStatus)
    upsert('vendedor', filtroVendedor)
    upsert('cliente', filtroCliente)
    upsert('valor_min', valorMin)
    upsert('valor_max', valorMax)
    upsert('data_inicio', isFullDate(dataInicio) ? dataInicio : '')
    upsert('data_fim', isFullDate(dataFim) ? dataFim : '')

    const query = nextParams.toString()
    if (query === searchParams.toString()) return
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [isVendasRoute, pathname, router, searchParams, filtroStatus, filtroVendedor, filtroCliente, valorMin, valorMax, dataInicio, dataFim])

  const handleStatusChange = useCallback(async (id: string, novoStatus: StatusPedido, entregue_at?: string) => {
    // 1. Atualiza na hora (optimistic update)
    setPedidos((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, status: novoStatus, ...(entregue_at ? { entregue_at } : {}) }
          : p
      )
    )
    // 2. Re-fetch em background para garantir dados frescos do servidor
    try {
      const fresh = await getErpTabData('/vendas')
      if (fresh.kind === 'vendas') setPedidos(fresh.pedidos)
    } catch {
      // Optimistic update continua válido se falhar
    }

    // Quando uma venda vira "entregue", o servidor preenche a fila de reposição
    // e tenta gerar OCs automaticamente; a aba de compras é atualizada.
    if (novoStatus === 'entregue') refreshTab('/ordens-compra')
  }, [refreshTab])

  const filtrados = useMemo(() => {
    const vendedorNorm = filtroVendedor.trim().toLowerCase()
    const clienteNorm = filtroCliente.trim().toLowerCase()
    const valorMinNum = valorMin.trim() ? Number(valorMin) : null
    const valorMaxNum = valorMax.trim() ? Number(valorMax) : null
    const dataInicioNorm = dataInicio ? normalizeDate(dataInicio) : null
    const dataFimNorm = dataFim ? normalizeDate(dataFim) : null

    return pedidos.filter((p) => {
      const matchStatus = filtroStatus === 'todos' || p.status === filtroStatus
      const matchVendedor = !vendedorNorm || p.vendedor?.nome?.toLowerCase().includes(vendedorNorm)
      const matchCliente = !clienteNorm || p.cliente?.nome?.toLowerCase().includes(clienteNorm)
      const total = p.valor_total ?? 0
      const matchValorMin = valorMinNum == null || (!Number.isNaN(valorMinNum) && total >= valorMinNum)
      const matchValorMax = valorMaxNum == null || (!Number.isNaN(valorMaxNum) && total <= valorMaxNum)
      const dataPedido = normalizeDate(p.data_pedido)
      const matchDataInicio = !dataInicioNorm || dataPedido >= dataInicioNorm
      const matchDataFim = !dataFimNorm || dataPedido <= dataFimNorm

      return (
        matchStatus &&
        matchVendedor &&
        matchCliente &&
        matchValorMin &&
        matchValorMax &&
        matchDataInicio &&
        matchDataFim
      )
    })
  }, [pedidos, filtroStatus, filtroVendedor, filtroCliente, valorMin, valorMax, dataInicio, dataFim])

  function abrirNovo() { setEditando(null); setFormAberto(true) }
  function abrirEditar(p: Pedido) { setEditando(p); setFormAberto(true) }
  async function abrirDetalhe(p: Pedido) {
    setLoadingDetalheId(p.id)
    try {
      const venda = await getVendaDetalhe(p.id)
      setDetalhe(venda)
    } finally {
      setLoadingDetalheId(null)
    }
  }

  function abrirConfirmarProducao(p: Pedido) {
    if (!perm.editar) return
    setErroAcaoConfirm('')
    setConfirmarAcao({ pedido: p, tipo: 'producao' })
  }

  function abrirConfirmarEntregue(p: Pedido) {
    if (!perm.editar) return
    setErroAcaoConfirm('')
    setConfirmarAcao({ pedido: p, tipo: 'entrega' })
  }

  async function executarAcaoConfirmada() {
    if (!confirmarAcao) return
    setErroAcaoConfirm('')
    setLoadingAcaoConfirm(true)
    const { pedido: p, tipo } = confirmarAcao
    try {
      if (tipo === 'producao') {
        await avancarStatus(p.id, 'em_producao')
        await handleStatusChange(p.id, 'em_producao')
      } else {
        await marcarEntregue(p.id)
        await handleStatusChange(p.id, 'entregue', new Date().toISOString())
      }
      setConfirmarAcao(null)
    } catch (e: unknown) {
      setErroAcaoConfirm(e instanceof Error ? e.message : (tipo === 'producao' ? 'Erro ao iniciar produção.' : 'Erro ao marcar entrega.'))
    } finally {
      setLoadingAcaoConfirm(false)
    }
  }

  async function confirmarDelete() {
    if (!deletando) return
    setErroDelete(''); setLoadingDelete(true)
    try {
      await deletarVenda(deletando.id)
      setDeletando(null)
      refreshActiveTab()
    } catch (e: unknown) {
      setErroDelete(e instanceof Error ? e.message : 'Erro ao excluir.')
    } finally {
      setLoadingDelete(false)
    }
  }

  async function handleVendaSaved() {
    // Atualiza imediatamente a tabela local para refletir a venda recém-criada/editada.
    try {
      const fresh = await getErpTabData('/vendas')
      if (fresh.kind === 'vendas') setPedidos(fresh.pedidos)
    } catch {
      // Se falhar, ainda dispara refresh da aba ativa como fallback.
    } finally {
      refreshActiveTab()
    }
  }

  // Count por status para os badges nas tabs
  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: pedidos.length }
    for (const p of pedidos) c[p.status] = (c[p.status] ?? 0) + 1
    return c
  }, [pedidos])

  const temFiltrosAtivos = filtroStatus !== 'todos' || !!filtroVendedor.trim() || !!filtroCliente.trim() || !!valorMin.trim() || !!valorMax.trim() || !!dataInicio || !!dataFim

  function limparFiltros() {
    setFiltroStatus('todos')
    setFiltroVendedor('')
    setFiltroCliente('')
    setValorMin('')
    setValorMax('')
    setDataInicio('')
    setDataFim('')
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6" style={{ borderBottom: '1px solid var(--ac-border)' }}>
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ac-text)' }}>Vendas</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ac-muted)' }}>
            {pedidos.filter(p => p.status !== 'entregue').length} vendas em aberto
          </p>
        </div>
        {perm.criar && (
          <Button onClick={abrirNovo}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-4">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nova venda
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="px-8 pt-4 pb-2 flex items-center gap-4 flex-wrap">
        {/* Status tabs */}
        <div className="flex items-center gap-1 flex-wrap">
          {STATUS_TABS.map((tab) => {
            const ativo = filtroStatus === tab.value
            const cfg = tab.value !== 'todos' ? STATUS_PEDIDO[tab.value as StatusPedido] : null
            return (
              <button
                key={tab.value}
                onClick={() => setFiltroStatus(tab.value)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  color: ativo ? (cfg?.color ?? 'var(--ac-text)') : 'var(--ac-muted)',
                  background: ativo ? (cfg?.bg ?? 'color-mix(in srgb, var(--ac-accent) 10%, transparent)') : 'transparent',
                  border: `1px solid ${ativo ? (cfg?.border ?? 'var(--ac-accent)') : 'transparent'}`,
                }}
              >
                {tab.label}
                {(counts[tab.value] ?? 0) > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px]"
                    style={{ background: ativo ? 'rgba(0,0,0,0.15)' : 'var(--ac-border)', color: ativo ? 'inherit' : 'var(--ac-muted)' }}>
                    {counts[tab.value]}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-8 pb-2 flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Vendedor"
          value={filtroVendedor}
          onChange={(e) => setFiltroVendedor(e.target.value)}
          list="vendedores-vendas"
          className="px-3 py-2 rounded-lg text-sm outline-none transition-all"
          style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)', color: 'var(--ac-text)', width: '180px' }}
        />
        <datalist id="vendedores-vendas">
          {usuarios.map((u) => (
            <option key={u.id} value={u.nome} />
          ))}
        </datalist>

        <input
          type="text"
          placeholder="Cliente"
          value={filtroCliente}
          onChange={(e) => setFiltroCliente(e.target.value)}
          list="clientes-vendas"
          className="px-3 py-2 rounded-lg text-sm outline-none transition-all"
          style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)', color: 'var(--ac-text)', width: '220px' }}
        />
        <datalist id="clientes-vendas">
          {clientes.map((c) => (
            <option key={c.id} value={c.nome} />
          ))}
        </datalist>

        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Valor mín."
          value={valorMin}
          onChange={(e) => setValorMin(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none transition-all"
          style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)', color: 'var(--ac-text)', width: '130px' }}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Valor máx."
          value={valorMax}
          onChange={(e) => setValorMax(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none transition-all"
          style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)', color: 'var(--ac-text)', width: '130px' }}
        />
        <input
          type="date"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none transition-all"
          style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)', color: 'var(--ac-text)' }}
        />
        <input
          type="date"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none transition-all"
          style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)', color: 'var(--ac-text)' }}
        />

        {temFiltrosAtivos && (
          <Button variant="secondary" onClick={limparFiltros}>
            Limpar filtros
          </Button>
        )}
      </div>

      {/* Tabela */}
      <div className="px-8 pb-8 pt-2">
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Código</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Vendedor</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Data</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Status</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide whitespace-nowrap" style={{ color: 'var(--ac-muted)' }}>Ação</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm" style={{ color: 'var(--ac-muted)' }}>
                    {temFiltrosAtivos ? 'Nenhuma venda para esse filtro.' : 'Nenhuma venda cadastrada ainda.'}
                  </td>
                </tr>
              )}
              {filtrados.map((p, i) => {
                const st = STATUS_PEDIDO[p.status]
                const podeEditar = p.status !== 'entregue' && perm.editar
                const podeDeletar = p.status === 'em_espera' && perm.deletar
                return (
                  <tr key={p.id}
                    style={{ borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined, background: 'var(--ac-card)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ac-bg)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ac-card)')}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: 'var(--ac-muted)' }}>
                      {p.codigo}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--ac-text)' }}>
                      {p.cliente ? (
                        <div>
                          <span className="font-medium">{p.cliente.nome}</span>
                          <span className="ml-2 text-xs" style={{ color: 'var(--ac-muted)' }}>{p.cliente.tipo}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--ac-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--ac-text)' }}>
                      {p.vendedor ? p.vendedor.nome : <span style={{ color: 'var(--ac-muted)' }}>—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--ac-muted)' }}>
                      {new Date(p.data_pedido + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                        style={{ color: st.color, background: st.bg, border: `1px solid ${st.border}` }}>
                        {st.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex flex-col gap-1 min-w-[9rem]">
                        {perm.editar && p.status === 'em_espera' && (
                          <button
                            type="button"
                            onClick={() => abrirConfirmarProducao(p)}
                            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-opacity whitespace-nowrap"
                            style={{ background: '#b45309', color: '#fff', border: 'none' }}
                          >
                            Iniciar produção
                          </button>
                        )}
                        {perm.editar && p.status === 'em_producao' && (
                          <button
                            type="button"
                            onClick={() => abrirConfirmarEntregue(p)}
                            className="text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-opacity whitespace-nowrap"
                            style={{ background: '#15803d', color: '#fff', border: 'none' }}
                          >
                            Entregue
                          </button>
                        )}
                        {p.status === 'entregue' && (
                          <span className="text-xs" style={{ color: 'var(--ac-muted)' }}>—</span>
                        )}
                        {!perm.editar && (p.status === 'em_espera' || p.status === 'em_producao') && (
                          <span className="text-xs" style={{ color: 'var(--ac-muted)' }}>—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: 'var(--ac-text)' }}>
                      {(p.valor_total ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* Ver detalhe */}
                        <button onClick={() => abrirDetalhe(p)} className="p-1.5 rounded-lg transition-colors"
                          disabled={loadingDetalheId === p.id}
                          style={{ color: 'var(--ac-muted)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ac-border)'; e.currentTarget.style.color = 'var(--ac-text)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ac-muted)' }}
                          title="Ver venda">
                          {loadingDetalheId === p.id ? (
                            <svg viewBox="0 0 24 24" className="size-4 animate-spin" fill="none" stroke="currentColor" strokeWidth={2}>
                              <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          )}
                        </button>

                        {/* Editar (somente não entregue) */}
                        {podeEditar && (
                          <button onClick={() => abrirEditar(p)} className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--ac-muted)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ac-border)'; e.currentTarget.style.color = 'var(--ac-text)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ac-muted)' }}
                            title="Editar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}

                        {/* Excluir (somente em espera) */}
                        {podeDeletar && (
                          <button onClick={() => { setDeletando(p); setErroDelete('') }} className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--ac-muted)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ac-muted)' }}
                            title="Excluir">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modais */}
      <VendaFormModal
        open={formAberto}
        onClose={() => setFormAberto(false)}
        editando={editando}
        clientes={clientes}
        facas={facas}
        usuarios={usuarios}
        onSaved={handleVendaSaved}
      />

      <VendaDetalheModal
        pedido={detalhe}
        onClose={() => setDetalhe(null)}
        onStatusChange={handleStatusChange}
        perm={perm}
      />

      {/* Confirmar mudança de status (lista) */}
      <Modal
        open={!!confirmarAcao}
        onClose={() => !loadingAcaoConfirm && setConfirmarAcao(null)}
        title={confirmarAcao?.tipo === 'producao' ? 'Iniciar produção' : 'Marcar como entregue'}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--ac-text)' }}>
            {confirmarAcao?.tipo === 'producao' ? (
              <>
                Deseja colocar a venda <strong>{confirmarAcao.pedido.codigo}</strong> em produção? O status passará de <strong>Em espera</strong> para <strong>Em produção</strong>.
              </>
            ) : (
              <>
                Confirma a entrega da venda <strong>{confirmarAcao?.pedido.codigo}</strong>? Será dada baixa no estoque das facas, registrada a movimentação e atualizada a reposição de matérias-primas (incluindo ordens de compra quando aplicável).
              </>
            )}
          </p>
          {erroAcaoConfirm && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>{erroAcaoConfirm}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={loadingAcaoConfirm} onClick={() => setConfirmarAcao(null)}>
              Cancelar
            </Button>
            <Button
              loading={loadingAcaoConfirm}
              onClick={executarAcaoConfirmada}
              style={
                confirmarAcao?.tipo === 'producao'
                  ? { background: '#b45309', color: '#fff', border: 'none' }
                  : { background: '#15803d', color: '#fff', border: 'none' }
              }
            >
              {confirmarAcao?.tipo === 'producao' ? 'Iniciar produção' : 'Confirmar entrega'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirmar exclusão */}
      <Modal open={!!deletando} onClose={() => setDeletando(null)} title="Excluir venda">
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--ac-text)' }}>
            Tem certeza que deseja excluir a venda <strong>{deletando?.codigo}</strong>? Esta ação não pode ser desfeita.
          </p>
          {erroDelete && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>{erroDelete}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeletando(null)}>Cancelar</Button>
            <Button variant="danger" loading={loadingDelete} onClick={confirmarDelete}>Excluir</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
