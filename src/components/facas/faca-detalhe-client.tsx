'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { BadgeEstoque } from '@/components/ui/badge-estoque'
import { FacaModal } from './faca-modal'
import { entradaEstoqueFaca } from '@/lib/actions/facas'
import { statusEstoqueFaca, STATUS_PEDIDO } from '@/types'
import type { Faca, FacaMateriaPrima, MovimentacaoEstoque, PedidoItemComPedido, CategoriaFacaDB, MateriaPrima } from '@/types'
import type { FacaDetalheData } from '@/lib/actions/facas'
import { useErpTabs } from '@/components/layout/erp-tabs'
import { getOptimizedSupabaseImageUrl } from '@/lib/supabase/optimized-image'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }

type Props = {
  detalhe: FacaDetalheData
  materiasPrimas: MateriaPrima[]
  categorias: CategoriaFacaDB[]
  perm: Perm
}

export function FacaDetalheClient({ detalhe, materiasPrimas, categorias, perm }: Props) {
  const { faca, bom, vendas, movimentacoes } = detalhe
  const { refreshActiveTab, openTab } = useErpTabs()

  const [editModalOpen, setEditModalOpen] = useState(false)
  const [entradaModalOpen, setEntradaModalOpen] = useState(false)
  const [quantidadeProduzir, setQuantidadeProduzir] = useState('1')
  const [entradaLoading, setEntradaLoading] = useState(false)
  const [entradaErro, setEntradaErro] = useState('')
  const [entradaSucesso, setEntradaSucesso] = useState('')

  const fotoUrl = faca.foto_url
    ? getOptimizedSupabaseImageUrl(faca.foto_url, { width: 200, height: 200, quality: 80, resize: 'cover' })
    : ''

  const custoTotal = useMemo(() => {
    return bom.reduce((acc, item) => {
      const preco = item.materia_prima?.preco_custo ?? 0
      return acc + preco * item.quantidade
    }, 0)
  }, [bom])

  // Preview de consumo de MPs para entrada de estoque
  const qtdProduzir = Number(quantidadeProduzir) || 0
  const previewConsumo = useMemo(() => {
    return bom.map((item) => {
      const mp = item.materia_prima
      const necessario = item.quantidade * qtdProduzir
      const disponivel = mp?.estoque_atual ?? 0
      const restante = disponivel - necessario
      return {
        codigo: mp?.codigo ?? '?',
        nome: mp?.nome ?? '?',
        necessario: Math.round(necessario * 1000) / 1000,
        disponivel,
        restante: Math.round(restante * 1000) / 1000,
        suficiente: restante >= 0,
      }
    })
  }, [bom, qtdProduzir])

  const todosDisponíveis = previewConsumo.every((p) => p.suficiente)

  async function handleEntrada() {
    if (qtdProduzir <= 0) return
    setEntradaErro('')
    setEntradaSucesso('')
    setEntradaLoading(true)
    try {
      const result = await entradaEstoqueFaca(faca.id, qtdProduzir)
      const resumo = result.materiaisConsumidos
        .map((m) => `${m.codigo}: -${m.consumido}`)
        .join(', ')
      setEntradaSucesso(`${qtdProduzir}x ${faca.codigo} produzidas. Consumo: ${resumo}`)
      setQuantidadeProduzir('1')
      refreshActiveTab()
    } catch (e: unknown) {
      setEntradaErro(e instanceof Error ? e.message : 'Erro ao registrar entrada.')
    } finally {
      setEntradaLoading(false)
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  function formatDateTime(dateStr: string) {
    return new Date(dateStr).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const tipoMovLabel: Record<string, { label: string; color: string; bg: string }> = {
    entrada: { label: 'Entrada', color: '#15803d', bg: '#dcfce7' },
    saida_producao: { label: 'Produção', color: '#b45309', bg: '#fef3c7' },
    saida_venda: { label: 'Venda', color: '#1d4ed8', bg: '#dbeafe' },
    ajuste: { label: 'Ajuste', color: '#6b7280', bg: '#f3f4f6' },
  }

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
              <img src={fotoUrl} alt={faca.nome} width={120} height={120} style={{ objectFit: 'cover' }} />
            ) : (
              <img src="/images/favicon-yellow.png" alt="Sem foto" width={48} height={48} style={{ objectFit: 'contain' }} />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-1">
              <button
                type="button"
                onClick={() => openTab('/facas')}
                className="text-xs font-medium transition-colors"
                style={{ color: 'var(--ac-muted)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ac-accent)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ac-muted)')}
              >
                Facas
              </button>
              <span className="text-xs" style={{ color: 'var(--ac-muted)' }}>/</span>
              <span className="text-xs font-mono" style={{ color: 'var(--ac-muted)' }}>{faca.codigo}</span>
            </div>

            <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--ac-text)' }}>{faca.nome}</h2>

            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm font-mono" style={{ color: 'var(--ac-muted)' }}>{faca.codigo}</span>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                style={{ color: 'var(--ac-accent)', background: 'color-mix(in srgb, var(--ac-accent) 12%, transparent)' }}
              >
                {faca.categoria}
              </span>
              <span className="text-sm font-semibold" style={{ color: 'var(--ac-text)' }}>
                {faca.preco_venda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--ac-text)' }}>
                  Estoque: <strong>{faca.estoque_atual}</strong>
                  <span className="text-xs ml-1" style={{ color: 'var(--ac-muted)' }}>/ {faca.estoque_minimo}</span>
                </span>
                <BadgeEstoque status={statusEstoqueFaca(faca)} />
              </div>
              {custoTotal > 0 && (
                <span className="text-xs" style={{ color: 'var(--ac-muted)' }}>
                  Custo MP: {custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              )}
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
              <Button onClick={() => { setEntradaModalOpen(true); setEntradaErro(''); setEntradaSucesso('') }}>
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
        {/* ========== BOM ========== */}
        <section>
          <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--ac-text)' }}>Lista de Materiais</h3>
          {bom.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--ac-muted)' }}>Nenhuma matéria-prima cadastrada para esta faca.</p>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Código</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Nome</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Qtd/unidade</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Custo unit.</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Subtotal</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Estoque MP</th>
                  </tr>
                </thead>
                <tbody>
                  {bom.map((item, i) => {
                    const mp = item.materia_prima
                    const subtotal = (mp?.preco_custo ?? 0) * item.quantidade
                    return (
                      <tr key={item.id} style={{ borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined, background: 'var(--ac-card)' }}>
                        <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--ac-muted)' }}>{mp?.codigo ?? '—'}</td>
                        <td className="px-4 py-2.5 font-medium" style={{ color: 'var(--ac-text)' }}>{mp?.nome ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--ac-text)' }}>{item.quantidade}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--ac-text)' }}>
                          {(mp?.preco_custo ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: 'var(--ac-text)' }}>
                          {subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--ac-muted)' }}>
                          {mp?.estoque_atual ?? 0}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '1px solid var(--ac-border)', background: 'var(--ac-bg)' }}>
                    <td colSpan={4} className="px-4 py-2.5 text-right text-xs font-semibold uppercase" style={{ color: 'var(--ac-muted)' }}>
                      Custo total por faca
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-bold" style={{ color: 'var(--ac-text)' }}>
                      {custoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* ========== Histórico de Vendas ========== */}
        <section>
          <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--ac-text)' }}>Histórico de Vendas</h3>
          {vendas.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--ac-muted)' }}>Nenhuma venda registrada para esta faca.</p>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Pedido</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Data</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Qtd</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Preço unit.</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Subtotal</th>
                    <th className="text-center px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {vendas.map((item, i) => {
                    const pedido = item.pedido
                    const st = pedido?.status ? STATUS_PEDIDO[pedido.status] : null
                    return (
                      <tr key={item.id} style={{ borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined, background: 'var(--ac-card)' }}>
                        <td className="px-4 py-2.5 font-mono text-xs font-medium" style={{ color: 'var(--ac-muted)' }}>
                          {pedido?.codigo ?? '—'}
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--ac-muted)' }}>
                          {pedido?.data_pedido ? formatDate(pedido.data_pedido) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: 'var(--ac-text)' }}>
                          {item.quantidade}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--ac-text)' }}>
                          {item.preco_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: 'var(--ac-text)' }}>
                          {item.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          {st ? (
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                              style={{ color: st.color, background: st.bg, border: `1px solid ${st.border}` }}
                            >
                              {st.label}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ========== Movimentações ========== */}
        <section>
          <h3 className="text-lg font-semibold mb-3" style={{ color: 'var(--ac-text)' }}>Movimentações de Estoque</h3>
          {movimentacoes.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--ac-muted)' }}>Nenhuma movimentação registrada.</p>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Data</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Tipo</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Matéria-Prima</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Quantidade</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentacoes.map((mov, i) => {
                    const tl = tipoMovLabel[mov.tipo] ?? tipoMovLabel['ajuste']
                    return (
                      <tr key={mov.id} style={{ borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined, background: 'var(--ac-card)' }}>
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
                          {mov.materia_prima ? `${mov.materia_prima.codigo} — ${mov.materia_prima.nome}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: 'var(--ac-text)' }}>
                          {mov.quantidade}
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
      <FacaModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        editando={faca}
        categorias={categorias}
        materiasPrimas={materiasPrimas}
        onSaved={refreshActiveTab}
      />

      {/* Modal Entrada de Estoque */}
      <Modal
        open={entradaModalOpen}
        onClose={() => setEntradaModalOpen(false)}
        title={`Entrada de Estoque — ${faca.codigo}`}
        width="560px"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--ac-muted)' }}>
            Informe quantas unidades de <strong style={{ color: 'var(--ac-text)' }}>{faca.nome}</strong> foram produzidas.
            O sistema descontará automaticamente as matérias-primas do estoque.
          </p>

          <Input
            id="qtd-produzir"
            label="Quantidade a produzir"
            type="number"
            min="1"
            step="1"
            value={quantidadeProduzir}
            onChange={(e) => { setQuantidadeProduzir(e.target.value); setEntradaErro(''); setEntradaSucesso('') }}
          />

          {/* Preview de consumo */}
          {qtdProduzir > 0 && bom.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
                    <th className="text-left px-3 py-2 font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Matéria-Prima</th>
                    <th className="text-right px-3 py-2 font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Necessário</th>
                    <th className="text-right px-3 py-2 font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Disponível</th>
                    <th className="text-right px-3 py-2 font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Restante</th>
                  </tr>
                </thead>
                <tbody>
                  {previewConsumo.map((p, i) => (
                    <tr key={i} style={{ borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined, background: 'var(--ac-card)' }}>
                      <td className="px-3 py-2 font-medium" style={{ color: 'var(--ac-text)' }}>
                        <span className="font-mono" style={{ color: 'var(--ac-muted)' }}>{p.codigo}</span> {p.nome}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold" style={{ color: 'var(--ac-text)' }}>
                        {p.necessario}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: 'var(--ac-muted)' }}>
                        {p.disponivel}
                      </td>
                      <td
                        className="px-3 py-2 text-right tabular-nums font-bold"
                        style={{ color: p.suficiente ? '#15803d' : '#dc2626' }}
                      >
                        {p.restante}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!todosDisponíveis && qtdProduzir > 0 && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>
              Matérias-primas insuficientes para produzir {qtdProduzir} unidades.
            </p>
          )}

          {entradaErro && (
            <p className="text-sm rounded-lg px-3 py-2 whitespace-pre-line" style={{ color: '#dc2626', background: '#fee2e2' }}>
              {entradaErro}
            </p>
          )}

          {entradaSucesso && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#15803d', background: '#dcfce7' }}>
              {entradaSucesso}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setEntradaModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleEntrada}
              loading={entradaLoading}
              disabled={!todosDisponíveis || qtdProduzir <= 0}
            >
              Confirmar Produção
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
