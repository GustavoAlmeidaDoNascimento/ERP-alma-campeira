'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { GastoModal } from './gasto-modal'
import { deletarGasto } from '@/lib/actions/gastos'
import { FORMAS_PAGAMENTO, metaTipoGasto } from '@/types'
import type { Gasto, TipoGasto, FormaPagamento, TipoGastoDB } from '@/types'
import { useErpTabs } from '@/components/layout/erp-tabs'
import { useGastos, useTiposGasto } from '@/lib/query/hooks'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }

const moedaBR = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBR = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

function formatarData(s: string) {
  if (!s) return '—'
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return s
  return dataBR.format(new Date(y, m - 1, d))
}

const inputStyle = {
  background: 'var(--ac-card)',
  border: '1px solid var(--ac-border)',
  color: 'var(--ac-text)',
}

const selectChevron = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%236b7280' stroke-width='2' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat' as const,
  backgroundPosition: 'right 10px center',
  backgroundSize: '16px',
  paddingRight: '36px',
}

export function GastosClient({
  gastos: initialGastos,
  usuarios,
  usuarioLogadoId,
  perm,
}: {
  gastos: Gasto[]
  usuarios: { id: string; nome: string }[]
  usuarioLogadoId: string | null
  perm: Perm
}) {
  const { refreshActiveTab } = useErpTabs()
  const { data: gastos = initialGastos } = useGastos({ initialData: initialGastos })
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Gasto | null>(null)
  const [deletando, setDeletando] = useState<Gasto | null>(null)
  const [erroDelete, setErroDelete] = useState('')
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<'' | TipoGasto>('')
  const [filtroForma, setFiltroForma] = useState<'' | FormaPagamento>('')

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return gastos.filter((g) => {
      if (filtroTipo && g.tipo !== filtroTipo) return false
      if (filtroForma && g.forma_pagamento !== filtroForma) return false
      if (!q) return true
      return (
        g.descricao.toLowerCase().includes(q) ||
        (g.observacao ?? '').toLowerCase().includes(q) ||
        (g.ordem_compra?.codigo ?? '').toLowerCase().includes(q)
      )
    })
  }, [gastos, busca, filtroTipo, filtroForma])

  const totalPeriodo = useMemo(
    () => filtrados.reduce((s, g) => s + Number(g.valor ?? 0), 0),
    [filtrados]
  )

  const totalPorTipo = useMemo(() => {
    const acc = new Map<TipoGasto, number>()
    for (const g of filtrados) {
      acc.set(g.tipo, (acc.get(g.tipo) ?? 0) + Number(g.valor ?? 0))
    }
    return Array.from(acc.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
  }, [filtrados])

  function abrirNovo() { setEditando(null); setModalAberto(true) }
  function abrirEditar(g: Gasto) { setEditando(g); setModalAberto(true) }

  async function confirmarDelete() {
    if (!deletando) return
    setErroDelete(''); setLoadingDelete(true)
    try {
      await deletarGasto(deletando.id)
      setDeletando(null)
      refreshActiveTab()
    } catch (e: unknown) {
      setErroDelete(e instanceof Error ? e.message : 'Erro ao excluir.')
    } finally {
      setLoadingDelete(false)
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6" style={{ borderBottom: '1px solid var(--ac-border)' }}>
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ac-text)' }}>Gastos</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ac-muted)' }}>
            {gastos.length} {gastos.length === 1 ? 'lançamento' : 'lançamentos'} no histórico
          </p>
        </div>
        {perm.criar && (
          <Button onClick={abrirNovo}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-4">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Registrar gasto
          </Button>
        )}
      </div>

      {/* KPIs */}
      <div className="px-8 pt-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="rounded-xl p-4" style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)' }}>
          <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--ac-muted)' }}>Total filtrado</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--ac-text)' }}>{moedaBR.format(totalPeriodo)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--ac-muted)' }}>
            {filtrados.length} {filtrados.length === 1 ? 'lançamento' : 'lançamentos'}
          </p>
        </div>
        {totalPorTipo.map(([t, v]) => (
          <div key={t} className="rounded-xl p-4" style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)' }}>
            <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: TIPOS_GASTO[t].color }}>
              {TIPOS_GASTO[t].label}
            </p>
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--ac-text)' }}>{moedaBR.format(v)}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--ac-muted)' }}>
              {totalPeriodo > 0 ? `${((v / totalPeriodo) * 100).toFixed(1)}% do total` : '—'}
            </p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="px-8 py-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5 grow max-w-sm">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Buscar</label>
          <input
            type="text"
            placeholder="Descrição, observação, código de OC..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
            style={inputStyle}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Tipo</label>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value as TipoGasto | '')}
            className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
            style={{ ...inputStyle, ...selectChevron }}
          >
            <option value="">Todos</option>
            {(Object.keys(TIPOS_GASTO) as TipoGasto[]).map((t) => (
              <option key={t} value={t}>{TIPOS_GASTO[t].label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Forma</label>
          <select
            value={filtroForma}
            onChange={(e) => setFiltroForma(e.target.value as FormaPagamento | '')}
            className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
            style={{ ...inputStyle, ...selectChevron }}
          >
            <option value="">Todas</option>
            {(Object.keys(FORMAS_PAGAMENTO) as FormaPagamento[]).map((f) => (
              <option key={f} value={f}>{FORMAS_PAGAMENTO[f].label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="px-8 pb-8">
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Data</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Tipo</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Descrição</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Valor</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Pagamento</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>OC vinculada</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Registrado por</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm" style={{ color: 'var(--ac-muted)' }}>
                    {busca || filtroTipo || filtroForma
                      ? 'Nenhum lançamento corresponde aos filtros.'
                      : 'Nenhum gasto registrado ainda.'}
                  </td>
                </tr>
              )}
              {filtrados.map((g, i) => {
                const meta = TIPOS_GASTO[g.tipo]
                return (
                  <tr key={g.id}
                    style={{ borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined, background: 'var(--ac-card)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ac-bg)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ac-card)')}
                  >
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--ac-muted)' }}>{formatarData(g.data_gasto)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap"
                        style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}>
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--ac-text)' }}>
                      <div className="font-medium">{g.descricao}</div>
                      {g.observacao && (
                        <div className="text-xs mt-0.5" style={{ color: 'var(--ac-muted)' }}>{g.observacao}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap" style={{ color: 'var(--ac-text)' }}>
                      {moedaBR.format(Number(g.valor ?? 0))}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--ac-muted)' }}>
                      {FORMAS_PAGAMENTO[g.forma_pagamento]?.label ?? g.forma_pagamento}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {g.ordem_compra?.codigo ? (
                        <Link href="/ordens-compra" className="text-xs font-mono underline"
                          style={{ color: 'var(--ac-accent)' }}>
                          {g.ordem_compra.codigo}
                        </Link>
                      ) : (
                        <span style={{ color: 'var(--ac-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--ac-muted)' }}>
                      {g.usuario?.nome ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {perm.editar && (
                          <button onClick={() => abrirEditar(g)} className="p-1.5 rounded-lg transition-colors"
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
                        {perm.deletar && (
                          <button onClick={() => { setDeletando(g); setErroDelete('') }} className="p-1.5 rounded-lg transition-colors"
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

      <GastoModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        editando={editando}
        usuarios={usuarios}
        usuarioLogadoId={usuarioLogadoId}
        onSaved={refreshActiveTab}
      />

      <Modal open={!!deletando} onClose={() => setDeletando(null)} title="Excluir gasto">
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--ac-text)' }}>
            Tem certeza que deseja excluir o lançamento{' '}
            <strong>{deletando?.descricao}</strong> ({moedaBR.format(Number(deletando?.valor ?? 0))})?
            Esta ação não pode ser desfeita.
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
