'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import {
  getFilaReposicaoDetalhe,
  atualizarItemFila,
  gerarOCsDaFila,
  dispensarFila,
} from '@/lib/actions/ordens-compra'
import type { FilaReposicao, FilaReposicaoItem } from '@/types'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }

type Props = {
  fila: FilaReposicao
  perm: Perm
  onClose: () => void
  onRefresh: () => void
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtQtd(n: number) {
  return Number.isInteger(n) ? String(n) : n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function BadgeEstoque({ atual, minimo }: { atual: number; minimo: number }) {
  const ok = atual >= minimo
  const atencao = !ok && atual >= minimo * 0.5
  const color = ok ? '#15803d' : atencao ? '#b45309' : '#dc2626'
  const bg = ok ? '#dcfce7' : atencao ? '#fef3c7' : '#fee2e2'
  const border = ok ? '#bbf7d0' : atencao ? '#fde68a' : '#fca5a5'
  const label = ok ? 'OK' : atencao ? 'Atenção' : 'Crítico'
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium"
      style={{ color, background: bg, border: `1px solid ${border}` }}
    >
      {label}
    </span>
  )
}

export function FilaReposicaoDetalheModal({ fila, perm, onClose, onRefresh }: Props) {
  const [itens, setItens] = useState<FilaReposicaoItem[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [salvandoItem, setSalvandoItem] = useState<string | null>(null)
  const [adicionaisLocais, setAdicionaisLocais] = useState<Record<string, string>>({})
  const [gerandoOC, setGerandoOC] = useState(false)
  const [dispensando, setDispensando] = useState(false)
  const [confirmandoDispensar, setConfirmandoDispensar] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function carregar() {
      setCarregando(true)
      setErro('')
      try {
        const detalhe = await getFilaReposicaoDetalhe(fila.id)
        if (!cancelled) {
          setItens(detalhe.itens)
          const iniciais: Record<string, string> = {}
          for (const item of detalhe.itens) {
            iniciais[item.id] = String(item.quantidade_adicional)
          }
          setAdicionaisLocais(iniciais)
        }
      } catch (e: unknown) {
        if (!cancelled) setErro(e instanceof Error ? e.message : 'Erro ao carregar detalhes.')
      } finally {
        if (!cancelled) setCarregando(false)
      }
    }
    carregar()
    return () => { cancelled = true }
  }, [fila.id])

  function parseNumero(raw: string): number {
    const v = raw.trim().replace(',', '.')
    const n = Number(v)
    return Number.isFinite(n) ? n : NaN
  }

  async function toggleSelecionado(item: FilaReposicaoItem) {
    if (!perm.editar) return
    const novoValor = !item.selecionado
    setItens((prev) => prev.map((i) => i.id === item.id ? { ...i, selecionado: novoValor } : i))
    setSalvandoItem(item.id)
    try {
      await atualizarItemFila(item.id, { selecionado: novoValor })
    } catch (e: unknown) {
      setItens((prev) => prev.map((i) => i.id === item.id ? { ...i, selecionado: item.selecionado } : i))
      setErro(e instanceof Error ? e.message : 'Erro ao atualizar item.')
    } finally {
      setSalvandoItem(null)
    }
  }

  async function salvarAdicional(item: FilaReposicaoItem) {
    if (!perm.editar) return
    const raw = adicionaisLocais[item.id] ?? '0'
    const valor = parseNumero(raw)
    if (!Number.isFinite(valor) || valor < 0) {
      setErro('Quantidade adicional inválida.')
      return
    }
    setSalvandoItem(item.id)
    setErro('')
    try {
      await atualizarItemFila(item.id, { quantidade_adicional: valor })
      setItens((prev) => prev.map((i) => i.id === item.id ? { ...i, quantidade_adicional: valor } : i))
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSalvandoItem(null)
    }
  }

  async function handleGerarOC() {
    setGerandoOC(true)
    setErro('')
    try {
      const codigos = await gerarOCsDaFila(fila.id)
      onRefresh()
      onClose()
      // A mensagem de sucesso é tratada pelo OcClient via flash
      void codigos
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao gerar OC.')
    } finally {
      setGerandoOC(false)
    }
  }

  async function handleDispensar() {
    setDispensando(true)
    setErro('')
    try {
      await dispensarFila(fila.id)
      onRefresh()
      onClose()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao dispensar.')
    } finally {
      setDispensando(false)
    }
  }

  const itensSelecionados = itens.filter((i) => i.selecionado)
  const estimativaTotal = itensSelecionados.reduce((s, i) => {
    const adicional = parseNumero(adicionaisLocais[i.id] ?? String(i.quantidade_adicional))
    const adicionalSafe = Number.isFinite(adicional) ? adicional : i.quantidade_adicional
    return s + i.mp_preco_custo * (i.quantidade_sugerida + adicionalSafe)
  }, 0)

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reposição — ${fila.pedido_codigo}`}
      width="900px"
    >
      <div className="flex flex-col gap-5">
        {/* Resumo do pedido */}
        <div className="flex flex-wrap gap-4 text-sm" style={{ color: 'var(--ac-muted)' }}>
          <span>Pedido: <strong style={{ color: 'var(--ac-text)' }}>{fila.pedido_codigo}</strong></span>
          <span>Cliente: <strong style={{ color: 'var(--ac-text)' }}>{fila.cliente_nome}</strong></span>
          <span className="ml-auto text-base font-semibold" style={{ color: 'var(--ac-text)' }}>
            Estimativa: {fmt(estimativaTotal)}
          </span>
        </div>

        {/* Corpo */}
        {carregando ? (
          <div className="py-12 text-center text-sm" style={{ color: 'var(--ac-muted)' }}>
            Carregando análise de estoque...
          </div>
        ) : itens.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: 'var(--ac-muted)' }}>
            Nenhuma matéria-prima identificada para reposição.
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'color-mix(in srgb, var(--ac-border) 40%, transparent)' }}>
                  <th className="px-3 py-2.5 w-10" />
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                    Matéria-Prima
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                    Estoque
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                    Facas que usam
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                    Qtd sugerida
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                    Qtd adicional
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                    Estimativa
                  </th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item, idx) => {
                  const adicionalRaw = adicionaisLocais[item.id] ?? String(item.quantidade_adicional)
                  const adicionalValor = parseNumero(adicionalRaw)
                  const adicionalSafe = Number.isFinite(adicionalValor) ? adicionalValor : item.quantidade_adicional
                  const qtdTotal = item.quantidade_sugerida + adicionalSafe
                  const estimativa = item.mp_preco_custo * qtdTotal
                  const foiAlterado = adicionalRaw !== String(item.quantidade_adicional)

                  return (
                    <tr
                      key={item.id}
                      style={{
                        borderTop: idx > 0 ? '1px solid var(--ac-border)' : undefined,
                        opacity: item.selecionado ? 1 : 0.45,
                        background: item.selecionado ? undefined : 'color-mix(in srgb, var(--ac-border) 10%, transparent)',
                      }}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={item.selecionado}
                          disabled={!perm.editar || salvandoItem === item.id}
                          onChange={() => toggleSelecionado(item)}
                          className="w-4 h-4 cursor-pointer rounded"
                          style={{ accentColor: 'var(--ac-accent)' }}
                        />
                      </td>

                      {/* Matéria-Prima */}
                      <td className="px-3 py-3">
                        <div className="font-medium" style={{ color: 'var(--ac-text)' }}>{item.mp_nome}</div>
                        <div className="text-xs font-mono mt-0.5" style={{ color: 'var(--ac-muted)' }}>
                          {item.mp_codigo}
                          {item.fornecedor_nome && (
                            <span className="ml-2">· {item.fornecedor_nome}</span>
                          )}
                        </div>
                      </td>

                      {/* Estoque MP */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <BadgeEstoque atual={item.estoque_atual} minimo={item.estoque_minimo} />
                          <span className="text-xs" style={{ color: 'var(--ac-muted)' }}>
                            {fmtQtd(item.estoque_atual)} / {fmtQtd(item.estoque_minimo)}
                          </span>
                        </div>
                      </td>

                      {/* Facas relacionadas */}
                      <td className="px-3 py-3">
                        <div className="flex flex-col gap-1">
                          {item.facas_relacionadas.length === 0 ? (
                            <span className="text-xs" style={{ color: 'var(--ac-muted)' }}>—</span>
                          ) : (
                            item.facas_relacionadas.map((f) => (
                              <div key={f.faca_id} className="flex items-center gap-1.5">
                                <BadgeEstoque atual={f.estoque_atual} minimo={f.estoque_minimo} />
                                <span className="text-xs" style={{ color: 'var(--ac-muted)' }}>
                                  {f.faca_nome} ({fmtQtd(f.estoque_atual)}/{fmtQtd(f.estoque_minimo)})
                                </span>
                              </div>
                            ))
                          )}
                        </div>
                      </td>

                      {/* Qtd sugerida */}
                      <td className="px-3 py-3 text-right font-semibold" style={{ color: 'var(--ac-accent)' }}>
                        {fmtQtd(item.quantidade_sugerida)}
                      </td>

                      {/* Qtd adicional */}
                      <td className="px-3 py-3 text-right">
                        {perm.editar && item.selecionado ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              min="0"
                              step="any"
                              value={adicionalRaw}
                              onChange={(e) =>
                                setAdicionaisLocais((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                              disabled={salvandoItem === item.id}
                              className="w-20 px-2 py-1 rounded text-sm text-right"
                              style={{
                                border: '1px solid var(--ac-border)',
                                background: 'var(--ac-bg)',
                                color: 'var(--ac-text)',
                              }}
                            />
                            {foiAlterado && (
                              <button
                                onClick={() => salvarAdicional(item)}
                                disabled={salvandoItem === item.id}
                                className="px-2 py-1 rounded text-xs font-semibold"
                                style={{ background: 'var(--ac-accent)', color: '#111827' }}
                              >
                                {salvandoItem === item.id ? '…' : 'OK'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--ac-text)' }}>{fmtQtd(item.quantidade_adicional)}</span>
                        )}
                      </td>

                      {/* Estimativa */}
                      <td className="px-3 py-3 text-right font-medium" style={{ color: 'var(--ac-text)' }}>
                        {item.selecionado ? fmt(estimativa) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Erro */}
        {erro && (
          <p className="text-sm px-3 py-2 rounded-lg" style={{ background: '#fee2e2', color: '#dc2626' }}>
            {erro}
          </p>
        )}

        {/* Ações */}
        {!carregando && (
          <div
            className="flex flex-wrap items-center gap-2 pt-1"
            style={{ borderTop: '1px solid var(--ac-border)' }}
          >
            {!confirmandoDispensar ? (
              <Button
                variant="secondary"
                onClick={() => setConfirmandoDispensar(true)}
                disabled={gerandoOC || dispensando}
              >
                Dispensar
              </Button>
            ) : (
              <>
                <span className="text-sm" style={{ color: 'var(--ac-muted)' }}>
                  Dispensar remove da fila. Confirmar?
                </span>
                <Button variant="secondary" onClick={() => setConfirmandoDispensar(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="danger"
                  loading={dispensando}
                  onClick={handleDispensar}
                >
                  Confirmar Dispensar
                </Button>
              </>
            )}

            <div className="flex-1" />

            <Button
              variant="secondary"
              onClick={onClose}
              disabled={gerandoOC || dispensando}
            >
              Deixar Pendente
            </Button>

            {perm.criar && (
              <Button
                variant="primary"
                loading={gerandoOC}
                disabled={itensSelecionados.length === 0 || dispensando || carregando}
                onClick={handleGerarOC}
              >
                Gerar {itensSelecionados.length === 1 ? 'OC' : 'OCs'} ({itensSelecionados.length} {itensSelecionados.length === 1 ? 'item' : 'itens'})
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
