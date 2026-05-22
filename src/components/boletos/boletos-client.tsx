'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { BoletoModal } from './boleto-modal'
import { deletarBoleto, marcarParcela } from '@/lib/actions/boletos'
import {
  statusBoleto,
  totalAbertoBoleto,
  totalPagoBoleto,
  type Boleto,
  type BoletoTipo,
  type Cliente,
  type Fornecedor,
} from '@/types'
import { useErpTabs } from '@/components/layout/erp-tabs'
import { useBoletos } from '@/lib/query/hooks'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }
type UsuarioMin = { id: string; nome: string }

const moedaBR = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const dataBR = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

function formatarData(s: string | null | undefined) {
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

const STATUS_META = {
  pago:    { label: 'Pago',      color: '#15803d', bg: '#dcfce7', border: '#86efac' },
  aberto:  { label: 'Em aberto', color: '#a16207', bg: '#fef9c3', border: '#fde047' },
  vencido: { label: 'Vencido',   color: '#b91c1c', bg: '#fee2e2', border: '#fca5a5' },
} as const

export function BoletosClient({
  boletos: initialBoletos,
  clientes,
  fornecedores,
  usuarios,
  perm,
}: {
  boletos: Boleto[]
  clientes: Cliente[]
  fornecedores: Fornecedor[]
  usuarios: UsuarioMin[]
  perm: Perm
}) {
  const { refreshActiveTab } = useErpTabs()
  const { data: boletos = initialBoletos } = useBoletos(undefined, { initialData: initialBoletos })

  const [tipoAtivo, setTipoAtivo] = useState<BoletoTipo>('saida')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Boleto | null>(null)
  const [deletando, setDeletando] = useState<Boleto | null>(null)
  const [erroDelete, setErroDelete] = useState('')
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'' | 'pago' | 'aberto' | 'vencido'>('')

  const hojeISO = new Date().toISOString().slice(0, 10)

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return boletos
      .filter((b) => b.tipo === tipoAtivo)
      .filter((b) => {
        if (filtroStatus && statusBoleto(b, hojeISO) !== filtroStatus) return false
        if (!q) return true
        return (
          b.contraparte_nome.toLowerCase().includes(q) ||
          (b.numero_documento ?? '').toLowerCase().includes(q) ||
          (b.cnpj_cpf ?? '').toLowerCase().includes(q) ||
          (b.observacao ?? '').toLowerCase().includes(q)
        )
      })
  }, [boletos, tipoAtivo, busca, filtroStatus, hojeISO])

  const totais = useMemo(() => {
    let total = 0, pago = 0, aberto = 0, vencido = 0
    for (const b of filtrados) {
      total += Number(b.valor_total)
      pago += totalPagoBoleto(b)
      const status = statusBoleto(b, hojeISO)
      if (status === 'aberto') aberto += totalAbertoBoleto(b)
      if (status === 'vencido') vencido += totalAbertoBoleto(b)
    }
    return { total, pago, aberto, vencido }
  }, [filtrados, hojeISO])

  function abrirNovo() { setEditando(null); setModalAberto(true) }
  function abrirEditar(b: Boleto) { setEditando(b); setModalAberto(true) }

  async function confirmarDelete() {
    if (!deletando) return
    setErroDelete(''); setLoadingDelete(true)
    try {
      await deletarBoleto(deletando.id)
      setDeletando(null)
      refreshActiveTab()
    } catch (e: unknown) {
      setErroDelete(e instanceof Error ? e.message : 'Erro ao excluir.')
    } finally {
      setLoadingDelete(false)
    }
  }

  async function alternarParcela(parcelaId: string, pago: boolean) {
    try {
      await marcarParcela(parcelaId, !pago)
      refreshActiveTab()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao atualizar parcela.')
    }
  }

  const tituloPagina = tipoAtivo === 'saida' ? 'A pagar' : 'A receber'
  const labelAberto = tipoAtivo === 'saida' ? 'A pagar (em aberto)' : 'A receber (em aberto)'

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6" style={{ borderBottom: '1px solid var(--ac-border)' }}>
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ac-text)' }}>Boletos</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ac-muted)' }}>
            Controle de boletos a pagar e a receber, com parcelas de 1 a 6 vencimentos.
          </p>
        </div>
        {perm.criar && (
          <Button onClick={abrirNovo}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-4">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Novo boleto de {tipoAtivo === 'saida' ? 'saída' : 'entrada'}
          </Button>
        )}
      </div>

      {/* Tabs Entrada/Saida */}
      <div className="px-8 pt-4 flex gap-2 border-b" style={{ borderColor: 'var(--ac-border)' }}>
        {(['saida', 'entrada'] as const).map((t) => {
          const ativo = tipoAtivo === t
          return (
            <button
              key={t}
              onClick={() => setTipoAtivo(t)}
              className="px-4 py-2 text-sm font-semibold transition-colors"
              style={{
                color: ativo ? 'var(--ac-accent)' : 'var(--ac-muted)',
                borderBottom: ativo ? '2px solid var(--ac-accent)' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              {t === 'saida' ? 'Saída (a pagar)' : 'Entrada (a receber)'}
            </button>
          )
        })}
      </div>

      {/* KPIs */}
      <div className="px-8 pt-6 grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="rounded-xl p-4" style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)' }}>
          <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--ac-muted)' }}>{tituloPagina} — total</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--ac-text)' }}>{moedaBR.format(totais.total)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--ac-muted)' }}>{filtrados.length} {filtrados.length === 1 ? 'boleto' : 'boletos'}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--ac-card)', border: '1px solid #86efac' }}>
          <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#15803d' }}>Pago</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--ac-text)' }}>{moedaBR.format(totais.pago)}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--ac-card)', border: '1px solid #fde047' }}>
          <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#a16207' }}>{labelAberto}</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--ac-text)' }}>{moedaBR.format(totais.aberto)}</p>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--ac-card)', border: '1px solid #fca5a5' }}>
          <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#b91c1c' }}>Vencido</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--ac-text)' }}>{moedaBR.format(totais.vencido)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-8 py-4 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5 grow max-w-sm">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Buscar</label>
          <input
            type="text"
            placeholder="Nome, documento, observação..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
            style={inputStyle}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Status</label>
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
            style={{ ...inputStyle, ...selectChevron }}
          >
            <option value="">Todos</option>
            <option value="aberto">Em aberto</option>
            <option value="vencido">Vencido</option>
            <option value="pago">Pago</option>
          </select>
        </div>
      </div>

      {/* Tabela */}
      <div className="px-8 pb-8">
        <div className="rounded-xl overflow-auto" style={{ border: '1px solid var(--ac-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
                {tipoAtivo === 'entrada' && (
                  <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Vendedor</th>
                )}
                {tipoAtivo === 'entrada' && (
                  <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>UN</th>
                )}
                <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                  {tipoAtivo === 'entrada' ? 'Cliente' : 'Fornecedor'}
                </th>
                {tipoAtivo === 'entrada' && (
                  <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>CNPJ/CPF</th>
                )}
                {tipoAtivo === 'entrada' && (
                  <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Nº</th>
                )}
                <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Emitido</th>
                <th className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Total</th>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <th key={n} className="text-center px-2 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                    {n}° venc.
                  </th>
                ))}
                <th className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Pago</th>
                <th className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Aberto</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={tipoAtivo === 'entrada' ? 15 : 11} className="text-center py-12 text-sm" style={{ color: 'var(--ac-muted)' }}>
                    Nenhum boleto registrado neste filtro.
                  </td>
                </tr>
              )}
              {filtrados.map((b, i) => {
                const status = statusBoleto(b, hojeISO)
                const meta = STATUS_META[status]
                const aberto = totalAbertoBoleto(b)
                const pago = totalPagoBoleto(b)
                const parcelasPorNumero = new Map(b.parcelas.map((p) => [p.numero, p]))
                return (
                  <tr key={b.id}
                    style={{ borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined, background: 'var(--ac-card)' }}
                  >
                    {tipoAtivo === 'entrada' && (
                      <td className="px-3 py-2 whitespace-nowrap text-xs" style={{ color: 'var(--ac-muted)' }}>
                        {b.vendedor?.nome ?? '—'}
                      </td>
                    )}
                    {tipoAtivo === 'entrada' && (
                      <td className="px-3 py-2 whitespace-nowrap text-xs" style={{ color: 'var(--ac-muted)' }}>
                        {b.unidades ?? '—'}
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <span className="font-medium" style={{ color: 'var(--ac-text)' }}>{b.contraparte_nome}</span>
                        <span className="inline-flex items-center self-start mt-1 px-2 py-0.5 rounded text-[10px] font-semibold"
                          style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}>
                          {meta.label}
                        </span>
                      </div>
                    </td>
                    {tipoAtivo === 'entrada' && (
                      <td className="px-3 py-2 whitespace-nowrap text-xs" style={{ color: 'var(--ac-muted)' }}>
                        {b.cnpj_cpf ?? '—'}
                      </td>
                    )}
                    {tipoAtivo === 'entrada' && (
                      <td className="px-3 py-2 whitespace-nowrap text-xs" style={{ color: 'var(--ac-muted)' }}>
                        {b.numero_documento ?? '—'}
                      </td>
                    )}
                    <td className="px-3 py-2 whitespace-nowrap text-xs" style={{ color: 'var(--ac-muted)' }}>
                      {formatarData(b.emitido_em)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap" style={{ color: 'var(--ac-text)' }}>
                      {moedaBR.format(Number(b.valor_total))}
                    </td>
                    {[1, 2, 3, 4, 5, 6].map((n) => {
                      const p = parcelasPorNumero.get(n)
                      if (!p) return <td key={n} className="px-2 py-2 text-center text-xs" style={{ color: 'var(--ac-muted)' }}>—</td>
                      const pPago = !!p.pago_em
                      const vencido = !pPago && p.vencimento < hojeISO
                      return (
                        <td key={n} className="px-2 py-2 text-center">
                          <button
                            disabled={!perm.editar}
                            onClick={() => alternarParcela(p.id, pPago)}
                            title={pPago ? `Pago em ${formatarData(p.pago_em)} — clique para desmarcar` : `Vence em ${formatarData(p.vencimento)} — clique para marcar como pago`}
                            className="rounded px-1.5 py-1 text-[11px] font-mono whitespace-nowrap transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
                            style={{
                              background: pPago ? '#dcfce7' : vencido ? '#fee2e2' : 'var(--ac-bg)',
                              color: pPago ? '#15803d' : vencido ? '#b91c1c' : 'var(--ac-text)',
                              border: `1px solid ${pPago ? '#86efac' : vencido ? '#fca5a5' : 'var(--ac-border)'}`,
                              cursor: perm.editar ? 'pointer' : 'default',
                            }}
                          >
                            {formatarData(p.vencimento)}
                          </button>
                        </td>
                      )
                    })}
                    <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: '#15803d' }}>
                      {moedaBR.format(pago)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: aberto > 0 ? '#b91c1c' : 'var(--ac-muted)' }}>
                      {moedaBR.format(aberto)}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {perm.editar && (
                          <button onClick={() => abrirEditar(b)} className="p-1.5 rounded-lg" style={{ color: 'var(--ac-muted)' }} title="Editar">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}
                        {perm.deletar && (
                          <button onClick={() => { setDeletando(b); setErroDelete('') }} className="p-1.5 rounded-lg" style={{ color: 'var(--ac-muted)' }} title="Excluir">
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

      <BoletoModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        editando={editando}
        tipoInicial={tipoAtivo}
        clientes={clientes}
        fornecedores={fornecedores}
        usuarios={usuarios}
        onSaved={refreshActiveTab}
      />

      <Modal open={!!deletando} onClose={() => setDeletando(null)} title="Excluir boleto">
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--ac-text)' }}>
            Tem certeza que deseja excluir o boleto de{' '}
            <strong>{deletando?.contraparte_nome}</strong> ({moedaBR.format(Number(deletando?.valor_total ?? 0))})?
            As parcelas também serão excluídas. Esta ação não pode ser desfeita.
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
