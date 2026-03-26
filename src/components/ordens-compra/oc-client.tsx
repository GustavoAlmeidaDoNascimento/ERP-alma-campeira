'use client'

import { useState, useMemo, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import {
  getOrdensCompra,
  gerarOC,
  gerarTodasOCs,
  atualizarQuantidadeItem,
  atualizarObservacaoOC,
  mudarStatusOC,
  deletarOC,
} from '@/lib/actions/ordens-compra'
import { STATUS_OC } from '@/types'
import type { FilaFornecedor, OrdemCompra, OrdemCompraItem, StatusOC } from '@/types'
import { useErpTabs } from '@/components/layout/erp-tabs'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }

type Props = {
  fila: FilaFornecedor[]
  ordens: OrdemCompra[]
  perm: Perm
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtData(s: string) {
  if (!s) return ''
  const [y, m, d] = s.split('T')[0].split('-')
  return `${d}/${m}/${y}`
}

function fmtQtd(n: number) {
  return Number.isInteger(n) ? String(n) : n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function totalOC(itens: OrdemCompraItem[]) {
  return itens.reduce((s, i) => s + (i.preco_unitario ?? 0) * i.quantidade, 0)
}

// ─── PDF Export ───────────────────────────────────────────────────────────────

function exportarPDF(oc: OrdemCompra) {
  const itens = oc.itens ?? []
  const total = totalOC(itens)
  const linhasItens = itens
    .map((item) => {
      const sub = (item.preco_unitario ?? 0) * item.quantidade
      return `
        <tr>
          <td>${item.materia_prima?.codigo ?? '—'}</td>
          <td>${item.materia_prima?.nome ?? '—'}</td>
          <td style="text-align:right">${fmtQtd(item.quantidade)}</td>
          <td style="text-align:right">${item.preco_unitario != null ? fmt(item.preco_unitario) : '—'}</td>
          <td style="text-align:right">${item.preco_unitario != null ? fmt(sub) : '—'}</td>
        </tr>`
    })
    .join('')

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>${oc.codigo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 40px; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
    .subtitle { font-size: 12px; color: #555; margin-bottom: 24px; }
    .meta { display: flex; gap: 40px; margin-bottom: 24px; }
    .meta div { display: flex; flex-direction: column; gap: 2px; }
    .meta strong { font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; }
    .meta span { font-size: 13px; font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    thead tr { background: #f3f4f6; }
    th { padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase;
         letter-spacing: 0.05em; color: #555; border-bottom: 2px solid #e5e7eb; }
    th:nth-child(3), th:nth-child(4), th:nth-child(5) { text-align: right; }
    td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: middle; }
    .total-row { font-weight: 700; font-size: 14px; }
    .total-row td { border-top: 2px solid #111; border-bottom: none; padding-top: 10px; }
    .obs { margin-top: 20px; padding: 12px 16px; background: #f9fafb;
           border: 1px solid #e5e7eb; border-radius: 6px; }
    .obs strong { display: block; font-size: 10px; text-transform: uppercase;
                  letter-spacing: 0.05em; color: #888; margin-bottom: 4px; }
    .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e5e7eb;
              font-size: 11px; color: #888; text-align: center; }
    @media print {
      body { padding: 20px; }
      @page { margin: 1.5cm; }
    }
  </style>
</head>
<body>
  <h1>ORDEM DE COMPRA — ${oc.codigo}</h1>
  <p class="subtitle">Alma Campeira — Cutelaria Artesanal</p>

  <div class="meta">
    <div>
      <strong>Fornecedor</strong>
      <span>${oc.fornecedor?.nome ?? 'Sem fornecedor'}</span>
    </div>
    <div>
      <strong>Data de Geração</strong>
      <span>${fmtData(oc.data_geracao)}</span>
    </div>
    <div>
      <strong>Status</strong>
      <span>${STATUS_OC[oc.status].label}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Código</th>
        <th>Item</th>
        <th>Qtd</th>
        <th>Preço Unit.</th>
        <th>Subtotal</th>
      </tr>
    </thead>
    <tbody>
      ${linhasItens}
      <tr class="total-row">
        <td colspan="4" style="text-align:right">TOTAL</td>
        <td style="text-align:right">${fmt(total)}</td>
      </tr>
    </tbody>
  </table>

  ${oc.observacao ? `<div class="obs"><strong>Observações</strong>${oc.observacao}</div>` : ''}

  <div class="footer">Gerado pelo sistema ERP Alma Campeira</div>

  <script>window.onload = () => { window.print() }</script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
}

// ─── Badge de Status ─────────────────────────────────────────────────────────

function BadgeStatus({ status }: { status: StatusOC }) {
  const cfg = STATUS_OC[status]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  )
}

// ─── Modal de Detalhes da OC ─────────────────────────────────────────────────

function OcDetalheModal({
  oc,
  perm,
  onClose,
  onRefresh,
}: {
  oc: OrdemCompra
  perm: Perm
  onClose: () => void
  onRefresh: () => void
}) {
  const [editandoQtd, setEditandoQtd] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<string | null>(null)
  const [obs, setObs] = useState(oc.observacao ?? '')
  const [salvandoObs, setSalvandoObs] = useState(false)
  const [mudandoStatus, setMudandoStatus] = useState(false)
  const [erro, setErro] = useState('')
  const [confirmandoRecebimento, setConfirmandoRecebimento] = useState(false)

  const itens = oc.itens ?? []
  const total = totalOC(
    itens.map((i) => ({
      ...i,
      quantidade: editandoQtd[i.id] !== undefined ? Number(editandoQtd[i.id]) || i.quantidade : i.quantidade,
    }))
  )

  async function salvarQtd(item: OrdemCompraItem) {
    const raw = editandoQtd[item.id]
    if (raw === undefined) return
    const qty = Number(raw)
    if (!qty || qty <= 0) { setErro('Quantidade inválida.'); return }
    setSalvando(item.id); setErro('')
    try {
      await atualizarQuantidadeItem(item.id, qty)
      setEditandoQtd((prev) => { const n = { ...prev }; delete n[item.id]; return n })
      onRefresh()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSalvando(null)
    }
  }

  async function salvarObs() {
    setSalvandoObs(true); setErro('')
    try {
      await atualizarObservacaoOC(oc.id, obs)
      onRefresh()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar observação.')
    } finally {
      setSalvandoObs(false)
    }
  }

  async function mudarStatus(status: StatusOC) {
    setMudandoStatus(true); setErro('')
    try {
      await mudarStatusOC(oc.id, status)
      onRefresh()
      onClose()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao mudar status.')
    } finally {
      setMudandoStatus(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`${oc.codigo} — ${oc.fornecedor?.nome ?? 'Sem fornecedor'}`} width="760px">
      <div className="space-y-5">
        {/* Resumo */}
        <div className="flex items-center gap-6 text-sm" style={{ color: 'var(--ac-muted)' }}>
          <span>Data: <strong style={{ color: 'var(--ac-text)' }}>{fmtData(oc.data_geracao)}</strong></span>
          <span>Status: <BadgeStatus status={oc.status} /></span>
          <span className="ml-auto font-semibold text-base" style={{ color: 'var(--ac-text)' }}>{fmt(total)}</span>
        </div>

        {/* Tabela de itens */}
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'color-mix(in srgb, var(--ac-border) 40%, transparent)' }}>
                {['Código', 'Matéria-Prima', 'Quantidade', 'Preço Unit.', 'Subtotal'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itens.map((item, idx) => {
                const isEditing = editandoQtd[item.id] !== undefined
                const displayQty = isEditing ? editandoQtd[item.id] : fmtQtd(item.quantidade)
                const sub = (item.preco_unitario ?? 0) * (isEditing ? Number(editandoQtd[item.id]) || item.quantidade : item.quantidade)
                return (
                  <tr
                    key={item.id}
                    style={{
                      borderTop: idx > 0 ? '1px solid var(--ac-border)' : undefined,
                      background: isEditing ? 'color-mix(in srgb, var(--ac-accent) 5%, transparent)' : undefined,
                    }}
                  >
                    <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--ac-muted)' }}>
                      {item.materia_prima?.codigo ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--ac-text)' }}>
                      {item.materia_prima?.nome ?? '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      {perm.editar && oc.status === 'pendente' ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={displayQty}
                            onChange={(e) => setEditandoQtd((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            onFocus={() => {
                              if (!isEditing) setEditandoQtd((prev) => ({ ...prev, [item.id]: String(item.quantidade) }))
                            }}
                            className="w-24 px-2 py-1 rounded text-sm text-right"
                            style={{
                              border: '1px solid var(--ac-border)',
                              background: 'var(--ac-bg)',
                              color: 'var(--ac-text)',
                            }}
                          />
                          {isEditing && (
                            <button
                              onClick={() => salvarQtd(item)}
                              disabled={salvando === item.id}
                              className="px-2 py-1 rounded text-xs font-semibold"
                              style={{ background: 'var(--ac-accent)', color: '#111827' }}
                            >
                              {salvando === item.id ? '…' : 'OK'}
                            </button>
                          )}
                          {isEditing && (
                            <button
                              onClick={() => setEditandoQtd((prev) => { const n = { ...prev }; delete n[item.id]; return n })}
                              className="px-1.5 py-1 rounded text-xs"
                              style={{ color: 'var(--ac-muted)' }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--ac-text)' }}>{fmtQtd(item.quantidade)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right" style={{ color: 'var(--ac-muted)' }}>
                      {item.preco_unitario != null ? fmt(item.preco_unitario) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium" style={{ color: 'var(--ac-text)' }}>
                      {item.preco_unitario != null ? fmt(sub) : '—'}
                    </td>
                  </tr>
                )
              })}
              {/* Total */}
              <tr style={{ borderTop: '2px solid var(--ac-border)', background: 'color-mix(in srgb, var(--ac-border) 20%, transparent)' }}>
                <td colSpan={4} className="px-3 py-2.5 text-right font-semibold text-sm" style={{ color: 'var(--ac-muted)' }}>
                  TOTAL
                </td>
                <td className="px-3 py-2.5 text-right font-bold text-base" style={{ color: 'var(--ac-text)' }}>
                  {fmt(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Observações */}
        {perm.editar && (
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
              Observações
            </label>
            <div className="flex gap-2">
              <textarea
                rows={2}
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                placeholder="Notas para o fornecedor..."
                className="flex-1 px-3 py-2 rounded-lg text-sm resize-none"
                style={{
                  border: '1px solid var(--ac-border)',
                  background: 'var(--ac-bg)',
                  color: 'var(--ac-text)',
                }}
              />
              <Button variant="secondary" onClick={salvarObs} loading={salvandoObs} className="self-end">
                Salvar
              </Button>
            </div>
          </div>
        )}
        {!perm.editar && oc.observacao && (
          <div className="text-sm p-3 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ac-border) 30%, transparent)', color: 'var(--ac-text)' }}>
            {oc.observacao}
          </div>
        )}

        {/* Erro */}
        {erro && (
          <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#fee2e2', color: '#dc2626' }}>
            {erro}
          </p>
        )}

        {/* Ações de status + PDF */}
        <div className="flex items-center gap-2 pt-1" style={{ borderTop: '1px solid var(--ac-border)' }}>
          <Button
            variant="secondary"
            onClick={() => exportarPDF(oc)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            Exportar PDF
          </Button>

          <div className="flex-1" />

          {perm.editar && oc.status === 'pendente' && (
            <Button
              variant="primary"
              loading={mudandoStatus}
              onClick={() => mudarStatus('enviada')}
            >
              Marcar como Enviada
            </Button>
          )}
          {perm.editar && oc.status === 'enviada' && !confirmandoRecebimento && (
            <Button
              variant="primary"
              loading={mudandoStatus}
              onClick={() => setConfirmandoRecebimento(true)}
            >
              Confirmar Recebimento
            </Button>
          )}
          {perm.editar && oc.status === 'enviada' && confirmandoRecebimento && (
            <>
              <span className="text-sm" style={{ color: 'var(--ac-muted)' }}>
                Isso vai dar entrada no estoque. Confirmar?
              </span>
              <Button variant="secondary" onClick={() => setConfirmandoRecebimento(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                loading={mudandoStatus}
                onClick={() => mudarStatus('recebida')}
              >
                Confirmar
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function OcClient({ fila, ordens, perm }: Props) {
  const { refreshActiveTab } = useErpTabs()
  const [aba, setAba] = useState<'fila' | 'historico'>('fila')
  const [ordensState, setOrdensState] = useState<OrdemCompra[]>(ordens)
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [gerandoFornecedor, setGerandoFornecedor] = useState<string | null>(null)
  const [gerandoTodas, setGerandoTodas] = useState(false)
  const [ocAberta, setOcAberta] = useState<OrdemCompra | null>(null)
  const [deletando, setDeletando] = useState<OrdemCompra | null>(null)
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [erroDelete, setErroDelete] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusOC | 'todas'>('todas')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  useEffect(() => {
    if (aba !== 'historico' || ordensState.length > 0 || loadingHistorico) return

    let cancelled = false
    async function carregarHistorico() {
      setLoadingHistorico(true)
      try {
        const data = await getOrdensCompra()
        if (!cancelled) setOrdensState(data)
      } catch (e: unknown) {
        if (!cancelled) setErro(e instanceof Error ? e.message : 'Erro ao carregar histórico.')
      } finally {
        if (!cancelled) setLoadingHistorico(false)
      }
    }

    carregarHistorico()
    return () => {
      cancelled = true
    }
  }, [aba, ordensState.length, loadingHistorico])

  async function refresh() {
    refreshActiveTab()
    setLoadingHistorico(true)
    try {
      const data = await getOrdensCompra()
      setOrdensState(data)
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao atualizar histórico.')
    } finally {
      setLoadingHistorico(false)
    }
  }

  function flash(msg: string) {
    setSucesso(msg)
    setTimeout(() => setSucesso(''), 3500)
  }

  async function handleGerarOC(fornecedor_id: string | null) {
    const chave = fornecedor_id ?? '__sem_fornecedor__'
    setGerandoFornecedor(chave); setErro('')
    try {
      const codigo = await gerarOC(fornecedor_id)
      flash(`OC ${codigo} gerada com sucesso.`)
      refresh()
      setAba('historico')
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao gerar OC.')
    } finally {
      setGerandoFornecedor(null)
    }
  }

  async function handleGerarTodas() {
    setGerandoTodas(true); setErro('')
    try {
      const n = await gerarTodasOCs()
      flash(`${n} ${n === 1 ? 'OC gerada' : 'OCs geradas'} com sucesso.`)
      refresh()
      setAba('historico')
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao gerar OCs.')
    } finally {
      setGerandoTodas(false)
    }
  }

  async function handleDeleteOC() {
    if (!deletando) return
    setLoadingDelete(true); setErroDelete('')
    try {
      await deletarOC(deletando.id)
      setDeletando(null)
      refresh()
    } catch (e: unknown) {
      setErroDelete(e instanceof Error ? e.message : 'Erro ao excluir.')
    } finally {
      setLoadingDelete(false)
    }
  }

  const ordensFiltradas = useMemo(() => {
    if (filtroStatus === 'todas') return ordensState
    return ordensState.filter((o) => o.status === filtroStatus)
  }, [ordensState, filtroStatus])

  const statusTabs: { value: StatusOC | 'todas'; label: string }[] = [
    { value: 'todas', label: 'Todas' },
    { value: 'pendente', label: 'Pendentes' },
    { value: 'enviada', label: 'Enviadas' },
    { value: 'recebida', label: 'Recebidas' },
  ]

  return (
    <>
      {/* Header */}
      <div
        className="flex items-center justify-between px-8 py-6"
        style={{ borderBottom: '1px solid var(--ac-border)' }}
      >
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ac-text)' }}>Ordens de Compra</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ac-muted)' }}>
            {fila.length > 0
              ? `${fila.length} ${fila.length === 1 ? 'fornecedor' : 'fornecedores'} com itens pendentes`
              : 'Fila de reposição vazia'}
          </p>
        </div>
        {perm.criar && fila.length > 0 && (
          <Button
            variant="primary"
            loading={gerandoTodas}
            onClick={handleGerarTodas}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
              <polyline points="16 16 12 12 8 16" />
              <line x1="12" y1="12" x2="12" y2="21" />
              <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
            </svg>
            Gerar Todas as OCs
          </Button>
        )}
      </div>

      {/* Alertas */}
      {erro && (
        <div className="mx-8 mt-4 px-4 py-3 rounded-lg text-sm" style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}>
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="mx-8 mt-4 px-4 py-3 rounded-lg text-sm" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
          {sucesso}
        </div>
      )}

      {/* Tabs */}
      <div className="px-8 pt-5">
        <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: 'color-mix(in srgb, var(--ac-border) 40%, transparent)' }}>
          {[
            { key: 'fila' as const, label: 'Fila de Reposição', count: fila.length },
            { key: 'historico' as const, label: 'Ordens de Compra', count: ordensState.length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setAba(tab.key)}
              className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all"
              style={{
                background: aba === tab.key ? 'var(--ac-card)' : 'transparent',
                color: aba === tab.key ? 'var(--ac-text)' : 'var(--ac-muted)',
                boxShadow: aba === tab.key ? '0 1px 3px rgba(0,0,0,.08)' : undefined,
              }}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                  style={{
                    background: aba === tab.key ? 'var(--ac-accent)' : 'var(--ac-border)',
                    color: aba === tab.key ? '#111827' : 'var(--ac-muted)',
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Aba: Fila ── */}
      {aba === 'fila' && (
        <div className="px-8 py-6">
          {fila.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-20 rounded-xl text-center"
              style={{ border: '2px dashed var(--ac-border)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-12 mb-3" style={{ color: 'var(--ac-border)' }}>
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect x="9" y="3" width="6" height="4" rx="1" />
              </svg>
              <p className="font-semibold mb-1" style={{ color: 'var(--ac-text)' }}>Fila vazia</p>
              <p className="text-sm" style={{ color: 'var(--ac-muted)' }}>
                Quando vendas forem marcadas como entregues, as matérias-primas aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4" style={{ maxWidth: 880 }}>
              {fila.map((grupo) => {
                const chave = grupo.fornecedor_id ?? '__sem_fornecedor__'
                const isGerando = gerandoFornecedor === chave
                const totalValor = grupo.itens.reduce((s, i) => s + i.mp_preco_custo * i.quantidade_total, 0)
                return (
                  <div
                    key={chave}
                    className="rounded-xl p-5"
                    style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)' }}
                  >
                    {/* Header do card */}
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-base" style={{ color: 'var(--ac-text)' }}>
                          {grupo.fornecedor_nome}
                        </h3>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--ac-muted)' }}>
                          {grupo.itens.length} {grupo.itens.length === 1 ? 'item' : 'itens'} · Estimativa {fmt(totalValor)}
                        </p>
                      </div>
                      {perm.criar && (
                        <Button
                          variant="primary"
                          loading={isGerando}
                          onClick={() => handleGerarOC(grupo.fornecedor_id)}
                        >
                          Gerar OC
                        </Button>
                      )}
                    </div>

                    {/* Itens */}
                    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: 'color-mix(in srgb, var(--ac-border) 40%, transparent)' }}>
                            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Código</th>
                            <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Matéria-Prima</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Qtd. Pendente</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Preço Unit.</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Estimativa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grupo.itens.map((item, idx) => (
                            <tr
                              key={item.materia_prima_id}
                              style={{ borderTop: idx > 0 ? '1px solid var(--ac-border)' : undefined }}
                            >
                              <td className="px-3 py-2.5 font-mono text-xs" style={{ color: 'var(--ac-muted)' }}>{item.mp_codigo}</td>
                              <td className="px-3 py-2.5 font-medium" style={{ color: 'var(--ac-text)' }}>{item.mp_nome}</td>
                              <td className="px-3 py-2.5 text-right font-semibold" style={{ color: 'var(--ac-accent)' }}>
                                {fmtQtd(item.quantidade_total)}
                              </td>
                              <td className="px-3 py-2.5 text-right" style={{ color: 'var(--ac-muted)' }}>
                                {fmt(item.mp_preco_custo)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-medium" style={{ color: 'var(--ac-text)' }}>
                                {fmt(item.mp_preco_custo * item.quantidade_total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Aba: Histórico ── */}
      {aba === 'historico' && (
        <div className="px-8 py-6">
          {/* Filtro de status */}
          <div className="flex gap-2 mb-5">
            {statusTabs.map((tab) => {
              const count = tab.value === 'todas'
                ? ordensState.length
                : ordensState.filter((o) => o.status === tab.value).length
              return (
                <button
                  key={tab.value}
                  onClick={() => setFiltroStatus(tab.value)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
                  style={{
                    background: filtroStatus === tab.value
                      ? 'var(--ac-accent)'
                      : 'color-mix(in srgb, var(--ac-border) 40%, transparent)',
                    color: filtroStatus === tab.value ? '#111827' : 'var(--ac-muted)',
                  }}
                >
                  {tab.label} {count > 0 && `(${count})`}
                </button>
              )
            })}
          </div>

          {loadingHistorico && (
            <div className="py-8 text-sm" style={{ color: 'var(--ac-muted)' }}>
              Carregando histórico de ordens...
            </div>
          )}

          {!loadingHistorico && ordensFiltradas.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 rounded-xl text-center"
              style={{ border: '2px dashed var(--ac-border)' }}
            >
              <p className="font-semibold mb-1" style={{ color: 'var(--ac-text)' }}>
                {filtroStatus === 'todas' ? 'Nenhuma OC gerada ainda' : `Nenhuma OC ${STATUS_OC[filtroStatus as StatusOC]?.label.toLowerCase()}`}
              </p>
              <p className="text-sm" style={{ color: 'var(--ac-muted)' }}>
                {filtroStatus === 'todas' ? 'Gere as OCs a partir da aba "Fila de Reposição".' : 'Altere o filtro para ver outras.'}
              </p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)', background: 'var(--ac-card)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--ac-border)', background: 'color-mix(in srgb, var(--ac-border) 30%, transparent)' }}>
                    {['Código', 'Fornecedor', 'Data', 'Itens', 'Total Estimado', 'Status', ''].map((h) => (
                      <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-left ${h === '' ? 'w-20' : ''}`} style={{ color: 'var(--ac-muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ordensFiltradas.map((oc, idx) => {
                    const itens = oc.itens ?? []
                    const total = totalOC(itens)
                    return (
                      <tr
                        key={oc.id}
                        className="cursor-pointer transition-colors"
                        style={{ borderTop: idx > 0 ? '1px solid var(--ac-border)' : undefined }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'color-mix(in srgb, var(--ac-border) 20%, transparent)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        onClick={() => setOcAberta(oc)}
                      >
                        <td className="px-4 py-3 font-mono font-semibold text-xs" style={{ color: 'var(--ac-accent)' }}>
                          {oc.codigo}
                        </td>
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--ac-text)' }}>
                          {oc.fornecedor?.nome ?? '—'}
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--ac-muted)' }}>
                          {fmtData(oc.data_geracao)}
                        </td>
                        <td className="px-4 py-3" style={{ color: 'var(--ac-muted)' }}>
                          {itens.length}
                        </td>
                        <td className="px-4 py-3 font-medium" style={{ color: 'var(--ac-text)' }}>
                          {fmt(total)}
                        </td>
                        <td className="px-4 py-3">
                          <BadgeStatus status={oc.status} />
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button
                              title="Exportar PDF"
                              onClick={() => exportarPDF(oc)}
                              className="p-1.5 rounded-lg transition-colors"
                              style={{ color: 'var(--ac-muted)' }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ac-border)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                                <line x1="16" y1="13" x2="8" y2="13" />
                              </svg>
                            </button>
                            {perm.deletar && oc.status === 'pendente' && (
                              <button
                                title="Excluir"
                                onClick={() => { setDeletando(oc); setErroDelete('') }}
                                className="p-1.5 rounded-lg transition-colors"
                                style={{ color: '#dc2626' }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#fee2e2')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
                                  <polyline points="3 6 5 6 21 6" />
                                  <path d="M19 6l-1 14H6L5 6" />
                                  <path d="M10 11v6M14 11v6" />
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
          )}
        </div>
      )}

      {/* Modal detalhe OC */}
      {ocAberta && (
        <OcDetalheModal
          oc={ocAberta}
          perm={perm}
          onClose={() => setOcAberta(null)}
          onRefresh={() => { refresh(); setOcAberta(null) }}
        />
      )}

      {/* Modal confirmar delete */}
      <Modal open={!!deletando} onClose={() => setDeletando(null)} title="Excluir Ordem de Compra">
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--ac-muted)' }}>
            Tem certeza que deseja excluir a OC <strong style={{ color: 'var(--ac-text)' }}>{deletando?.codigo}</strong>?
            Esta ação não pode ser desfeita.
          </p>
          {erroDelete && (
            <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#fee2e2', color: '#dc2626' }}>
              {erroDelete}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setDeletando(null)}>Cancelar</Button>
            <Button variant="danger" loading={loadingDelete} onClick={handleDeleteOC}>Excluir</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
