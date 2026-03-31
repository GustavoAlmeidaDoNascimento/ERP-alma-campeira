'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { BadgeEstoque } from '@/components/ui/badge-estoque'
import { MPModal } from './mp-modal'
import { entradaEstoqueMP } from '@/lib/actions/materias-primas'
import { statusEstoque } from '@/types'
import type { MPDetalheData } from '@/lib/actions/materias-primas'
import type { CategoriaMateriaPrimaDB, Fornecedor } from '@/types'
import { useErpTabs } from '@/components/layout/erp-tabs'
import { getOptimizedSupabaseImageUrl } from '@/lib/supabase/optimized-image'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }

type Props = {
  detalhe: MPDetalheData
  fornecedores: Fornecedor[]
  categoriasMateriaPrima: CategoriaMateriaPrimaDB[]
  perm: Perm
}

const tipoMovLabel: Record<string, { label: string; color: string; bg: string }> = {
  entrada:      { label: 'Entrada',   color: '#15803d', bg: '#dcfce7' },
  saida_producao: { label: 'Produção', color: '#b45309', bg: '#fef3c7' },
  saida_venda:  { label: 'Venda',     color: '#1d4ed8', bg: '#dbeafe' },
  ajuste:       { label: 'Ajuste',    color: '#6b7280', bg: '#f3f4f6' },
}

export function MPDetalheClient({ detalhe, fornecedores, categoriasMateriaPrima, perm }: Props) {
  const { mp, facasQueUsam, movimentacoes } = detalhe
  const { refreshActiveTab, openTab } = useErpTabs()

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [entradaModalOpen, setEntradaModalOpen] = useState(false)
  const [quantidade, setQuantidade] = useState('1')
  const [observacao, setObservacao] = useState('')
  const [entradaLoading, setEntradaLoading] = useState(false)
  const [entradaErro, setEntradaErro] = useState('')

  const fotoUrl = mp.foto_url
    ? getOptimizedSupabaseImageUrl(mp.foto_url, { width: 200, height: 200, quality: 80, resize: 'cover' })
    : ''

  const qtd = Number(quantidade) || 0

  async function handleEntrada() {
    if (qtd <= 0) return
    setEntradaErro('')
    setEntradaLoading(true)
    try {
      await entradaEstoqueMP(mp.id, qtd, observacao)
      setQuantidade('1')
      setObservacao('')
      setEntradaModalOpen(false)
      refreshActiveTab()
    } catch (e: unknown) {
      setEntradaErro(e instanceof Error ? e.message : 'Erro ao registrar entrada.')
    } finally {
      setEntradaLoading(false)
    }
  }

  function abrirEntrada() {
    setQuantidade('1')
    setObservacao('')
    setEntradaErro('')
    setEntradaModalOpen(true)
  }

  function formatDateTime(dateStr: string) {
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
  }

  const status = statusEstoque(mp)

  return (
    <>
      {/* Header */}
      <div className="px-8 py-6" style={{ borderBottom: '1px solid var(--ac-border)' }}>
        <div className="flex items-start gap-6">
          {/* Foto */}
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 16,
              border: '1px solid var(--ac-border)',
              background: fotoUrl
                ? 'transparent'
                : 'linear-gradient(135deg, rgba(250, 204, 21, 0.18), rgba(250, 204, 21, 0.06))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              overflow: 'hidden',
            }}
          >
            {fotoUrl ? (
              <img src={fotoUrl} alt={mp.nome} width={120} height={120} style={{ objectFit: 'cover' }} />
            ) : (
              <img src="/images/favicon-yellow.png" alt="Sem foto" width={48} height={48} style={{ objectFit: 'contain' }} />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <button
                type="button"
                onClick={() => openTab('/materias-primas')}
                className="text-xs font-medium transition-colors"
                style={{ color: 'var(--ac-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ac-accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ac-muted)')}
              >
                Matérias-Primas
              </button>
              <span className="text-xs" style={{ color: 'var(--ac-muted)' }}>/</span>
              <span className="text-xs font-mono" style={{ color: 'var(--ac-muted)' }}>{mp.codigo}</span>
            </div>

            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--ac-text)' }}>{mp.nome}</h2>

            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm font-mono" style={{ color: 'var(--ac-muted)' }}>{mp.codigo}</span>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                style={{ color: 'var(--ac-accent)', background: 'color-mix(in srgb, var(--ac-accent) 12%, transparent)' }}
              >
                {mp.categoria}
              </span>
              {mp.fornecedor && (
                <span className="text-sm" style={{ color: 'var(--ac-muted)' }}>
                  Fornecedor: <strong style={{ color: 'var(--ac-text)' }}>{mp.fornecedor.nome}</strong>
                </span>
              )}
              <span className="text-sm" style={{ color: 'var(--ac-text)' }}>
                Preço custo: <strong>
                  {mp.preco_custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </strong>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--ac-text)' }}>
                  Estoque: <strong>{Number(mp.estoque_atual).toLocaleString('pt-BR')}</strong>
                  <span className="text-xs ml-1" style={{ color: 'var(--ac-muted)' }}>
                    / {Number(mp.estoque_minimo).toLocaleString('pt-BR')}
                  </span>
                </span>
                <BadgeEstoque status={status} />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {perm.editar && (
              <Button variant="secondary" onClick={() => setEditModalOpen(true)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                Editar
              </Button>
            )}
            {perm.editar && (
              <Button onClick={abrirEntrada}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
                Entrada de Estoque
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-8">
        {/* ========== Facas que usam este material ========== */}
        <section>
          <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--ac-text)' }}>
            Facas que usam este material
          </h3>
          {facasQueUsam.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--ac-muted)' }}>
              Nenhuma faca cadastrada com este material.
            </p>
          ) : (
            <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--ac-border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Código</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Nome</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Categoria</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Qtd/unidade</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Estoque faca</th>
                  </tr>
                </thead>
                <tbody>
                  {facasQueUsam.map((faca, i) => (
                    <tr
                      key={faca.id}
                      style={{ borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined, background: 'var(--ac-card)', cursor: 'pointer' }}
                      onClick={() => openTab(`/facas/${faca.id}`)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ac-bg)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ac-card)')}
                    >
                      <td className="px-4 py-2.5 font-mono text-xs font-medium" style={{ color: 'var(--ac-muted)' }}>
                        {faca.codigo}
                      </td>
                      <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--ac-text)' }}>
                        {faca.nome}
                      </td>
                      <td className="px-4 py-2.5" style={{ color: 'var(--ac-muted)' }}>
                        {faca.categoria}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: 'var(--ac-text)' }}>
                        {faca.quantidade}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--ac-muted)' }}>
                        {Number(faca.estoque_atual).toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ========== Movimentações ========== */}
        <section>
          <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--ac-text)' }}>
            Movimentações de Estoque
          </h3>
          {movimentacoes.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--ac-muted)' }}>Nenhuma movimentação registrada.</p>
          ) : (
            <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid var(--ac-border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Data</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Tipo</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Faca</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Quantidade</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentacoes.map((mov, i) => {
                    const tl = tipoMovLabel[mov.tipo] ?? tipoMovLabel['ajuste']
                    return (
                      <tr
                        key={mov.id}
                        style={{ borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined, background: 'var(--ac-card)' }}
                      >
                        <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--ac-muted)' }}>
                          {formatDateTime(mov.created_at)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                            style={{ color: tl.color, background: tl.bg }}
                          >
                            {tl.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--ac-text)' }}>
                          {mov.faca ? `${mov.faca.codigo} — ${mov.faca.nome}` : '—'}
                        </td>
                        <td
                          className="px-4 py-2.5 text-right tabular-nums font-semibold"
                          style={{ color: mov.tipo === 'entrada' ? '#15803d' : mov.tipo === 'ajuste' ? 'var(--ac-text)' : '#b45309' }}
                        >
                          {mov.tipo === 'entrada' ? '+' : mov.tipo === 'ajuste' ? '' : '-'}
                          {Number(mov.quantidade).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--ac-muted)' }}>
                          {mov.observacao ?? '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Modal Editar */}
      <MPModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        editando={mp}
        fornecedores={fornecedores}
        categoriasMateriaPrima={categoriasMateriaPrima}
        onSaved={refreshActiveTab}
      />

      {/* Modal Entrada de Estoque */}
      <Modal
        open={entradaModalOpen}
        onClose={() => setEntradaModalOpen(false)}
        title={`Entrada de Estoque — ${mp.codigo}`}
        width="440px"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--ac-muted)' }}>
            Informe a quantidade recebida de{' '}
            <strong style={{ color: 'var(--ac-text)' }}>{mp.nome}</strong>.
            O estoque atual será atualizado e o registro aparecerá no histórico.
          </p>

          <div className="rounded-lg px-4 py-3 text-sm flex items-center gap-3" style={{ background: 'var(--ac-bg)', border: '1px solid var(--ac-border)' }}>
            <span style={{ color: 'var(--ac-muted)' }}>Estoque atual:</span>
            <strong style={{ color: 'var(--ac-text)' }}>{Number(mp.estoque_atual).toLocaleString('pt-BR')}</strong>
            {qtd > 0 && (
              <>
                <span style={{ color: 'var(--ac-muted)' }}>→</span>
                <strong style={{ color: '#15803d' }}>
                  {(Number(mp.estoque_atual) + qtd).toLocaleString('pt-BR')}
                </strong>
              </>
            )}
          </div>

          <Input
            id="quantidade"
            label="Quantidade recebida *"
            type="number"
            min="0.001"
            step="0.001"
            value={quantidade}
            onChange={(e) => { setQuantidade(e.target.value); setEntradaErro('') }}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>
              Observação (opcional)
            </label>
            <input
              type="text"
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              placeholder="Ex: NF 12345, Fornecedor X..."
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
              style={{ background: 'var(--ac-bg)', border: '1px solid var(--ac-border)', color: 'var(--ac-text)' }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--ac-accent)'
                e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--ac-accent) 20%, transparent)'
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--ac-border)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            />
          </div>

          {entradaErro && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>
              {entradaErro}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setEntradaModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEntrada} loading={entradaLoading} disabled={qtd <= 0}>
              Confirmar Entrada
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
