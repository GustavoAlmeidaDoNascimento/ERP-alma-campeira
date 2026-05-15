'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { SearchableSelect } from '@/components/ui/searchable-select'
import {
  getFilaReposicaoList,
  getFilaReposicaoDetalhe,
  getOrdensCompra,
  criarOrdemCompraManual,
  atualizarUnidadesAdicionaisItem,
  criarItemOrdemCompra,
  atualizarObservacaoOC,
  mudarStatusOC,
  definirPagoOrdemCompra,
  deletarOC,
  getUsuariosParaRegistroOC,
} from '@/lib/actions/ordens-compra'
import { getFornecedoresSemCache } from '@/lib/actions/fornecedores'
import { STATUS_OC } from '@/types'
import type { FilaReposicao, FilaReposicaoDetalhe, Fornecedor, MateriaPrima, OrdemCompra, OrdemCompraItem, StatusOC } from '@/types'
import { useErpTabs } from '@/components/layout/erp-tabs'
import { useOrdensCompra, useFilaReposicao } from '@/lib/query/hooks'
import { qk } from '@/lib/query/keys'
import { getMatériasPrimas } from '@/lib/actions/materias-primas'
import { getOptimizedSupabaseImageUrl } from '@/lib/supabase/optimized-image'
import { FilaReposicaoDetalheModal } from '@/components/ordens-compra/fila-reposicao-detalhe'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }

type FiltroListaOC = 'todas' | StatusOC | 'pagas'

type Props = {
  fila: FilaReposicao[]
  ordens: OrdemCompra[]
  perm: Perm
  /** perfil usuarios_perfis.id do login — pré-selecionado no registro de alterações */
  usuarioLogadoId: string | null
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

function fmtDataHora(iso: string) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
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
      <span>${STATUS_OC[oc.status].label}${oc.pago ? ' · Pago' : ''}</span>
    </div>
    ${oc.pedido_codigo ? `
    <div>
      <strong>Pedido de Origem</strong>
      <span>${oc.pedido_codigo}</span>
    </div>
    <div>
      <strong>Cliente</strong>
      <span>${oc.cliente_nome ?? '—'}</span>
    </div>` : ''}
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

/** HTML de uma OC sem <head>/<style> — para concatenar várias num único PDF. */
function ocBodyHtml(oc: OrdemCompra) {
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

  return `
  <section class="oc-page">
    <h1>ORDEM DE COMPRA — ${oc.codigo}</h1>
    <p class="subtitle">Alma Campeira — Cutelaria Artesanal</p>
    <div class="meta">
      <div><strong>Fornecedor</strong><span>${oc.fornecedor?.nome ?? 'Sem fornecedor'}</span></div>
      <div><strong>Data de Geração</strong><span>${fmtData(oc.data_geracao)}</span></div>
      <div><strong>Status</strong><span>${STATUS_OC[oc.status].label}${oc.pago ? ' · Pago' : ''}</span></div>
      ${oc.pedido_codigo ? `
      <div><strong>Pedido de Origem</strong><span>${oc.pedido_codigo}</span></div>
      <div><strong>Cliente</strong><span>${oc.cliente_nome ?? '—'}</span></div>` : ''}
    </div>
    <table>
      <thead>
        <tr><th>Código</th><th>Item</th><th>Qtd</th><th>Preço Unit.</th><th>Subtotal</th></tr>
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
  </section>`
}

function exportarPDFMultiplas(ocs: OrdemCompra[]) {
  if (ocs.length === 0) return
  const paginas = ocs.map(ocBodyHtml).join('')
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>Ordens de Compra (${ocs.length})</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #111; }
    .oc-page { padding: 40px; page-break-after: always; }
    .oc-page:last-child { page-break-after: auto; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 2px; }
    .subtitle { font-size: 12px; color: #555; margin-bottom: 24px; }
    .meta { display: flex; gap: 40px; margin-bottom: 24px; flex-wrap: wrap; }
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
      .oc-page { padding: 20px; }
      @page { margin: 1.5cm; }
    }
  </style>
</head>
<body>
  ${paginas}
  <script>window.onload = () => { window.print() }</script>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
}

// ─── Badge de Status OC ──────────────────────────────────────────────────────

const PAGO_BADGE = { label: 'Pago', color: '#6d28d9', bg: '#ede9fe', border: '#ddd6fe' } as const

function BadgeStatus({ status, pago }: { status: StatusOC; pago?: boolean }) {
  const cfg = STATUS_OC[status]
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      <span
        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
        style={{ color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}
      >
        {cfg.label}
      </span>
      {pago ? (
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
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

// ─── Badge Status Fila ────────────────────────────────────────────────────────

function BadgeStatusFila({ status }: { status: FilaReposicao['status'] }) {
  const cfg = {
    pendente: { label: 'Pendente', color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
    convertida: { label: 'Convertida', color: '#15803d', bg: '#dcfce7', border: '#bbf7d0' },
    dispensada: { label: 'Dispensada', color: '#6b7280', bg: '#f3f4f6', border: '#d1d5db' },
  }[status]
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
  usuarioLogadoId,
  onClose,
  onRefresh,
  onRequestExcluir,
}: {
  oc: OrdemCompra
  perm: Perm
  usuarioLogadoId: string | null
  onClose: () => void
  onRefresh: () => void | Promise<void>
  onRequestExcluir?: () => void
}) {
  /** String editável da quantidade total do item (vendido + adicional); igual conceito à fila de reposição. */
  const [editandoQtdTotal, setEditandoQtdTotal] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState<string | null>(null)
  const [obs, setObs] = useState(oc.observacao ?? '')
  const [salvandoObs, setSalvandoObs] = useState(false)
  const [mudandoStatus, setMudandoStatus] = useState(false)
  const [alterandoPago, setAlterandoPago] = useState(false)
  const [erro, setErro] = useState('')
  const [confirmandoRecebimento, setConfirmandoRecebimento] = useState(false)
  const [materiasPrimas, setMateriasPrimas] = useState<MateriaPrima[]>([])
  const [carregandoMateriasPrimas, setCarregandoMateriasPrimas] = useState(false)
  const [materiaPrimaParaAdicionar, setMateriaPrimaParaAdicionar] = useState('')
  const [adicionalParaAdicionar, setAdicionalParaAdicionar] = useState('')
  const [adicionandoItem, setAdicionandoItem] = useState(false)
  const [usuariosRegistro, setUsuariosRegistro] = useState<{ id: string; nome: string }[]>([])
  const [carregandoUsuariosRegistro, setCarregandoUsuariosRegistro] = useState(false)
  const [usuarioRegistroId, setUsuarioRegistroId] = useState(() => usuarioLogadoId ?? '')

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

  const opcoesUsuarioRegistro = useMemo(
    () => usuariosRegistro.map((u) => ({ value: u.id, label: u.nome })),
    [usuariosRegistro],
  )

  useEffect(() => {
    setConfirmandoRecebimento(false)
  }, [oc.id, oc.status])

  useEffect(() => {
    setObs(oc.observacao ?? '')
  }, [oc.id, oc.observacao])

  useEffect(() => {
    setUsuarioRegistroId(usuarioLogadoId ?? '')
  }, [oc.id, usuarioLogadoId])

  useEffect(() => {
    if (!perm.editar) return
    let cancelled = false
    async function carregarUsuarios() {
      setCarregandoUsuariosRegistro(true)
      setErro('')
      try {
        const list = await getUsuariosParaRegistroOC()
        if (!cancelled) setUsuariosRegistro(list)
      } catch (e: unknown) {
        if (!cancelled) setErro(e instanceof Error ? e.message : 'Erro ao carregar usuários.')
      } finally {
        if (!cancelled) setCarregandoUsuariosRegistro(false)
      }
    }
    carregarUsuarios()
    return () => {
      cancelled = true
    }
  }, [perm.editar])

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
      const salvoTotal = vendido + adicionalBase
      const rawTotal = editandoQtdTotal[i.id]
      const parsedTotal = rawTotal !== undefined ? parseNumero(rawTotal) : NaN
      const qtd =
        rawTotal !== undefined && Number.isFinite(parsedTotal) ? parsedTotal : salvoTotal
      return { ...i, quantidade: qtd }
    })
  )

  async function salvarQtdTotal(item: OrdemCompraItem) {
    const raw = editandoQtdTotal[item.id]
    if (raw === undefined) return
    const vendido = Number(item.quantidade_vendida ?? item.quantidade ?? 0)
    const totalQty = parseNumero(raw)
    if (!Number.isFinite(totalQty)) {
      setErro('Quantidade total inválida.')
      return
    }
    const minTotal = vendido > 0 ? vendido : 1
    if (totalQty < minTotal) {
      setErro(`A quantidade total não pode ser menor que ${fmtQtd(minTotal)}.`)
      return
    }
    const adicional = totalQty - vendido
    if (!Number.isFinite(adicional) || adicional < 0) {
      setErro('Quantidade total inválida.')
      return
    }
    setSalvando(item.id); setErro('')
    try {
      await atualizarUnidadesAdicionaisItem(item.id, adicional, usuarioRegistroId || null)
      setEditandoQtdTotal((prev) => { const n = { ...prev }; delete n[item.id]; return n })
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
      await atualizarObservacaoOC(oc.id, obs, usuarioRegistroId || null)
      await Promise.resolve(onRefresh())
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar observação.')
    } finally {
      setSalvandoObs(false)
    }
  }

  async function mudarStatus(status: StatusOC) {
    setMudandoStatus(true); setErro('')
    try {
      await mudarStatusOC(oc.id, status, usuarioRegistroId || null)
      await Promise.resolve(onRefresh())
      onClose()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao mudar status.')
    } finally {
      setMudandoStatus(false)
    }
  }

  async function alternarPago(checked: boolean) {
    setAlterandoPago(true); setErro('')
    try {
      await definirPagoOrdemCompra(oc.id, checked, usuarioRegistroId || null)
      await Promise.resolve(onRefresh())
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao atualizar pagamento.')
    } finally {
      setAlterandoPago(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={`${oc.codigo} — ${oc.fornecedor?.nome ?? 'Sem fornecedor'}`} width="760px">
      <div className="space-y-5">
        {/* Resumo */}
        <div className="flex items-center gap-6 text-sm flex-wrap" style={{ color: 'var(--ac-muted)' }}>
          <span>Data: <strong style={{ color: 'var(--ac-text)' }}>{fmtData(oc.data_geracao)}</strong></span>
          <span className="inline-flex items-center gap-2 flex-wrap">
            Status: <BadgeStatus status={oc.status} />
          </span>
          {perm.editar ? (
            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={oc.pago}
                disabled={alterandoPago}
                onChange={(e) => { void alternarPago(e.target.checked) }}
                className="w-4 h-4 rounded"
                style={{ accentColor: 'var(--ac-accent)' }}
              />
              <span style={{ color: 'var(--ac-text)' }}>Pago</span>
            </label>
          ) : (
            <span style={{ color: 'var(--ac-text)' }}>
              Pagamento: {oc.pago ? 'sim' : 'não'}
            </span>
          )}
          <span className="ml-auto font-semibold text-base" style={{ color: 'var(--ac-text)' }}>{fmt(total)}</span>
        </div>

        {/* Pedido de origem */}
        {oc.pedido_codigo && (
          <div
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm flex-wrap"
            style={{ background: 'color-mix(in srgb, var(--ac-accent) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--ac-accent) 30%, transparent)' }}
          >
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
              Pedido de origem
            </span>
            <span className="font-mono font-bold" style={{ color: 'var(--ac-accent)' }}>{oc.pedido_codigo}</span>
            <span style={{ color: 'var(--ac-text)' }}>· {oc.cliente_nome ?? '—'}</span>
          </div>
        )}

        {oc.ultima_alteracao_em && (
          <div
            className="text-xs px-3 py-2 rounded-lg"
            style={{ background: 'color-mix(in srgb, var(--ac-border) 35%, transparent)', color: 'var(--ac-muted)' }}
          >
            Última alteração:{' '}
            <strong style={{ color: 'var(--ac-text)' }}>{oc.ultima_alteracao_usuario?.nome ?? '—'}</strong>
            <span> · {fmtDataHora(oc.ultima_alteracao_em)}</span>
          </div>
        )}

        {/* Tabela de itens */}
        <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'color-mix(in srgb, var(--ac-border) 40%, transparent)' }}>
                {[
                  'Código',
                  'Matéria-Prima',
                  'Vendido',
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
                const isEditing = editandoQtdTotal[item.id] !== undefined
                const vendido = Number(item.quantidade_vendida ?? item.quantidade)
                const adicionalBase = Number(item.quantidade_adicional ?? 0)
                const salvoTotal = vendido + adicionalBase
                const rawTotal = editandoQtdTotal[item.id]
                const parsedTotal = rawTotal !== undefined ? parseNumero(rawTotal) : NaN
                const totalQty =
                  rawTotal !== undefined && Number.isFinite(parsedTotal) ? parsedTotal : salvoTotal
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
                    <td className="px-3 py-2.5 text-right">
                      {perm.editar && oc.status === 'pendente' ? (
                        <div className="flex items-center justify-end gap-1">
                          <input
                            type="number"
                            min={vendido > 0 ? vendido : 1}
                            step="any"
                            value={isEditing ? editandoQtdTotal[item.id] : String(salvoTotal)}
                            onChange={(e) => setEditandoQtdTotal((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            onFocus={() => {
                              if (!isEditing) {
                                setEditandoQtdTotal((prev) => ({ ...prev, [item.id]: String(salvoTotal) }))
                              }
                            }}
                            className="w-24 px-2 py-1 rounded text-sm text-right font-semibold"
                            style={{
                              border: '1px solid var(--ac-border)',
                              background: 'var(--ac-bg)',
                              color: 'var(--ac-accent)',
                            }}
                          />
                          {isEditing && (
                            <button
                              type="button"
                              onClick={() => salvarQtdTotal(item)}
                              disabled={salvando === item.id || Math.abs(totalQty - salvoTotal) < 1e-9}
                              className="px-2 py-1 rounded text-xs font-semibold"
                              style={{ background: 'var(--ac-accent)', color: '#111827' }}
                            >
                              {salvando === item.id ? '…' : 'OK'}
                            </button>
                          )}
                          {isEditing && (
                            <button
                              type="button"
                              onClick={() => setEditandoQtdTotal((prev) => { const n = { ...prev }; delete n[item.id]; return n })}
                              className="px-1.5 py-1 rounded text-xs"
                              style={{ color: 'var(--ac-muted)' }}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="font-semibold" style={{ color: 'var(--ac-accent)' }}>
                          {fmtQtd(salvoTotal)}
                        </span>
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
                <td colSpan={5} className="px-3 py-2.5 text-right font-semibold text-sm" style={{ color: 'var(--ac-muted)' }}>
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
                    await criarItemOrdemCompra(
                      oc.id,
                      materiaPrimaParaAdicionar,
                      adicional,
                      usuarioRegistroId || null,
                    )
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
          className="flex flex-wrap items-end gap-2 pt-1"
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

          {perm.editar && (
            <div
              className="flex w-full min-[480px]:w-auto min-[480px]:max-w-[min(100%,280px)] flex-col gap-1"
              title="Por padrão vem o usuário logado. Troque se outra pessoa efetivou a mudança."
            >
              <label
                htmlFor="oc-registro-usuario"
                className="text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: 'var(--ac-muted)' }}
              >
                Quem registra a alteração
              </label>
              <SearchableSelect
                id="oc-registro-usuario"
                value={usuarioRegistroId}
                onChange={setUsuarioRegistroId}
                options={opcoesUsuarioRegistro}
                placeholder="Selecione o usuário…"
                loading={carregandoUsuariosRegistro}
                emptyMessage="Nenhum usuário ativo encontrado"
                className="w-full"
              />
            </div>
          )}

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
        const [f, m] = await Promise.all([getFornecedoresSemCache(1000), getMatériasPrimas(300)])
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
    <Modal open={open} onClose={onClose} title="Nova ordem de compra" width="920px">
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
          <Select
            value={fornecedorId}
            onChange={(e) => setFornecedorId(e.target.value)}
            disabled={carregando}
          >
            <option value="">Sem fornecedor</option>
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </Select>
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

          <div>
            <table className="w-full text-sm table-fixed">
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
                        className="w-full"
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

export function OcClient({ fila, ordens, perm, usuarioLogadoId }: Props) {  const { refreshActiveTab } = useErpTabs()
  const queryClient = useQueryClient()
  const [aba, setAba] = useState<'fila' | 'historico'>('fila')
  const { data: ordensLista = ordens } = useOrdensCompra({ initialData: ordens })
  const { data: filaLista = fila } = useFilaReposicao({ initialData: fila })
  const [loadingHistorico, setLoadingHistorico] = useState(false)

  useEffect(() => {
    queryClient.setQueryData(qk.ordensCompra.list(), ordens)
  }, [ordens, queryClient])

  useEffect(() => {
    queryClient.setQueryData(qk.ordensCompra.fila(), fila)
  }, [fila, queryClient])

  const [ocAberta, setOcAberta] = useState<OrdemCompra | null>(null)

  useEffect(() => {
    setOcAberta((prev) => {
      if (!prev) return prev
      const atual = ordensLista.find((o) => o.id === prev.id)
      return atual ?? prev
    })
  }, [ordensLista])

  const [filaAberta, setFilaAberta] = useState<FilaReposicao | null>(null)
  const [deletando, setDeletando] = useState<OrdemCompra | null>(null)
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [erroDelete, setErroDelete] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<FiltroListaOC>('todas')
  const [ocCriarOpen, setOcCriarOpen] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const gerarTodasInFlightRef = useRef(false)

  // Cache + in-flight de detalhes de fila para abrir o modal sem espera.
  // Disparamos a busca no mouseEnter (e no focus, p/ teclado). Quando o clique
  // chega, na maioria das vezes a resposta já chegou ou está perto de chegar.
  const filaDetalheCacheRef = useRef<Map<string, FilaReposicaoDetalhe>>(new Map())
  const filaDetalheInFlightRef = useRef<Map<string, Promise<FilaReposicaoDetalhe>>>(new Map())
  function prefetchFilaDetalhe(fila_id: string) {
    if (filaDetalheCacheRef.current.has(fila_id)) return
    if (filaDetalheInFlightRef.current.has(fila_id)) return
    const p = getFilaReposicaoDetalhe(fila_id)
      .then((d) => {
        filaDetalheCacheRef.current.set(fila_id, d)
        return d
      })
      .catch((e) => { throw e })
      .finally(() => { filaDetalheInFlightRef.current.delete(fila_id) })
    filaDetalheInFlightRef.current.set(fila_id, p)
  }

  useEffect(() => {
    if (aba !== 'historico' || ordensLista.length > 0 || loadingHistorico) return

    let cancelled = false
    async function carregarHistorico() {
      setLoadingHistorico(true)
      try {
        const data = await getOrdensCompra()
        if (!cancelled) queryClient.setQueryData(qk.ordensCompra.list(), data)
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
  }, [aba, ordensLista.length, loadingHistorico, queryClient])

  async function refresh() {
    setLoadingHistorico(true)
    try {
      const [filaAtualizada, ordensAtualizadas] = await Promise.all([
        getFilaReposicaoList(),
        getOrdensCompra(),
      ])
      queryClient.setQueryData(qk.ordensCompra.fila(), filaAtualizada)
      queryClient.setQueryData(qk.ordensCompra.list(), ordensAtualizadas)
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao atualizar.')
    } finally {
      setLoadingHistorico(false)
    }
    refreshActiveTab()
  }

  function flash(msg: string) {
    setSucesso(msg)
    setTimeout(() => setSucesso(''), 3500)
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

  const [agruparPorPedido, setAgruparPorPedido] = useState(true)
  const [periodoIni, setPeriodoIni] = useState('')
  const [periodoFim, setPeriodoFim] = useState('')
  const [filaPeriodoIni, setFilaPeriodoIni] = useState('')
  const [filaPeriodoFim, setFilaPeriodoFim] = useState('')
  const [selecionadasIds, setSelecionadasIds] = useState<Set<string>>(new Set())

  const filaFiltrada = useMemo(() => {
    if (!filaPeriodoIni && !filaPeriodoFim) return filaLista
    return filaLista.filter((item) => {
      const d = (item.created_at || '').slice(0, 10)
      if (filaPeriodoIni && d < filaPeriodoIni) return false
      if (filaPeriodoFim && d > filaPeriodoFim) return false
      return true
    })
  }, [filaLista, filaPeriodoIni, filaPeriodoFim])

  const ordensFiltradas = useMemo(() => {
    let lista =
      filtroStatus === 'todas'
        ? ordensLista
        : filtroStatus === 'pagas'
          ? ordensLista.filter((o) => o.pago)
          : ordensLista.filter((o) => o.status === filtroStatus)
    if (periodoIni || periodoFim) {
      lista = lista.filter((o) => {
        const d = (o.data_geracao || '').slice(0, 10)
        if (periodoIni && d < periodoIni) return false
        if (periodoFim && d > periodoFim) return false
        return true
      })
    }
    return lista
  }, [ordensLista, filtroStatus, periodoIni, periodoFim])

  // Limpa seleções que saíram do filtro para evitar imprimir OCs invisíveis.
  useEffect(() => {
    setSelecionadasIds((prev) => {
      const visiveis = new Set(ordensFiltradas.map((o) => o.id))
      let mudou = false
      const next = new Set<string>()
      for (const id of prev) {
        if (visiveis.has(id)) next.add(id)
        else mudou = true
      }
      return mudou ? next : prev
    })
  }, [ordensFiltradas])

  function toggleSelecionada(id: string) {
    setSelecionadasIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  function toggleSelecionarTudo() {
    setSelecionadasIds((prev) => {
      const todasIds = ordensFiltradas.map((o) => o.id)
      const todasMarcadas = todasIds.length > 0 && todasIds.every((id) => prev.has(id))
      return todasMarcadas ? new Set() : new Set(todasIds)
    })
  }

  function imprimirSelecionadas() {
    const mapa = new Map(ordensFiltradas.map((o) => [o.id, o]))
    const ocs = Array.from(selecionadasIds).map((id) => mapa.get(id)).filter((o): o is OrdemCompra => !!o)
    exportarPDFMultiplas(ocs)
  }

  // Agrupa OCs pelo pedido de origem. OCs manuais (sem pedido_id) ficam num
  // grupo "Sem pedido (manuais)". Mantém a ordem decrescente de created_at ao
  // posicionar cada grupo pelo created_at mais recente entre seus filhos.
  const gruposPorPedido = useMemo(() => {
    if (!agruparPorPedido) return null
    type Grupo = {
      key: string
      pedido_codigo: string | null
      cliente_nome: string | null
      ocs: OrdemCompra[]
      maisRecente: string
    }
    const map = new Map<string, Grupo>()
    for (const oc of ordensFiltradas) {
      const key = oc.pedido_id ?? '__manuais__'
      const existente = map.get(key)
      if (existente) {
        existente.ocs.push(oc)
        if (oc.created_at > existente.maisRecente) existente.maisRecente = oc.created_at
      } else {
        map.set(key, {
          key,
          pedido_codigo: oc.pedido_codigo ?? null,
          cliente_nome: oc.cliente_nome ?? null,
          ocs: [oc],
          maisRecente: oc.created_at,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) => b.maisRecente.localeCompare(a.maisRecente))
  }, [ordensFiltradas, agruparPorPedido])

  const statusTabs: { value: FiltroListaOC; label: string }[] = [
    { value: 'todas', label: 'Todas' },
    { value: 'pendente', label: 'Pendentes' },
    { value: 'enviada', label: 'Enviadas' },
    { value: 'pagas', label: 'Pagas' },
    { value: 'recebida', label: 'Recebidas' },
  ]

  void gerarTodasInFlightRef

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
            {filaLista.length > 0
              ? `${filaLista.length} ${filaLista.length === 1 ? 'pedido' : 'pedidos'} aguardando reposição`
              : 'Fila de reposição vazia'}
          </p>
        </div>
        {perm.criar && (
          <Button variant="primary" onClick={() => setOcCriarOpen(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nova ordem de compra
          </Button>
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
            { key: 'fila' as const, label: 'Fila de Reposição', count: filaLista.length },
            { key: 'historico' as const, label: 'Ordens de Compra', count: ordensLista.length },
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

      {/* ── Aba: Fila de Reposição ── */}
      {aba === 'fila' && (
        <div className="px-4 sm:px-8 py-6">
          {filaLista.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                Período:
              </span>
              <input
                type="date"
                value={filaPeriodoIni}
                onChange={(e) => setFilaPeriodoIni(e.target.value)}
                max={filaPeriodoFim || undefined}
                className="px-2 py-1 rounded text-sm"
                style={{ border: '1px solid var(--ac-border)', background: 'var(--ac-bg)', color: 'var(--ac-text)' }}
              />
              <span className="text-sm" style={{ color: 'var(--ac-muted)' }}>até</span>
              <input
                type="date"
                value={filaPeriodoFim}
                onChange={(e) => setFilaPeriodoFim(e.target.value)}
                min={filaPeriodoIni || undefined}
                className="px-2 py-1 rounded text-sm"
                style={{ border: '1px solid var(--ac-border)', background: 'var(--ac-bg)', color: 'var(--ac-text)' }}
              />
              {(filaPeriodoIni || filaPeriodoFim) && (
                <button
                  onClick={() => { setFilaPeriodoIni(''); setFilaPeriodoFim('') }}
                  className="px-2 py-1 rounded text-xs font-medium"
                  style={{ background: 'color-mix(in srgb, var(--ac-border) 40%, transparent)', color: 'var(--ac-muted)' }}
                  title="Limpar período"
                >
                  Limpar
                </button>
              )}
              <span className="ml-auto text-xs" style={{ color: 'var(--ac-muted)' }}>
                {filaFiltrada.length} de {filaLista.length}
              </span>
            </div>
          )}

          {filaLista.length === 0 ? (
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
                Quando vendas forem entregues e houver estoques abaixo do mínimo, os pedidos aparecerão aqui.
              </p>
            </div>
          ) : filaFiltrada.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-16 rounded-xl text-center"
              style={{ border: '2px dashed var(--ac-border)' }}
            >
              <p className="font-semibold mb-1" style={{ color: 'var(--ac-text)' }}>Nenhum pedido neste período</p>
              <p className="text-sm" style={{ color: 'var(--ac-muted)' }}>Ajuste as datas ou clique em Limpar.</p>
            </div>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)', background: 'var(--ac-card)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--ac-border)', background: 'color-mix(in srgb, var(--ac-border) 30%, transparent)' }}>
                    {['Pedido', 'Cliente', 'Detectado em', 'MPs para repor', 'Status', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-left" style={{ color: 'var(--ac-muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filaFiltrada.map((item, idx) => (
                    <tr
                      key={item.id}
                      className="cursor-pointer transition-colors"
                      style={{ borderTop: idx > 0 ? '1px solid var(--ac-border)' : undefined }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'color-mix(in srgb, var(--ac-border) 20%, transparent)'
                        prefetchFilaDetalhe(item.id)
                      }}
                      onFocus={() => prefetchFilaDetalhe(item.id)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      onClick={() => setFilaAberta(item)}
                    >
                      <td className="px-4 py-3 font-mono font-semibold text-xs" style={{ color: 'var(--ac-accent)' }}>
                        {item.pedido_codigo}
                      </td>
                      <td className="px-4 py-3 font-medium" style={{ color: 'var(--ac-text)' }}>
                        {item.cliente_nome}
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--ac-muted)' }}>
                        {fmtData(item.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: 'color-mix(in srgb, var(--ac-accent) 15%, transparent)', color: 'var(--ac-accent)' }}
                        >
                          {item.itens_count} {item.itens_count === 1 ? 'item' : 'itens'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <BadgeStatusFila status={item.status} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                          style={{ background: 'var(--ac-accent)', color: '#111827' }}
                          onMouseEnter={() => prefetchFilaDetalhe(item.id)}
                          onFocus={() => prefetchFilaDetalhe(item.id)}
                          onClick={(e) => { e.stopPropagation(); setFilaAberta(item) }}
                        >
                          Revisar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Aba: Histórico ── */}
      {aba === 'historico' && (
        <div className="px-4 sm:px-8 py-6">
          {/* Filtro de status + agrupamento */}
          <div className="flex gap-2 mb-5 flex-wrap items-center">
            <div className="flex gap-2 flex-wrap">
            {statusTabs.map((tab) => {
              const count =
                tab.value === 'todas'
                  ? ordensLista.length
                  : tab.value === 'pagas'
                    ? ordensLista.filter((o) => o.pago).length
                    : ordensLista.filter((o) => o.status === tab.value).length
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
            <label className="ml-auto flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--ac-muted)' }}>
              <input
                type="checkbox"
                checked={agruparPorPedido}
                onChange={(e) => setAgruparPorPedido(e.target.checked)}
                className="w-4 h-4 cursor-pointer rounded"
                style={{ accentColor: 'var(--ac-accent)' }}
              />
              Agrupar por pedido
            </label>
          </div>

          {/* Filtro de período + ação de impressão em massa */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
              Período:
            </span>
            <input
              type="date"
              value={periodoIni}
              onChange={(e) => setPeriodoIni(e.target.value)}
              max={periodoFim || undefined}
              className="px-2 py-1 rounded text-sm"
              style={{ border: '1px solid var(--ac-border)', background: 'var(--ac-bg)', color: 'var(--ac-text)' }}
            />
            <span className="text-sm" style={{ color: 'var(--ac-muted)' }}>até</span>
            <input
              type="date"
              value={periodoFim}
              onChange={(e) => setPeriodoFim(e.target.value)}
              min={periodoIni || undefined}
              className="px-2 py-1 rounded text-sm"
              style={{ border: '1px solid var(--ac-border)', background: 'var(--ac-bg)', color: 'var(--ac-text)' }}
            />
            {(periodoIni || periodoFim) && (
              <button
                onClick={() => { setPeriodoIni(''); setPeriodoFim('') }}
                className="px-2 py-1 rounded text-xs font-medium"
                style={{ background: 'color-mix(in srgb, var(--ac-border) 40%, transparent)', color: 'var(--ac-muted)' }}
                title="Limpar período"
              >
                Limpar
              </button>
            )}
            {selecionadasIds.size > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--ac-muted)' }}>
                  {selecionadasIds.size} {selecionadasIds.size === 1 ? 'selecionada' : 'selecionadas'}
                </span>
                <Button variant="secondary" onClick={() => setSelecionadasIds(new Set())}>
                  Limpar
                </Button>
                <Button variant="primary" onClick={imprimirSelecionadas}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
                    <polyline points="6 9 6 2 18 2 18 9" />
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                    <rect x="6" y="14" width="12" height="8" />
                  </svg>
                  Imprimir {selecionadasIds.size} {selecionadasIds.size === 1 ? 'OC' : 'OCs'}
                </Button>
              </div>
            )}
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
                {filtroStatus === 'todas'
                  ? 'Nenhuma OC gerada ainda'
                  : filtroStatus === 'pagas'
                    ? 'Nenhuma OC marcada como paga'
                    : `Nenhuma OC ${STATUS_OC[filtroStatus].label.toLowerCase()}`}
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
                    <th className="px-3 py-3 w-10 text-left">
                      <input
                        type="checkbox"
                        title="Selecionar todas (filtradas)"
                        checked={
                          ordensFiltradas.length > 0 &&
                          ordensFiltradas.every((o) => selecionadasIds.has(o.id))
                        }
                        ref={(el) => {
                          if (el) {
                            const algumas = ordensFiltradas.some((o) => selecionadasIds.has(o.id))
                            const todas = ordensFiltradas.length > 0 && ordensFiltradas.every((o) => selecionadasIds.has(o.id))
                            el.indeterminate = algumas && !todas
                          }
                        }}
                        onChange={toggleSelecionarTudo}
                        className="w-4 h-4 cursor-pointer rounded"
                        style={{ accentColor: 'var(--ac-accent)' }}
                      />
                    </th>
                    {['Código', 'Pedido', 'Fornecedor', 'Data', 'Qtd Final', 'Total Estimado', 'Status', ''].map((h) => (
                      <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-left ${h === '' ? 'w-20' : ''}`} style={{ color: 'var(--ac-muted)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const renderRow = (oc: OrdemCompra, idx: number) => {
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
                        <td className="px-3 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selecionadasIds.has(oc.id)}
                            onChange={() => toggleSelecionada(oc.id)}
                            className="w-4 h-4 cursor-pointer rounded"
                            style={{ accentColor: 'var(--ac-accent)' }}
                          />
                        </td>
                        <td className="px-4 py-3 font-mono font-semibold text-xs" style={{ color: 'var(--ac-accent)' }}>
                          {oc.codigo}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {oc.pedido_codigo ? (
                            <div>
                              <div className="font-mono font-semibold" style={{ color: 'var(--ac-text)' }}>{oc.pedido_codigo}</div>
                              <div style={{ color: 'var(--ac-muted)' }}>{oc.cliente_nome ?? '—'}</div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--ac-muted)' }}>Manual</span>
                          )}
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
                          <BadgeStatus status={oc.status} pago={oc.pago} />
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
                    }

                    if (gruposPorPedido) {
                      let globalIdx = 0
                      return gruposPorPedido.flatMap((grupo, grupoIdx) => {
                        const totalGrupo = grupo.ocs.reduce((s, oc) => s + totalOC(oc.itens ?? []), 0)
                        const idsGrupo = grupo.ocs.map((oc) => oc.id)
                        const todasGrupoMarcadas = idsGrupo.every((id) => selecionadasIds.has(id))
                        const algumasGrupoMarcadas = idsGrupo.some((id) => selecionadasIds.has(id))
                        const header = (
                          <tr
                            key={`header-${grupo.key}`}
                            style={{
                              background: 'color-mix(in srgb, var(--ac-accent) 8%, transparent)',
                              borderTop: grupoIdx > 0 ? '2px solid var(--ac-border)' : undefined,
                            }}
                          >
                            <td className="px-3 py-2 w-10">
                              <input
                                type="checkbox"
                                title="Selecionar todas deste pedido"
                                checked={todasGrupoMarcadas}
                                ref={(el) => {
                                  if (el) el.indeterminate = algumasGrupoMarcadas && !todasGrupoMarcadas
                                }}
                                onChange={() => {
                                  setSelecionadasIds((prev) => {
                                    const next = new Set(prev)
                                    if (todasGrupoMarcadas) idsGrupo.forEach((id) => next.delete(id))
                                    else idsGrupo.forEach((id) => next.add(id))
                                    return next
                                  })
                                }}
                                className="w-4 h-4 cursor-pointer rounded"
                                style={{ accentColor: 'var(--ac-accent)' }}
                              />
                            </td>
                            <td colSpan={8} className="px-4 py-2">
                              <div className="flex items-center gap-2 flex-wrap text-sm">
                                {grupo.pedido_codigo ? (
                                  <>
                                    <span className="font-mono font-bold" style={{ color: 'var(--ac-accent)' }}>{grupo.pedido_codigo}</span>
                                    <span style={{ color: 'var(--ac-text)' }}>· {grupo.cliente_nome ?? '—'}</span>
                                  </>
                                ) : (
                                  <span className="font-semibold" style={{ color: 'var(--ac-muted)' }}>Ordens manuais (sem pedido)</span>
                                )}
                                <span className="text-xs" style={{ color: 'var(--ac-muted)' }}>
                                  · {grupo.ocs.length} {grupo.ocs.length === 1 ? 'OC' : 'OCs'}
                                </span>
                                <span className="ml-auto text-xs font-medium" style={{ color: 'var(--ac-muted)' }}>
                                  Total: <span style={{ color: 'var(--ac-text)' }}>{fmt(totalGrupo)}</span>
                                </span>
                              </div>
                            </td>
                          </tr>
                        )
                        const linhas = grupo.ocs.map((oc) => renderRow(oc, globalIdx++))
                        return [header, ...linhas]
                      })
                    }

                    return ordensFiltradas.map((oc, idx) => renderRow(oc, idx))
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal detalhe Fila de Reposição */}
      {filaAberta && (
        <FilaReposicaoDetalheModal
          fila={filaAberta}
          perm={perm}
          initialDetalhe={filaDetalheCacheRef.current.get(filaAberta.id)}
          initialDetalhePromise={filaDetalheInFlightRef.current.get(filaAberta.id)}
          onClose={() => setFilaAberta(null)}
          onRefresh={() => {
            setFilaAberta(null)
            flash('Operação realizada com sucesso.')
            refresh()
            setAba('historico')
          }}
        />
      )}

      {/* Modal detalhe OC */}
      {ocAberta && (
        <OcDetalheModal
          oc={ocAberta}
          perm={perm}
          usuarioLogadoId={usuarioLogadoId}
          onClose={() => setOcAberta(null)}
          onRefresh={refresh}
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
