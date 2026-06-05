'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { GastoModal } from '@/components/gastos/gasto-modal'
import { EntradaModal } from './entrada-modal'
import { MovimentacaoDetalheModal } from './movimentacao-detalhe-modal'
import { FORMAS_PAGAMENTO } from '@/types'
import type { Movimentacao, MovimentacaoDirecao, TipoGastoDB } from '@/types'
import { useErpTabs } from '@/components/layout/erp-tabs'
import { useMovimentacoes, useTiposGasto } from '@/lib/query/hooks'

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

export function MovimentacaoClient({
  movimentacoes: initialMovs,
  tiposGasto,
  usuarios,
  usuarioLogadoId,
  perm,
}: {
  movimentacoes: Movimentacao[]
  tiposGasto: TipoGastoDB[]
  usuarios: { id: string; nome: string }[]
  usuarioLogadoId: string | null
  perm: Perm
}) {
  const { refreshActiveTab } = useErpTabs()
  const { data: movimentacoes = initialMovs } = useMovimentacoes({ initialData: initialMovs })
  // Semeia o cache de tipos de gasto para o GastoModal abrir já com as tags.
  useTiposGasto({ initialData: tiposGasto })

  const [busca, setBusca] = useState('')
  const [filtroDirecao, setFiltroDirecao] = useState<'' | MovimentacaoDirecao>('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')

  const [detalhe, setDetalhe] = useState<Movimentacao | null>(null)
  const [gastoModalOpen, setGastoModalOpen] = useState(false)
  const [entradaModalOpen, setEntradaModalOpen] = useState(false)

  const categorias = useMemo(() => {
    const set = new Set<string>()
    for (const m of movimentacoes) if (m.categoria) set.add(m.categoria)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [movimentacoes])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return movimentacoes.filter((m) => {
      if (filtroDirecao && m.direcao !== filtroDirecao) return false
      if (filtroCategoria && m.categoria !== filtroCategoria) return false
      if (de && m.data < de) return false
      if (ate && m.data > ate) return false
      if (!q) return true
      return (
        m.descricao.toLowerCase().includes(q) ||
        (m.categoria ?? '').toLowerCase().includes(q) ||
        (m.codigo ?? '').toLowerCase().includes(q) ||
        (m.usuario_nome ?? '').toLowerCase().includes(q)
      )
    })
  }, [movimentacoes, busca, filtroDirecao, filtroCategoria, de, ate])

  const { totalEntradas, totalSaidas } = useMemo(() => {
    let e = 0
    let s = 0
    for (const m of filtrados) {
      if (m.direcao === 'entrada') e += m.valor
      else s += m.valor
    }
    return { totalEntradas: e, totalSaidas: s }
  }, [filtrados])
  const saldo = totalEntradas - totalSaidas

  // refreshActiveTab() invalida todas as queries (inclui movimentação/gastos/entradas).
  const onSaved = refreshActiveTab

  const temFiltro = !!(busca || filtroDirecao || filtroCategoria || de || ate)

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6" style={{ borderBottom: '1px solid var(--ac-border)' }}>
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ac-text)' }}>Movimentação</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ac-muted)' }}>
            {movimentacoes.length} {movimentacoes.length === 1 ? 'movimentação' : 'movimentações'} no histórico
          </p>
        </div>
        <div className="flex items-center gap-2">
          {perm.criar && (
            <Button variant="secondary" onClick={() => setEntradaModalOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="#15803d" strokeWidth={2.5} className="size-4">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Registrar entrada
            </Button>
          )}
          {perm.criar && (
            <Button onClick={() => setGastoModalOpen(true)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-4">
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Registrar gasto
            </Button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="px-8 pt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl p-4" style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)' }}>
          <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#15803d' }}>Entradas</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#15803d' }}>{moedaBR.format(totalEntradas)}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)' }}>
          <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#b91c1c' }}>Saídas</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#b91c1c' }}>{moedaBR.format(totalSaidas)}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)' }}>
          <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--ac-muted)' }}>Saldo</p>
          <p className="text-2xl font-bold mt-1" style={{ color: saldo >= 0 ? '#15803d' : '#b91c1c' }}>
            {moedaBR.format(saldo)}
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-8 py-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5 grow max-w-xs">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Buscar</label>
          <input
            type="text"
            placeholder="Descrição, categoria, código…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
            style={inputStyle}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Tipo</label>
          <select
            value={filtroDirecao}
            onChange={(e) => setFiltroDirecao(e.target.value as MovimentacaoDirecao | '')}
            className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
            style={{ ...inputStyle, ...selectChevron }}
          >
            <option value="">Tudo</option>
            <option value="entrada">Só entradas</option>
            <option value="saida">Só saídas</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Categoria</label>
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
            style={{ ...inputStyle, ...selectChevron }}
          >
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>De</label>
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Até</label>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none" style={inputStyle} />
        </div>
        {temFiltro && (
          <button
            onClick={() => { setBusca(''); setFiltroDirecao(''); setFiltroCategoria(''); setDe(''); setAte('') }}
            className="text-sm px-3 py-2.5 rounded-lg transition-colors"
            style={{ color: 'var(--ac-muted)' }}
          >
            Limpar filtros
          </button>
        )}
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
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Categoria</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Forma</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-sm" style={{ color: 'var(--ac-muted)' }}>
                    {temFiltro ? 'Nenhuma movimentação corresponde aos filtros.' : 'Nenhuma movimentação registrada ainda.'}
                  </td>
                </tr>
              )}
              {filtrados.map((m, i) => {
                const entrada = m.direcao === 'entrada'
                const cor = entrada ? '#15803d' : '#b91c1c'
                return (
                  <tr key={m.key}
                    onClick={() => setDetalhe(m)}
                    className="cursor-pointer"
                    style={{ borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined, background: 'var(--ac-card)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ac-bg)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ac-card)')}
                  >
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--ac-muted)' }}>{formatarData(m.data)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap"
                        style={{ color: cor, background: entrada ? '#dcfce7' : '#fee2e2' }}>
                        <span aria-hidden style={{ width: 7, height: 7, borderRadius: 9999, background: cor, display: 'inline-block' }} />
                        {entrada ? 'Entrada' : 'Saída'}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--ac-text)' }}>
                      <div className="font-medium">{m.descricao}</div>
                      {m.usuario_nome && (
                        <div className="text-xs mt-0.5" style={{ color: 'var(--ac-muted)' }}>{m.usuario_nome}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--ac-muted)' }}>{m.categoria ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap" style={{ color: 'var(--ac-muted)' }}>
                      {m.forma_pagamento ? (FORMAS_PAGAMENTO[m.forma_pagamento]?.label ?? m.forma_pagamento) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap" style={{ color: cor }}>
                      {entrada ? '+' : '−'} {moedaBR.format(m.valor)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <MovimentacaoDetalheModal
        mov={detalhe}
        onClose={() => setDetalhe(null)}
      />

      <GastoModal
        open={gastoModalOpen}
        onClose={() => setGastoModalOpen(false)}
        editando={null}
        usuarios={usuarios}
        usuarioLogadoId={usuarioLogadoId}
        perm={{ criar: perm.criar, deletar: perm.deletar }}
        onSaved={onSaved}
      />

      <EntradaModal
        open={entradaModalOpen}
        onClose={() => setEntradaModalOpen(false)}
        editando={null}
        usuarios={usuarios}
        usuarioLogadoId={usuarioLogadoId}
        onSaved={onSaved}
      />
    </>
  )
}
