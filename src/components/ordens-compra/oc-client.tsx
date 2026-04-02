'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { SearchableSelect } from '@/components/ui/searchable-select'
import {
  getFilaReposicao,
  getOrdensCompra,
  gerarOC,
  criarOrdemCompraManual,
  atualizarUnidadesAdicionaisItem,
  criarItemOrdemCompra,
  atualizarObservacaoOC,
  mudarStatusOC,
  deletarOC,
} from '@/lib/actions/ordens-compra'
import { getFornecedores } from '@/lib/actions/fornecedores'
import { STATUS_OC } from '@/types'
import type { FilaFornecedor, Fornecedor, MateriaPrima, OrdemCompra, OrdemCompraItem, StatusOC } from '@/types'
import { useErpTabs } from '@/components/layout/erp-tabs'
import { getMatériasPrimas } from '@/lib/actions/materias-primas'
import { getOptimizedSupabaseImageUrl } from '@/lib/supabase/optimized-image'

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
  onRequestExcluir,
}: {
  oc: OrdemCompra
  perm: Perm
  onClose: () => void
  onRefresh: () => void
  /** Abre o modal de confirmação de exclusão (OC pendente + permissão). */
  onRequestExcluir?: () => void
}) {
  const [editandoAdicional, setEditandoAdicional] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<string | null>(null)
  const [obs, setObs] = useState(oc.observacao ?? '')
  const [salvandoObs, setSalvandoObs] = useState(false)
  const [mudandoStatus, setMudandoStatus] = useState(false)
  const [erro, setErro] = useState('')
  const [confirmandoRecebimento, setConfirmandoRecebimento] = useState(false)
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([])
  const [carregandoMateriasPrimas, setCarregandoMateriasPrimas] = useState(false)
  const [materiaPrimaParaAdicionar, setMateriaPrimaParaAdicionar] = useState('')
  const [adicionalParaAdicionar, setAdicionalParaAdicionar] = useState('')
  const [adicionandoItem, setAdicionandoItem] = useState(false)

  function parseNumero(raw: string): number {
    const v = raw.trim().replace(',', '.')
    const n = Number(v)
    return Number.isFinite(n) ? n : NaN
  }

  const itens = useMemo(() => oc.itens ?? [], [oc.itens])
  const idsMateriaJaNoPedido = useMemo(() => new Set(itens.map((i) => i.materia_prima_id)), [itens])

  const opcoesMateriaPrima = useMemo(
    () =>
      materiasPrimas
        .filter((mp) => !idsMateriaJaNoPedido.has(mp.id))
        .map((mp) => {
          const imageUrl =
            getOptimizedSupabaseImageUrl(mp.foto_url, {
              width: 80,
              height: 80,
              quality: 72,
              resize: 'cover',
              fallbackUrl: '',
            }) || null
          return {
            value: mp.id,
            label: `${mp.codigo} — ${mp.nome}`,
            imageUrl,
          }
        }),
    [materiasPrimas, idsMateriaJaNoPedido]
  )

  useEffect(() => {
    if (!perm.editar || oc.status !== 'pendente') return
    if (materiasPrimas.length > 0) return

    let cancelled = false
    async function carregar() {
      setCarregandoMateriasPrimas(true)
      setErro('')
      try {
        const mps = await getMatériasPrimas(200)
        if (!cancelled) setMateriasPrimas(mps)
      } catch (e: unknown) {
        if (!cancelled) setErro(e instanceof Error ? e.message : 'Erro ao carregar matérias-primas.')
      } finally {
        if (!cancelled) setCarregandoMateriasPrimas(false)
      }
    }

    carregar()
    return () => {
      cancelled = true
    }
  }, [perm.editar, oc.status, materiasPrimas.length])

  const total = totalOC(
    itens.map((i) => {
      const vendido = Number(i.quantidade_vendida ?? i.quantidade)
      const adicionalBase = Number(i.quantidade_adicional ?? 0)
      const rawAdicional = editandoAdicional[i.id]
      const adicionalEditado = rawAdicional !== undefined ? parseNumero(rawAdicional) : adicionalBase
      const adicional = Number.isFinite(adicionalEditado) ? adicionalEditado : adicionalBase
      return { ...i, quantidade: vendido + adicional }
    })
  )

  async function salvarAdicional(item: OrdemCompraItem) {
    const raw = editandoAdicional[item.id]
    if (raw === undefined) return
    const adicional = parseNumero(raw)
    if (!Number.isFinite(adicional) || adicional < 0) {
      setErro('Unidades adicionais inválidas.')
      return
    }
    setSalvando(item.id); setErro('')
    try {
      await atualizarUnidadesAdicionaisItem(item.id, adicional)
      setEditandoAdicional((prev) => { const n = { ...prev }; delete n[item.id]; return n })
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
                {[
                  'Código',
                  'Matéria-Prima',
                  'Vendido',
                  'Unidades adicionais',
                  'Qtd Total',
                  'Preço Unit.',
                  'Subtotal',
                ].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itens.map((item, idx) => {
                const isEditing = editandoAdicional[item.id] !== undefined
                const vendido = Number(item.quantidade_vendida ?? item.quantidade)
                const adicionalBase = Number(item.quantidade_adicional ?? 0)
                const rawAdicional = editandoAdicional[item.id]
                const adicionalEditado = rawAdicional !== undefined ? parseNumero(rawAdicional) : adicionalBase
                const adicional = Number.isFinite(adicionalEditado) ? adicionalEditado : adicionalBase
                const totalQty = vendido + adicional
                const sub = (item.preco_unitario ?? 0) * totalQty
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
                    <td className="px-3 py-2.5 text-right" style={{ color: 'var(--ac-muted)' }}>
                      {fmtQtd(vendido)}
                    </td>
                    <td className="px-3 py-2.5">
                      {perm.editar && oc.status === 'pendente' ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={isEditing ? editandoAdicional[item.id] : String(adicionalBase)}
                            onChange={(e) => setEditandoAdicional((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            onFocus={() => {
                              if (!isEditing) setEditandoAdicional((prev) => ({ ...prev, [item.id]: String(adicionalBase) }))
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
                              onClick={() => salvarAdicional(item)}
                              disabled={salvando === item.id}
                              className="px-2 py-1 rounded text-xs font-semibold"
                              style={{ background: 'var(--ac-accent)', color: '#111827' }}
                            >
                              {salvando === item.id ? '…' : 'OK'}
                            </button>
                          )}
                          {isEditing && (
                            <button
                              onClick={() => setEditandoAdicional((prev) => { const n = { ...prev }; delete n[item.id]; return n })}
                              className="px-1.5 py-1 rounded text-xs"
                              style={{ color: 'var(--ac-muted)' }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--ac-text)' }}>{fmtQtd(adicionalBase)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right" style={{ color: 'var(--ac-muted)' }}>
                      <span style={{ color: 'var(--ac-text)' }}>{fmtQtd(totalQty)}</span>
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
                <td colSpan={6} className="px-3 py-2.5 text-right font-semibold text-sm" style={{ color: 'var(--ac-muted)' }}>
                  TOTAL
                </td>
                <td className="px-3 py-2.5 text-right font-bold text-base" style={{ color: 'var(--ac-text)' }}>
                  {fmt(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Adicionar matéria-prima */}
        {perm.editar && oc.status === 'pendente' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold" style={{ color: 'var(--ac-text)' }}>
                Adicionar matéria-prima
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1 min-w-[min(100%,240px)] sm:min-w-[240px]">
                <label
                  htmlFor="oc-mp-search"
                  className="text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--ac-muted)' }}
                >
                  Matéria-prima
                </label>
                <SearchableSelect
                  id="oc-mp-search"
                  value={materiaPrimaParaAdicionar}
                  onChange={setMateriaPrimaParaAdicionar}
                  options={opcoesMateriaPrima}
                  placeholder="Pesquisar por código ou nome…"
                  loading={carregandoMateriasPrimas}
                  emptyMessage="Nenhuma matéria-prima disponível para este pedido"
                />
              </div>

              <div className="w-[220px]">
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                  Unidades adicionais
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={adicionalParaAdicionar}
                  onChange={(e) => setAdicionalParaAdicionar(e.target.value)}
                  className="w-full mt-1 px-3 py-2 rounded-lg text-sm text-right"
                  style={{
                    background: 'var(--ac-bg)',
                    border: '1px solid var(--ac-border)',
                    color: 'var(--ac-text)',
                  }}
                />
              </div>

              <Button
                variant="primary"
                loading={adicionandoItem}
                disabled={!materiaPrimaParaAdicionar || adicionandoItem}
                onClick={async () => {
                  setAdicionandoItem(true)
                  setErro('')
                  try {
                    const adicional = parseNumero(adicionalParaAdicionar)
                    if (!Number.isFinite(adicional) || adicional <= 0) {
                      setErro('Unidades adicionais devem ser maiores que zero.')
                      return
                    }
                    await criarItemOrdemCompra(oc.id, materiaPrimaParaAdicionar, adicional)
                    setMateriaPrimaParaAdicionar('')
                    setAdicionalParaAdicionar('')
                    onRefresh()
                  } catch (e: unknown) {
                    setErro(e instanceof Error ? e.message : 'Erro ao adicionar matéria-prima.')
                  } finally {
                    setAdicionandoItem(false)
                  }
                }}
              >
                Adicionar
              </Button>
            </div>

          </div>
        )}

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
        <div
          className="flex flex-wrap items-center gap-2 pt-1"
          style={{ borderTop: '1px solid var(--ac-border)' }}
        >
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

          {perm.deletar && oc.status === 'pendente' && onRequestExcluir && (
            <Button variant="danger" onClick={onRequestExcluir}>
              Excluir OC
            </Button>
          )}

          <div className="flex-1 min-w-[0.5rem]" />

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

// ─── Modal: Nova OC manual ───────────────────────────────────────────────────

type LinhaCriarOc = { key: string; materia_prima_id: string; quantidade: string; preco_unitario: string }

function OcCriarModal({
  open,
  onClose,
  onCriada,
}: {
  open: boolean
  onClose: () => void
  onCriada: (codigo: string) => void
}) {
  const [fornecedorId, setFornecedorId] = useState('')
  const [observacao, setObservacao] = useState('')
  const [linhas, setLinhas] = useState<LinhaCriarOc[]>(() => [
    { key: `${Date.now()}-0`, materia_prima_id: '', quantidade: '1', preco_unitario: '' },
  ])
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([])
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const opcoesFornecedor = useMemo(
    () => [
      { value: '', label: 'Sem fornecedor' },
      ...fornecedores.map((f) => ({ value: f.id, label: f.nome })),
    ],
    [fornecedores]
  )

  const mpById = useMemo(() => new Map(materiasPrimas.map((m) => [m.id, m])), [materiasPrimas])

  const opcoesMateria = useMemo(
    () =>
      materiasPrimas.map((mp) => {
        const imageUrl =
          getOptimizedSupabaseImageUrl(mp.foto_url, {
            width: 80,
            height: 80,
            quality: 72,
            resize: 'cover',
            fallbackUrl: '',
          }) || null
        return {
          value: mp.id,
          label: `${mp.codigo} — ${mp.nome}`,
          imageUrl,
        }
      }),
    [materiasPrimas]
  )

  useEffect(() => {
    if (!open) return
    setErro('')
    setFornecedorId('')
    setObservacao('')
    setLinhas([{ key: `${Date.now()}-0`, materia_prima_id: '', quantidade: '1', preco_unitario: '' }])

    let cancelled = false
    async function load() {
      setCarregando(true)
      try {
        const [f, m] = await Promise.all([getFornecedores(150), getMatériasPrimas(300)])
        if (!cancelled) {
          setFornecedores(f)
          setMateriasPrimas(m)
        }
      } catch (e: unknown) {
        if (!cancelled) setErro(e instanceof Error ? e.message : 'Erro ao carregar dados.')
      } finally {
        if (!cancelled) setCarregando(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [open])

  function parseNumero(raw: string): number {
    const v = raw.trim().replace(',', '.')
    const n = Number(v)
    return Number.isFinite(n) ? n : NaN
  }

  function addLinha() {
    setLinhas((prev) => [...prev, { key: `${Date.now()}-${prev.length}`, materia_prima_id: '', quantidade: '1', preco_unitario: '' }])
  }

  function removeLinha(key: string) {
    setLinhas((prev) => (prev.length <= 1 ? prev : prev.filter((l) => l.key !== key)))
  }

  function updateLinha(key: string, patch: Partial<LinhaCriarOc>) {
    setLinhas((prev) =>
      prev.map((l) => {
        if (l.key !== key) return l
        const next = { ...l, ...patch }
        if (patch.materia_prima_id !== undefined && patch.materia_prima_id) {
          const mp = mpById.get(patch.materia_prima_id)
          if (mp) next.preco_unitario = String(mp.preco_custo ?? '')
        }
        return next
      })
    )
  }

  async function salvar() {
    const itensValidos = linhas.filter((l) => l.materia_prima_id)
    if (itensValidos.length === 0) {
      setErro('Selecione ao menos uma matéria-prima.')
      return
    }
    const payload: { materia_prima_id: string; quantidade: number; preco_unitario?: number | null }[] = []
    for (const l of itensValidos) {
      const q = parseNumero(l.quantidade)
      if (!Number.isFinite(q) || q <= 0) {
        setErro('Todas as quantidades devem ser maiores que zero.')
        return
      }
      const precoRaw = l.preco_unitario.trim()
      let preco_unitario: number | null = null
      if (precoRaw !== '') {
        const p = parseNumero(precoRaw)
        if (!Number.isFinite(p) || p < 0) {
          setErro('Preço unitário inválido em um dos itens.')
          return
        }
        preco_unitario = p
      }
      payload.push({ materia_prima_id: l.materia_prima_id, quantidade: q, preco_unitario })
    }

    setErro('')
    setSalvando(true)
    try {
      const codigo = await criarOrdemCompraManual({
        fornecedor_id: fornecedorId || null,
        observacao: observacao.trim() || null,
        itens: payload,
      })
      onCriada(codigo)
      onClose()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar ordem de compra.')
    } finally {
      setSalvando(false)
    }
  }

  const totalEstimado = useMemo(() => {
    let s = 0
    for (const l of linhas) {
      if (!l.materia_prima_id) continue
      const q = parseNumero(l.quantidade)
      if (!Number.isFinite(q) || q <= 0) continue
      let unit: number
      const precoRaw = l.preco_unitario.trim()
      if (precoRaw !== '') {
        const p = parseNumero(precoRaw)
        unit = Number.isFinite(p) ? p : NaN
      } else {
        unit = mpById.get(l.materia_prima_id)?.preco_custo ?? 0
      }
      if (Number.isFinite(unit)) s += q * unit
    }
    return s
  }, [linhas, mpById])

  return (
    <Modal open={open} onClose={onClose} title="Nova ordem de compra">
      <div className="flex flex-col gap-4 max-h-[min(85vh,720px)]">
        {erro && (
          <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#fee2e2', color: '#dc2626' }}>
            {erro}
          </p>
        )}

        <div className="space-y-1.5 shrink-0">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
            Fornecedor
          </label>
          <SearchableSelect
            value={fornecedorId}
            onChange={setFornecedorId}
            options={opcoesFornecedor}
            placeholder="Pesquisar fornecedor…"
            disabled={carregando}
            loading={carregando}
            emptyMessage="Nenhum fornecedor"
          />
        </div>

        <div className="space-y-1.5 shrink-0">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
            Observações (opcional)
          </label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            className="w-full rounded-lg px-3 py-2 text-sm resize-y min-h-[3rem]"
            style={{
              border: '1px solid var(--ac-border)',
              background: 'var(--ac-bg)',
              color: 'var(--ac-text)',
            }}
            placeholder="Notas internas sobre esta OC…"
          />
        </div>

        <div className="min-h-0 flex flex-col gap-2 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
              Itens
            </span>
            <Button type="button" variant="secondary" onClick={addLinha} disabled={carregando}>
              Adicionar linha
            </Button>
          </div>

          <div className="overflow-x-auto rounded-lg -mx-1 px-1" style={{ border: '1px solid var(--ac-border)' }}>
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr style={{ background: 'color-mix(in srgb, var(--ac-border) 40%, transparent)' }}>
                  <th className="px-2 py-2 text-left text-xs font-semibold uppercase" style={{ color: 'var(--ac-muted)' }}>
                    Matéria-prima
                  </th>
                  <th className="px-2 py-2 text-right text-xs font-semibold uppercase w-[100px]" style={{ color: 'var(--ac-muted)' }}>
                    Qtd
                  </th>
                  <th className="px-2 py-2 text-right text-xs font-semibold uppercase w-[120px]" style={{ color: 'var(--ac-muted)' }}>
                    Preço unit.
                  </th>
                  <th className="w-10 px-1 py-2" />
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.key} style={{ borderTop: '1px solid var(--ac-border)' }}>
                    <td className="px-2 py-2 align-top">
                      <SearchableSelect
                        value={l.materia_prima_id}
                        onChange={(v) => updateLinha(l.key, { materia_prima_id: v })}
                        options={opcoesMateria}
                        placeholder="Escolher…"
                        disabled={carregando}
                        loading={carregando}
                        className="min-w-[200px]"
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={l.quantidade}
                        onChange={(e) => updateLinha(l.key, { quantidade: e.target.value })}
                        className="w-full px-2 py-1.5 rounded text-sm text-right"
                        style={{
                          border: '1px solid var(--ac-border)',
                          background: 'var(--ac-bg)',
                          color: 'var(--ac-text)',
                        }}
                      />
                    </td>
                    <td className="px-2 py-2 align-top">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={l.preco_unitario}
                        onChange={(e) => updateLinha(l.key, { preco_unitario: e.target.value })}
                        placeholder="Custo MP"
                        className="w-full px-2 py-1.5 rounded text-sm text-right"
                        style={{
                          border: '1px solid var(--ac-border)',
                          background: 'var(--ac-bg)',
                          color: 'var(--ac-text)',
                        }}
                      />
                    </td>
                    <td className="px-1 py-2 align-top text-center">
                      <button
                        type="button"
                        title="Remover linha"
                        disabled={linhas.length <= 1}
                        onClick={() => removeLinha(l.key)}
                        className="p-1.5 rounded-lg disabled:opacity-40"
                        style={{ color: '#dc2626' }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14H6L5 6" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-right font-medium" style={{ color: 'var(--ac-text)' }}>
            Total estimado: <span style={{ color: 'var(--ac-accent)' }}>{fmt(totalEstimado)}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-end pt-2 shrink-0" style={{ borderTop: '1px solid var(--ac-border)' }}>
          <Button variant="secondary" onClick={onClose} disabled={salvando}>
            Cancelar
          </Button>
          <Button variant="primary" loading={salvando} onClick={salvar} disabled={carregando}>
            Criar ordem
          </Button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Componente Principal ─────────────────────────────────────────────────────

export function OcClient({ fila, ordens, perm }: Props) {
  const { refreshActiveTab } = useErpTabs()
  const [aba, setAba] = useState<'fila' | 'historico'>('fila')
  const [filaState, setFilaState] = useState<FilaFornecedor[]>(fila)
  const [ordensState, setOrdensState] = useState<OrdemCompra[]>(ordens)
  const [loadingHistorico, setLoadingHistorico] = useState(false)
  const [gerandoFornecedor, setGerandoFornecedor] = useState<string | null>(null)
  const [gerandoTodas, setGerandoTodas] = useState(false)
  const [ocAberta, setOcAberta] = useState<OrdemCompra | null>(null)
  const [deletando, setDeletando] = useState<OrdemCompra | null>(null)
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [erroDelete, setErroDelete] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<StatusOC | 'todas'>('todas')
  const [ocCriarOpen, setOcCriarOpen] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const gerarOcInFlightRef = useRef<Record<string, boolean>>({})
  const gerarTodasInFlightRef = useRef(false)
  const [adicionaisFila, setAdicionaisFila] = useState<Record<string, string>>({})

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
      const [filaAtualizada, ordensAtualizadas] = await Promise.all([
        getFilaReposicao(),
        getOrdensCompra(),
      ])
      setFilaState(filaAtualizada)
      setOrdensState(ordensAtualizadas)
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

  function parseNumero(raw: string): number {
    const v = raw.trim().replace(',', '.')
    const n = Number(v)
    return Number.isFinite(n) ? n : NaN
  }

  async function handleGerarOC(
    fornecedor_id: string | null,
    adicionaisPorMateriaPrima: Record<string, number> = {},
  ) {
    const chave = fornecedor_id ?? '__sem_fornecedor__'
    if (gerarOcInFlightRef.current[chave]) return
    gerarOcInFlightRef.current[chave] = true
    setGerandoFornecedor(chave); setErro('')
    try {
      const codigo = await gerarOC(fornecedor_id, adicionaisPorMateriaPrima)
      flash(`OC ${codigo} gerada com sucesso.`)
      setFilaState((prev) => prev.filter((grupo) => (grupo.fornecedor_id ?? '__sem_fornecedor__') !== chave))
      setAdicionaisFila({})
      await refresh()
      setAba('historico')
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao gerar OC.')
    } finally {
      setGerandoFornecedor(null)
      gerarOcInFlightRef.current[chave] = false
    }
  }

  async function handleGerarTodas() {
    if (gerarTodasInFlightRef.current) return
    gerarTodasInFlightRef.current = true
    setGerandoTodas(true); setErro('')
    try {
      let criadas = 0
      for (const grupo of filaState) {
        const adicionaisPorMateriaPrima: Record<string, number> = {}
        for (const it of grupo.itens) {
          adicionaisPorMateriaPrima[it.materia_prima_id] = parseNumero(
            adicionaisFila[it.materia_prima_id] ?? '0',
          )
        }
        await gerarOC(grupo.fornecedor_id, adicionaisPorMateriaPrima)
        criadas++
      }

      flash(`${criadas} ${criadas === 1 ? 'OC gerada' : 'OCs geradas'} com sucesso.`)
      setFilaState([])
      setAdicionaisFila({})
      await refresh()
      setAba('historico')
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao gerar OCs.')
    } finally {
      setGerandoTodas(false)
      gerarTodasInFlightRef.current = false
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
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-8 py-6"
        style={{ borderBottom: '1px solid var(--ac-border)' }}
      >
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ac-text)' }}>Ordens de Compra</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ac-muted)' }}>
            {filaState.length > 0
              ? `${filaState.length} ${filaState.length === 1 ? 'fornecedor' : 'fornecedores'} com itens pendentes`
              : 'Fila de reposição vazia'}
          </p>
        </div>
        {perm.criar && (
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={() => setOcCriarOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Nova ordem de compra
            </Button>
            {filaState.length > 0 && (
              <Button
                variant="secondary"
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
        )}
      </div>

      {/* Alertas */}
      {erro && (
        <div className="mx-4 sm:mx-8 mt-4 px-4 py-3 rounded-lg text-sm" style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5' }}>
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="mx-4 sm:mx-8 mt-4 px-4 py-3 rounded-lg text-sm" style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }}>
          {sucesso}
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 sm:px-8 pt-5">
        <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: 'color-mix(in srgb, var(--ac-border) 40%, transparent)' }}>
          {[
            { key: 'fila' as const, label: 'Fila de Reposição', count: filaState.length },
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
        <div className="px-4 sm:px-8 py-6">
          {filaState.length === 0 ? (
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
              {filaState.map((grupo) => {
                const chave = grupo.fornecedor_id ?? '__sem_fornecedor__'
                const isGerando = gerandoFornecedor === chave
                const totalValor = grupo.itens.reduce((s, i) => {
                  const adicional = parseNumero(adicionaisFila[i.materia_prima_id] ?? '0')
                  const adicionalSafe = Number.isFinite(adicional) ? adicional : 0
                  return s + i.mp_preco_custo * (i.quantidade_total + adicionalSafe)
                }, 0)
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
                          onClick={() => {
                            const adicionaisPorMateriaPrima: Record<string, number> = {}
                            for (const it of grupo.itens) {
                              adicionaisPorMateriaPrima[it.materia_prima_id] = parseNumero(
                                adicionaisFila[it.materia_prima_id] ?? '0',
                              )
                            }
                            handleGerarOC(grupo.fornecedor_id, adicionaisPorMateriaPrima)
                          }}
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
                            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Vendido</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Unidades adicionais</th>
                            <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Qtd Total</th>
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
                              <td className="px-3 py-2.5 text-right">
                                {perm.criar ? (
                                  <input
                                    type="number"
                                    min="0"
                                    step="any"
                                    disabled={isGerando}
                                    value={adicionaisFila[item.materia_prima_id] ?? ''}
                                    onChange={(e) =>
                                      setAdicionaisFila((prev) => ({ ...prev, [item.materia_prima_id]: e.target.value }))
                                    }
                                    className="w-24 px-2 py-1 rounded text-sm text-right"
                                    style={{
                                      border: '1px solid var(--ac-border)',
                                      background: 'var(--ac-bg)',
                                      color: 'var(--ac-text)',
                                    }}
                                  />
                                ) : (
                                  <span style={{ color: 'var(--ac-text)' }}>—</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right font-medium" style={{ color: 'var(--ac-text)' }}>
                                {(() => {
                                  const adicional = parseNumero(adicionaisFila[item.materia_prima_id] ?? '0')
                                  const adicionalSafe = Number.isFinite(adicional) ? adicional : 0
                                  return fmtQtd(item.quantidade_total + adicionalSafe)
                                })()}
                              </td>
                              <td className="px-3 py-2.5 text-right" style={{ color: 'var(--ac-muted)' }}>
                                {fmt(item.mp_preco_custo)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-medium" style={{ color: 'var(--ac-text)' }}>
                                {(() => {
                                  const adicional = parseNumero(adicionaisFila[item.materia_prima_id] ?? '0')
                                  const adicionalSafe = Number.isFinite(adicional) ? adicional : 0
                                  return fmt(item.mp_preco_custo * (item.quantidade_total + adicionalSafe))
                                })()}
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
        <div className="px-4 sm:px-8 py-6">
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
                {filtroStatus === 'todas'
                  ? 'Use "Nova ordem de compra" no topo ou gere OCs pela aba "Fila de Reposição".'
                  : 'Altere o filtro para ver outras.'}
              </p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)', background: 'var(--ac-card)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--ac-border)', background: 'color-mix(in srgb, var(--ac-border) 30%, transparent)' }}>
                    {['Código', 'Fornecedor', 'Data', 'Qtd Final', 'Total Estimado', 'Status', ''].map((h) => (
                      <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-left ${h === '' ? 'w-20' : ''}`} style={{ color: 'var(--ac-muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ordensFiltradas.map((oc, idx) => {
                    const itens = oc.itens ?? []
                    const quantidadeFinal = itens.reduce((acc, item) => acc + Number(item.quantidade ?? 0), 0)
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
                          {fmtQtd(quantidadeFinal)}
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
          onRequestExcluir={() => {
            setDeletando(ocAberta)
            setOcAberta(null)
            setErroDelete('')
          }}
        />
      )}

      <OcCriarModal
        open={ocCriarOpen}
        onClose={() => setOcCriarOpen(false)}
        onCriada={(codigo) => {
          flash(`OC ${codigo} criada com sucesso.`)
          refresh()
          setAba('historico')
        }}
      />

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
