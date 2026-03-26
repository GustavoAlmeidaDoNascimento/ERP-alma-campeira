'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { VendaFormModal } from './venda-form-modal'
import { VendaDetalheModal } from './venda-detalhe-modal'
import { deletarVenda, getVendaDetalhe } from '@/lib/actions/vendas'
import { getErpTabData } from '@/lib/actions/erp-tab-data'
import { STATUS_PEDIDO } from '@/types'
import type { Pedido, Cliente, Faca, StatusPedido } from '@/types'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }

type Props = {
  pedidos: Pedido[]
  clientes: Cliente[]
  facas: Faca[]
  perm: Perm
}

const STATUS_TABS: { value: StatusPedido | 'todos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'em_espera', label: 'Em espera' },
  { value: 'em_producao', label: 'Em Produção' },
  { value: 'entregue', label: 'Entregue' },
]

export function VendasClient({ pedidos: pedidosIniciais, clientes, facas, perm }: Props) {
  const [pedidos, setPedidos] = useState<Pedido[]>(pedidosIniciais)
  const [formAberto, setFormAberto] = useState(false)
  const [editando, setEditando] = useState<Pedido | null>(null)
  const [detalhe, setDetalhe] = useState<Pedido | null>(null)
  const [loadingDetalheId, setLoadingDetalheId] = useState<string | null>(null)
  const [deletando, setDeletando] = useState<Pedido | null>(null)
  const [erroDelete, setErroDelete] = useState('')
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [filtroStatus, setFiltroStatus] = useState<StatusPedido | 'todos'>('todos')
  const [busca, setBusca] = useState('')

  // Sincroniza quando TabPane re-busca dados (ex: ao reabrir a aba)
  useEffect(() => {
    setPedidos(pedidosIniciais)
  }, [pedidosIniciais])

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
  }, [])

  const filtrados = useMemo(() => {
    return pedidos.filter((p) => {
      const matchStatus = filtroStatus === 'todos' || p.status === filtroStatus
      const matchBusca = !busca.trim() ||
        p.codigo.toLowerCase().includes(busca.toLowerCase()) ||
        p.cliente?.nome?.toLowerCase().includes(busca.toLowerCase())
      return matchStatus && matchBusca
    })
  }, [pedidos, filtroStatus, busca])

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
    } catch (e: unknown) {
      setErroDelete(e instanceof Error ? e.message : 'Erro ao excluir.')
    } finally {
      setLoadingDelete(false)
    }
  }

  // Count por status para os badges nas tabs
  const counts = useMemo(() => {
    const c: Record<string, number> = { todos: pedidos.length }
    for (const p of pedidos) c[p.status] = (c[p.status] ?? 0) + 1
    return c
  }, [pedidos])

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

        {/* Busca */}
        <div className="relative ml-auto">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
            className="absolute left-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none"
            style={{ color: 'var(--ac-muted)' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Buscar código ou cliente..."
            value={busca} onChange={(e) => setBusca(e.target.value)}
            className="pl-9 pr-3 py-2 rounded-lg text-sm outline-none transition-all"
            style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)', color: 'var(--ac-text)', width: '220px' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ac-accent)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ac-border)' }}
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="px-8 pb-8 pt-2">
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Código</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Cliente</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Data</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Status</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-sm" style={{ color: 'var(--ac-muted)' }}>
                    {busca || filtroStatus !== 'todos' ? 'Nenhuma venda para esse filtro.' : 'Nenhuma venda cadastrada ainda.'}
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
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--ac-muted)' }}>
                      {new Date(p.data_pedido + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                        style={{ color: st.color, background: st.bg, border: `1px solid ${st.border}` }}>
                        {st.label}
                      </span>
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
