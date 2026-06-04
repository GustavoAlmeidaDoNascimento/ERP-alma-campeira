'use client'

import { useEffect, useState } from 'react'
import { getPedidosPorCliente } from '@/lib/actions/clientes'
import { getOrdensCompraPorFornecedor } from '@/lib/actions/fornecedores'
import { useErpTabs } from '@/components/layout/erp-tabs'
import {
  STATUS_OC,
  STATUS_PEDIDO,
  type OrdemCompraHistoricoResumo,
  type PedidoHistoricoResumo,
  type StatusOC,
  type StatusPedido,
} from '@/types'

const PAGO_BADGE = { label: 'Pago', color: '#6d28d9', bg: '#ede9fe', border: '#ddd6fe' } as const

function fmtMoeda(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR')
}

function BadgePedido({ status }: { status: StatusPedido }) {
  const cfg = STATUS_PEDIDO[status]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  )
}

function BadgeOC({ status, pago }: { status: StatusOC; pago: boolean }) {
  const cfg = STATUS_OC[status]
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
        style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
      >
        {cfg.label}
      </span>
      {pago ? (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
          style={{
            color: PAGO_BADGE.color,
            background: PAGO_BADGE.bg,
            border: `1px solid ${PAGO_BADGE.border}`,
          }}
        >
          {PAGO_BADGE.label}
        </span>
      ) : null}
    </span>
  )
}

function HistoricoVazio({ mensagem }: { mensagem: string }) {
  return (
    <p className="text-sm py-6 text-center" style={{ color: 'var(--ac-muted)' }}>
      {mensagem}
    </p>
  )
}

function HistoricoCarregando() {
  return (
    <p className="text-sm py-6 text-center" style={{ color: 'var(--ac-muted)' }}>
      Carregando histórico…
    </p>
  )
}

function HistoricoErro({ mensagem }: { mensagem: string }) {
  return (
    <p className="text-sm py-4 px-3 rounded-lg" style={{ color: '#dc2626', background: '#fee2e2' }}>
      {mensagem}
    </p>
  )
}

type HistoricoVendasProps = {
  clienteId: string
  clienteNome: string
  ativo: boolean
  podeVer: boolean
}

export function HistoricoVendasCliente({ clienteId, clienteNome, ativo, podeVer }: HistoricoVendasProps) {
  const { openTab } = useErpTabs()
  const [itens, setItens] = useState<PedidoHistoricoResumo[] | null>(null)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ativo || !podeVer) return
    let cancelado = false
    setLoading(true)
    setErro('')
    setItens(null)
    getPedidosPorCliente(clienteId)
      .then((rows) => {
        if (!cancelado) setItens(rows)
      })
      .catch((e: unknown) => {
        if (!cancelado) {
          setErro(e instanceof Error ? e.message : 'Erro ao carregar vendas.')
          setItens([])
        }
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [ativo, podeVer, clienteId])

  if (!podeVer) {
    return (
      <HistoricoVazio mensagem="Sem permissão para visualizar vendas deste cliente." />
    )
  }

  if (loading) return <HistoricoCarregando />
  if (erro) return <HistoricoErro mensagem={erro} />
  if (!itens || itens.length === 0) {
    return <HistoricoVazio mensagem="Nenhuma venda registrada para este cliente." />
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
            <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Pedido</th>
            <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Data</th>
            <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Vendedor</th>
            <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Status</th>
            <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((p, i) => (
            <tr
              key={p.id}
              className="cursor-pointer"
              style={{
                borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined,
                background: 'var(--ac-card)',
              }}
              onClick={() =>
                openTab(`/vendas?cliente=${encodeURIComponent(clienteNome)}`)
              }
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ac-bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ac-card)')}
              title="Abrir aba Vendas filtrada por este cliente"
            >
              <td className="px-3 py-2.5 font-mono text-xs font-semibold" style={{ color: 'var(--ac-accent)' }}>
                {p.sequencial != null && <>#{p.sequencial}<span className="mx-1 opacity-60">·</span></>}
                {p.codigo}
              </td>
              <td className="px-3 py-2.5" style={{ color: 'var(--ac-muted)' }}>{fmtData(p.data_pedido)}</td>
              <td className="px-3 py-2.5" style={{ color: 'var(--ac-text)' }}>{p.vendedor_nome ?? '—'}</td>
              <td className="px-3 py-2.5"><BadgePedido status={p.status} /></td>
              <td className="px-3 py-2.5 text-right tabular-nums font-medium" style={{ color: 'var(--ac-text)' }}>
                {fmtMoeda(p.valor_total ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs px-3 py-2" style={{ color: 'var(--ac-muted)', borderTop: '1px solid var(--ac-border)' }}>
        {itens.length} {itens.length === 1 ? 'venda' : 'vendas'} · clique em uma linha para abrir Vendas
      </p>
    </div>
  )
}

type HistoricoOCProps = {
  fornecedorId: string
  ativo: boolean
  podeVer: boolean
}

export function HistoricoOCFornecedor({ fornecedorId, ativo, podeVer }: HistoricoOCProps) {
  const { openTab } = useErpTabs()
  const [itens, setItens] = useState<OrdemCompraHistoricoResumo[] | null>(null)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!ativo || !podeVer) return
    let cancelado = false
    setLoading(true)
    setErro('')
    setItens(null)
    getOrdensCompraPorFornecedor(fornecedorId)
      .then((rows) => {
        if (!cancelado) setItens(rows)
      })
      .catch((e: unknown) => {
        if (!cancelado) {
          setErro(e instanceof Error ? e.message : 'Erro ao carregar ordens de compra.')
          setItens([])
        }
      })
      .finally(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [ativo, podeVer, fornecedorId])

  if (!podeVer) {
    return (
      <HistoricoVazio mensagem="Sem permissão para visualizar ordens de compra deste fornecedor." />
    )
  }

  if (loading) return <HistoricoCarregando />
  if (erro) return <HistoricoErro mensagem={erro} />
  if (!itens || itens.length === 0) {
    return <HistoricoVazio mensagem="Nenhuma ordem de compra registrada para este fornecedor." />
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
            <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>OC</th>
            <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Pedido origem</th>
            <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Data</th>
            <th className="text-left px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Status</th>
            <th className="text-right px-3 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Total</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((oc, i) => (
            <tr
              key={oc.id}
              className="cursor-pointer"
              style={{
                borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined,
                background: 'var(--ac-card)',
              }}
              onClick={() => openTab('/ordens-compra')}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ac-bg)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ac-card)')}
              title="Abrir aba Ordens de compra"
            >
              <td className="px-3 py-2.5 font-mono text-xs font-semibold" style={{ color: 'var(--ac-accent)' }}>
                {oc.sequencial_fornecedor != null && (
                  <>#{oc.sequencial_fornecedor}<span className="mx-1 opacity-60">·</span></>
                )}
                {oc.codigo}
              </td>
              <td className="px-3 py-2.5 text-xs">
                {oc.pedido_codigo ? (
                  <div>
                    <div className="font-mono font-semibold" style={{ color: 'var(--ac-text)' }}>
                      {oc.pedido_sequencial != null && (
                        <span style={{ color: 'var(--ac-accent)' }}>#{oc.pedido_sequencial} · </span>
                      )}
                      {oc.pedido_codigo}
                    </div>
                    {oc.cliente_nome ? (
                      <div style={{ color: 'var(--ac-muted)' }}>{oc.cliente_nome}</div>
                    ) : null}
                  </div>
                ) : (
                  <span style={{ color: 'var(--ac-muted)' }}>Manual</span>
                )}
              </td>
              <td className="px-3 py-2.5" style={{ color: 'var(--ac-muted)' }}>{fmtData(oc.data_geracao)}</td>
              <td className="px-3 py-2.5"><BadgeOC status={oc.status} pago={oc.pago} /></td>
              <td className="px-3 py-2.5 text-right tabular-nums font-medium" style={{ color: 'var(--ac-text)' }}>
                {fmtMoeda(oc.valor_total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs px-3 py-2" style={{ color: 'var(--ac-muted)', borderTop: '1px solid var(--ac-border)' }}>
        {itens.length} {itens.length === 1 ? 'ordem' : 'ordens'} · clique em uma linha para abrir Ordens de compra
      </p>
    </div>
  )
}
