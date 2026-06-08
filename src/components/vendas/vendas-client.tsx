'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { VendaFormModal } from './venda-form-modal'
import { VendaDetalheModal } from './venda-detalhe-modal'
import { deletarVenda, getVendaDetalhe, getVendas } from '@/lib/actions/vendas'
import { STATUS_PEDIDO } from '@/types'
import type { Pedido, Cliente, Faca, StatusPedido } from '@/types'
import { useErpTabs } from '@/components/layout/erp-tabs'
import { useVendas } from '@/lib/query/hooks'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }

type Props = {
  pedidos: Pedido[]
  clientes: Cliente[]
  facas: Faca[]
  usuarios: { id: string; nome: string }[]
  perm: Perm
  usuarioLogadoId: string | null
}

const STATUS_TABS: { value: StatusPedido | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'em_espera', label: 'Aguardando pagamento' },
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

export function VendasClient({ pedidos: pedidosIniciais, clientes, facas, usuarios, perm, usuarioLogadoId }: Props) {
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
  type OrdemColuna = 'cliente' | 'vendedor' | 'data' | 'status' | 'frete' | 'total'
  /** Um único estado evita aninhar setters (no Strict Mode o updater duplicado anulava o toggle asc/desc). */
  const [ordenacao, setOrdenacao] = useState<{ coluna: OrdemColuna | null; dir: 'asc' | 'desc' }>({
    coluna: null,
    dir: 'asc',
  })

  function toggleOrdem(coluna: OrdemColuna) {
    setOrdenacao((prev) => {
      if (prev.coluna === coluna) {
        return { coluna, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      }
      return { coluna, dir: 'asc' }
    })
  }

  // Sincroniza com props (SSR) e com o cache do TanStack Query (Realtime).
  useEffect(() => {
    setPedidos(pedidosIniciais)
  }, [pedidosIniciais])
  const { data: vendasHook } = useVendas({ initialData: pedidosIniciais })
  useEffect(() => {
    if (vendasHook) setPedidos(vendasHook)
  }, [vendasHook])

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
      const fresh = await getVendas()
      setPedidos(fresh)
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

  const ordenados = useMemo(() => {
    const ordemColuna = ordenacao.coluna
    if (!ordemColuna) return filtrados
    const dir = ordenacao.dir === 'asc' ? 1 : -1
    return [...filtrados].sort((a, b) => {
      switch (ordemColuna) {
        case 'cliente': {
          const na = a.cliente?.nome ?? ''
          const nb = b.cliente?.nome ?? ''
          return na.localeCompare(nb, 'pt-BR', { sensitivity: 'base' }) * dir
        }
        case 'vendedor': {
          const na = a.vendedor?.nome ?? ''
          const nb = b.vendedor?.nome ?? ''
          return na.localeCompare(nb, 'pt-BR', { sensitivity: 'base' }) * dir
        }
        case 'data':
          return (a.data_pedido < b.data_pedido ? -1 : a.data_pedido > b.data_pedido ? 1 : 0) * dir
        case 'status':
          return a.status.localeCompare(b.status) * dir
        case 'frete':
          return ((a.frete ?? 0) - (b.frete ?? 0)) * dir
        case 'total':
          return ((a.valor_total ?? 0) - (b.valor_total ?? 0)) * dir
        default:
          return 0
      }
    })
  }, [filtrados, ordenacao])

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
      const fresh = await getVendas()
      setPedidos(fresh)
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
                {(['cliente', 'vendedor', 'data', 'status'] as const).map((col) => (
                  <th key={col}
                    onClick={() => toggleOrdem(col)}
                    className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide select-none cursor-pointer"
                    style={{ color: ordenacao.coluna === col ? 'var(--ac-accent)' : 'var(--ac-muted)', whiteSpace: 'nowrap' }}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col === 'cliente' ? 'Cliente' : col === 'vendedor' ? 'Vendedor' : col === 'data' ? 'Data' : 'Status'}
                      <span style={{ opacity: ordenacao.coluna === col ? 1 : 0.3, fontSize: '10px' }}>
                        {ordenacao.coluna === col ? (ordenacao.dir === 'asc' ? '▲' : '▼') : '▲'}
                      </span>
                    </span>
                  </th>
                ))}
                {(['frete', 'total'] as const).map((col) => (
                  <th key={col}
                    onClick={() => toggleOrdem(col)}
                    className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide select-none cursor-pointer"
                    style={{ color: ordenacao.coluna === col ? 'var(--ac-accent)' : 'var(--ac-muted)', whiteSpace: 'nowrap' }}
                  >
                    <span className="inline-flex items-center justify-end gap-1">
                      {col === 'frete' ? 'Frete' : 'Total'}
                      <span style={{ opacity: ordenacao.coluna === col ? 1 : 0.3, fontSize: '10px' }}>
                        {ordenacao.coluna === col ? (ordenacao.dir === 'asc' ? '▲' : '▼') : '▲'}
                      </span>
                    </span>
                  </th>
                ))}
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
              {ordenados.map((p, i) => {
                const st = STATUS_PEDIDO[p.status]
                const podeEditar = p.status !== 'entregue' && perm.editar
                const podeDeletar = perm.deletar
                return (
                  <tr
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        if ((e.target as HTMLElement).closest('button')) return
                        void abrirDetalhe(p)
                      }
                    }}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('button')) return
                      void abrirDetalhe(p)
                    }}
                    style={{
                      borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined,
                      background: 'var(--ac-card)',
                      cursor: loadingDetalheId === p.id ? 'wait' : 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ac-bg)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ac-card)')}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: 'var(--ac-muted)' }}>
                      {p.sequencial != null && (
                        <span style={{ color: 'var(--ac-accent)' }}>#{p.sequencial}</span>
                      )}
                      {p.sequencial != null && <span className="mx-1.5 opacity-50">·</span>}
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
                    <td className="px-4 py-3 text-right tabular-nums text-sm" style={{ color: (p.frete ?? 0) > 0 ? 'var(--ac-text)' : 'var(--ac-muted)' }}>
                      {(p.frete ?? 0) > 0
                        ? (p.frete ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: 'var(--ac-text)' }}>
                      {(p.valor_total ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
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

                        {/* Excluir (somente aguardando pagamento) */}
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
        usuarioLogadoId={usuarioLogadoId}
        onSaved={handleVendaSaved}
      />

      <VendaDetalheModal
        pedido={detalhe}
        onClose={() => setDetalhe(null)}
        onStatusChange={handleStatusChange}
        perm={perm}
      />

      {/* Confirmar exclusão */}
      <Modal open={!!deletando} onClose={() => setDeletando(null)} title="Excluir venda">
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--ac-text)' }}>
            Tem certeza que deseja excluir a venda{' '}
            <strong>
              {deletando?.sequencial != null ? `#${deletando.sequencial} · ` : ''}
              {deletando?.codigo}
            </strong>? Esta ação não pode ser desfeita.
          </p>
          {deletando?.status === 'entregue' && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#92400e', background: '#fef3c7' }}>
              Esta venda já foi entregue. As facas voltarão ao estoque e será
              registrada uma movimentação de ajuste para auditoria.
            </p>
          )}
          {deletando && (deletando.forma_pagamento === 'boleto') && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#92400e', background: '#fef3c7' }}>
              Boletos vinculados sem parcelas pagas serão removidos junto. Se
              houver parcelas já recebidas, estorne primeiro pela tela de boletos.
            </p>
          )}
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
