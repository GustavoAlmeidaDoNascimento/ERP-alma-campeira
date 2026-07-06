'use client'

import { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import {
  getFilaReposicaoDetalhe,
  atualizarItemFila,
  gerarOCsDaFila,
  dispensarFila,
} from '@/lib/actions/ordens-compra'
import type { FilaReposicao, FilaReposicaoDetalhe, FilaReposicaoItem, FilaReposicaoPedidoItem } from '@/types'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }

type Props = {
  fila: FilaReposicao
  perm: Perm
  /** Dado já pré-buscado (prefetch on hover). Se presente, evita o estado de loading. */
  initialDetalhe?: FilaReposicaoDetalhe
  /** Request em vôo iniciada pelo prefetch. Se presente, esperamos ela em vez de disparar nova. */
  initialDetalhePromise?: Promise<FilaReposicaoDetalhe>
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

export function FilaReposicaoDetalheModal({
  fila, perm, initialDetalhe, initialDetalhePromise, onClose, onRefresh,
}: Props) {
  function quantidadesIniciais(itens: FilaReposicaoItem[]): Record<string, string> {
    const m: Record<string, string> = {}
    for (const item of itens) {
      m[item.id] = String(item.quantidade_sugerida + item.quantidade_adicional)
    }
    return m
  }

  const [itens, setItens] = useState<FilaReposicaoItem[]>(() => initialDetalhe?.itens ?? [])
  const [pedidoItens, setPedidoItens] = useState<FilaReposicaoPedidoItem[]>(() => initialDetalhe?.pedido_itens ?? [])
  const [pedidoItensExpandidos, setPedidoItensExpandidos] = useState<Set<string>>(() => new Set())
  const [carregando, setCarregando] = useState(() => !initialDetalhe)
  const [erro, setErro] = useState('')
  const [salvandoItem, setSalvandoItem] = useState<string | null>(null)
  /** Valor editável = quantidade total a comprar (sugerida + adicional persistidos). */
  const [quantidadesLocais, setQuantidadesLocais] = useState<Record<string, string>>(() =>
    initialDetalhe ? quantidadesIniciais(initialDetalhe.itens) : {},
  )
  const [gerandoOC, setGerandoOC] = useState(false)
  const [dispensando, setDispensando] = useState(false)
  const [confirmandoDispensar, setConfirmandoDispensar] = useState(false)

  useEffect(() => {
    if (initialDetalhe) return // já temos os dados via prefetch
    let cancelled = false
    async function carregar() {
      setCarregando(true)
      setErro('')
      try {
        // Reaproveita a request já disparada pelo prefetch on hover, se houver.
        const detalhe = await (initialDetalhePromise ?? getFilaReposicaoDetalhe(fila.id))
        if (!cancelled) {
          setItens(detalhe.itens)
          setPedidoItens(detalhe.pedido_itens)
          setQuantidadesLocais(quantidadesIniciais(detalhe.itens))
        }
      } catch (e: unknown) {
        if (!cancelled) setErro(e instanceof Error ? e.message : 'Erro ao carregar detalhes.')
      } finally {
        if (!cancelled) setCarregando(false)
      }
    }
    carregar()
    return () => { cancelled = true }
  }, [fila.id, initialDetalhe, initialDetalhePromise])

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

  async function salvarQuantidade(item: FilaReposicaoItem) {
    if (!perm.editar) return
    const raw = quantidadesLocais[item.id] ?? String(item.quantidade_sugerida + item.quantidade_adicional)
    const total = parseNumero(raw)
    if (!Number.isFinite(total) || total < 0) {
      setErro('A quantidade não pode ser negativa.')
      return
    }
    const adicional = total - item.quantidade_sugerida
    setSalvandoItem(item.id)
    setErro('')
    try {
      await atualizarItemFila(item.id, { quantidade_adicional: adicional })
      setItens((prev) => prev.map((i) => i.id === item.id ? { ...i, quantidade_adicional: adicional } : i))
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
  function totalCompradoLocal(item: FilaReposicaoItem): number {
    const salvo = item.quantidade_sugerida + item.quantidade_adicional
    const raw = quantidadesLocais[item.id] ?? String(salvo)
    const parsed = parseNumero(raw)
    return Number.isFinite(parsed) ? parsed : salvo
  }

  const estimativaTotal = itensSelecionados.reduce((s, i) => {
    return s + i.mp_preco_custo * totalCompradoLocal(i)
  }, 0)

  // Agrupa por categoria + fornecedor na mesma ordem do backend. Assim o modal
  // espelha exatamente quantas OCs sairão e como ficarão divididas.
  const grupos = useMemo(() => {
    const map = new Map<
      string,
      { key: string; categoria: string; fornecedorNome: string; itens: FilaReposicaoItem[] }
    >()
    for (const item of itens) {
      const categoria = item.categoria?.trim() || 'Sem categoria'
      const fornecedorKey = item.fornecedor_id ?? '__sem_fornecedor__'
      const key = `${categoria}::${fornecedorKey}`
      const nome = item.fornecedor_nome ?? 'Sem fornecedor'
      const grupo = map.get(key)
      if (grupo) grupo.itens.push(item)
      else map.set(key, { key, categoria, fornecedorNome: nome, itens: [item] })
    }
    return Array.from(map.values())
  }, [itens])

  const ocsQueSerãoGeradas = grupos.filter((g) => g.itens.some((i) => i.selecionado)).length

  return (
    <Modal
      open
      onClose={onClose}
      title={`Reposição — ${fila.pedido_sequencial != null ? `#${fila.pedido_sequencial} · ` : ''}${fila.pedido_codigo}`}
      width="900px"
    >
      <div className="flex flex-col gap-5">
        {/* Resumo do pedido */}
        <div className="flex flex-wrap gap-4 text-sm" style={{ color: 'var(--ac-muted)' }}>
          <span>
            Pedido:{' '}
            {fila.pedido_sequencial != null && (
              <strong style={{ color: 'var(--ac-accent)' }}>#{fila.pedido_sequencial} · </strong>
            )}
            <strong style={{ color: 'var(--ac-text)' }}>{fila.pedido_codigo}</strong>
          </span>
          <span>Cliente: <strong style={{ color: 'var(--ac-text)' }}>{fila.cliente_nome}</strong></span>
          <span className="ml-auto text-base font-semibold" style={{ color: 'var(--ac-text)' }}>
            Estimativa: {fmt(estimativaTotal)}
          </span>
        </div>

        {/* Itens do pedido */}
        {!carregando && pedidoItens.length > 0 && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
            <div
              className="px-3 py-2 text-xs font-semibold uppercase tracking-wide"
              style={{
                color: 'var(--ac-muted)',
                background: 'color-mix(in srgb, var(--ac-border) 40%, transparent)',
                borderBottom: '1px solid var(--ac-border)',
              }}
            >
              Itens do pedido ({pedidoItens.length})
            </div>
            <ul className="divide-y" style={{ borderColor: 'var(--ac-border)' }}>
              {pedidoItens.map((pi, idx) => {
                const key = `${pi.faca_id}-${idx}`
                const expandido = pedidoItensExpandidos.has(key)
                const temMps = pi.materias_primas.length > 0
                return (
                  <li key={key}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!temMps) return
                        setPedidoItensExpandidos((prev) => {
                          const next = new Set(prev)
                          if (next.has(key)) next.delete(key)
                          else next.add(key)
                          return next
                        })
                      }}
                      disabled={!temMps}
                      className="w-full px-3 py-2 flex items-center gap-3 text-sm text-left transition-colors"
                      style={{
                        background: expandido ? 'color-mix(in srgb, var(--ac-accent) 6%, transparent)' : undefined,
                        cursor: temMps ? 'pointer' : 'default',
                      }}
                    >
                      <span
                        className="text-xs inline-flex w-4 justify-center"
                        style={{
                          color: 'var(--ac-muted)',
                          transform: expandido ? 'rotate(90deg)' : undefined,
                          transition: 'transform 120ms',
                          visibility: temMps ? 'visible' : 'hidden',
                        }}
                        aria-hidden
                      >
                        ▶
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate" style={{ color: 'var(--ac-text)' }}>
                          {pi.faca_nome}
                        </div>
                        <div className="text-xs font-mono" style={{ color: 'var(--ac-muted)' }}>
                          {pi.faca_codigo}
                        </div>
                      </div>
                      <div className="text-xs whitespace-nowrap" style={{ color: 'var(--ac-muted)' }}>
                        {fmtQtd(pi.quantidade)} × {fmt(pi.preco_unitario)}
                      </div>
                      <div className="font-semibold whitespace-nowrap" style={{ color: 'var(--ac-text)' }}>
                        {fmt(pi.quantidade * pi.preco_unitario)}
                      </div>
                    </button>

                    {expandido && temMps && (
                      <div
                        className="px-3 pb-3 pt-1"
                        style={{ background: 'color-mix(in srgb, var(--ac-border) 18%, transparent)' }}
                      >
                        <div className="text-xs mb-2" style={{ color: 'var(--ac-muted)' }}>
                          Matérias-primas usadas por <strong style={{ color: 'var(--ac-text)' }}>{pi.faca_nome}</strong>
                          {' '}(consumo por unidade · necessidade para {fmtQtd(pi.quantidade)} {pi.quantidade === 1 ? 'unidade' : 'unidades'}):
                        </div>
                        <ul className="flex flex-col gap-1">
                          {pi.materias_primas.map((mp) => {
                            const necessidade = mp.quantidade_por_faca * pi.quantidade
                            return (
                              <li
                                key={mp.mp_id}
                                className="flex items-center gap-2 text-xs px-2 py-1.5 rounded"
                                style={{ background: 'var(--ac-bg)', border: '1px solid var(--ac-border)' }}
                              >
                                <BadgeEstoque atual={mp.estoque_atual} minimo={mp.estoque_minimo} />
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium" style={{ color: 'var(--ac-text)' }}>{mp.mp_nome}</span>
                                  <span className="ml-1.5 font-mono" style={{ color: 'var(--ac-muted)' }}>{mp.mp_codigo}</span>
                                </div>
                                <span className="whitespace-nowrap" style={{ color: 'var(--ac-muted)' }}>
                                  {fmtQtd(mp.quantidade_por_faca)} / un · precisa {fmtQtd(necessidade)}
                                </span>
                                <span className="whitespace-nowrap" style={{ color: 'var(--ac-muted)' }}>
                                  estoque {fmtQtd(mp.estoque_atual)} / {fmtQtd(mp.estoque_minimo)}
                                </span>
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

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
                    Quantidade
                  </th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                    Estimativa
                  </th>
                </tr>
              </thead>
              <tbody>
                {grupos.flatMap((grupo, grupoIdx) => {
                  const itensSelGrupo = grupo.itens.filter((i) => i.selecionado)
                  const subtotalGrupo = itensSelGrupo.reduce((s, i) => {
                    return s + i.mp_preco_custo * totalCompradoLocal(i)
                  }, 0)
                  const geraOC = itensSelGrupo.length > 0

                  const header = (
                    <tr
                      key={`header-${grupo.key}`}
                      style={{
                        background: 'color-mix(in srgb, var(--ac-accent) 8%, transparent)',
                        borderTop: grupoIdx > 0 ? '2px solid var(--ac-border)' : undefined,
                      }}
                    >
                      <td colSpan={6} className="px-3 py-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                            style={{
                              background: geraOC ? 'var(--ac-accent)' : 'var(--ac-border)',
                              color: geraOC ? '#111827' : 'var(--ac-muted)',
                            }}
                          >
                            {geraOC ? `OC ${grupoIdx + 1}` : 'Sem OC'}
                          </span>
                          <span className="text-sm font-semibold" style={{ color: 'var(--ac-text)' }}>
                            {grupo.categoria}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--ac-muted)' }}>
                            · {grupo.fornecedorNome}
                          </span>
                          <span className="text-xs" style={{ color: 'var(--ac-muted)' }}>
                            · {itensSelGrupo.length}/{grupo.itens.length} {grupo.itens.length === 1 ? 'item' : 'itens'}
                          </span>
                          <span className="ml-auto text-xs font-medium" style={{ color: 'var(--ac-muted)' }}>
                            {geraOC ? `Subtotal: ${fmt(subtotalGrupo)}` : 'nenhum item selecionado'}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )

                  const linhas = grupo.itens.map((item, idx) => {
                  const qtdRaw = quantidadesLocais[item.id] ?? String(item.quantidade_sugerida + item.quantidade_adicional)
                  const qtdParsed = parseNumero(qtdRaw)
                  const salvoTotal = item.quantidade_sugerida + item.quantidade_adicional
                  const qtdTotal = Number.isFinite(qtdParsed) ? qtdParsed : salvoTotal
                  const estimativa = item.mp_preco_custo * qtdTotal
                  const foiAlterado =
                    Number.isFinite(qtdParsed) && Math.abs(qtdParsed - salvoTotal) > 1e-9

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

                      {/* Quantidade total a comprar (sugerida é referência, pode ser reduzida) */}
                      <td className="px-3 py-3 text-right">
                        {perm.editar && item.selecionado ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={qtdRaw}
                              onChange={(e) =>
                                setQuantidadesLocais((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                              disabled={salvandoItem === item.id}
                              className="w-24 px-2 py-1 rounded text-sm text-right font-semibold"
                              style={{
                                border: '1px solid var(--ac-border)',
                                background: 'var(--ac-bg)',
                                color: 'var(--ac-accent)',
                              }}
                            />
                            {foiAlterado && (
                              <button
                                type="button"
                                onClick={() => salvarQuantidade(item)}
                                disabled={salvandoItem === item.id}
                                className="px-2 py-1 rounded text-xs font-semibold"
                                style={{ background: 'var(--ac-accent)', color: '#111827' }}
                              >
                                {salvandoItem === item.id ? '…' : 'OK'}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="font-semibold" style={{ color: 'var(--ac-accent)' }}>
                            {fmtQtd(salvoTotal)}
                          </span>
                        )}
                      </td>

                      {/* Estimativa */}
                      <td className="px-3 py-3 text-right font-medium" style={{ color: 'var(--ac-text)' }}>
                        {item.selecionado ? fmt(estimativa) : '—'}
                      </td>
                    </tr>
                  )
                  })
                  return [header, ...linhas]
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
                Gerar {ocsQueSerãoGeradas === 1 ? 'OC' : 'OCs'} ({ocsQueSerãoGeradas} {ocsQueSerãoGeradas === 1 ? 'OC' : 'OCs'} · {itensSelecionados.length} {itensSelecionados.length === 1 ? 'item' : 'itens'})
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
