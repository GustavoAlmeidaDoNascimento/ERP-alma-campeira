'use client'

import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { BoletoModal } from './boleto-modal'
import { deletarBoleto, marcarParcela } from '@/lib/actions/boletos'
import {
  codigoBoleto,
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
import { qk } from '@/lib/query/keys'
import { DateInputBR } from '@/components/ui/date-input-br'
import { useResourceRefresh } from '@/lib/realtime/client'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function ultimoDiaDoMes(ano: number, mes1a12: number) {
  return new Date(ano, mes1a12, 0).getDate()
}

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
  const { refreshResources } = useResourceRefresh()
  const queryClient = useQueryClient()
  const { data: boletos = initialBoletos } = useBoletos(undefined, { initialData: initialBoletos })
  const [marcandoIds, setMarcandoIds] = useState<Set<string>>(new Set())

  const [tipoAtivo, setTipoAtivo] = useState<BoletoTipo>('saida')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Boleto | null>(null)
  const [deletando, setDeletando] = useState<Boleto | null>(null)
  const [erroDelete, setErroDelete] = useState('')
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<'' | 'pago' | 'aberto' | 'vencido'>('')
  const [dataDe, setDataDe] = useState('')
  const [dataAte, setDataAte] = useState('')
  const [filtroMes, setFiltroMes] = useState<string>('')
  const [filtroAno, setFiltroAno] = useState<string>('')

  const hojeISO = new Date().toISOString().slice(0, 10)

  const anosDisponiveis = useMemo(() => {
    const set = new Set<number>()
    for (const b of boletos) {
      if (b.emitido_em) {
        const y = Number(b.emitido_em.slice(0, 4))
        if (y) set.add(y)
      }
    }
    set.add(new Date().getFullYear())
    return Array.from(set).sort((a, b) => b - a)
  }, [boletos])

  function aplicarMesAno(mes: string, ano: string) {
    setFiltroMes(mes)
    setFiltroAno(ano)
    if (mes && ano) {
      const m = Number(mes)
      const a = Number(ano)
      const ultDia = ultimoDiaDoMes(a, m)
      const mm = String(m).padStart(2, '0')
      setDataDe(`${a}-${mm}-01`)
      setDataAte(`${a}-${mm}-${String(ultDia).padStart(2, '0')}`)
    } else if (ano && !mes) {
      setDataDe(`${ano}-01-01`)
      setDataAte(`${ano}-12-31`)
    } else if (mes && !ano) {
      setDataDe('')
      setDataAte('')
    } else {
      setDataDe('')
      setDataAte('')
    }
  }

  function limparPeriodo() {
    setFiltroMes('')
    setFiltroAno('')
    setDataDe('')
    setDataAte('')
  }

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return boletos
      .filter((b) => b.tipo === tipoAtivo)
      .filter((b) => {
        if (filtroStatus && statusBoleto(b, hojeISO) !== filtroStatus) return false
        const emitido = (b.emitido_em ?? '').slice(0, 10)
        if (dataDe && (!emitido || emitido < dataDe)) return false
        if (dataAte && (!emitido || emitido > dataAte)) return false
        if (!q) return true
        return (
          codigoBoleto(b).toLowerCase().includes(q) ||
          b.contraparte_nome.toLowerCase().includes(q) ||
          (b.numero_documento ?? '').toLowerCase().includes(q) ||
          (b.cnpj_cpf ?? '').toLowerCase().includes(q) ||
          (b.observacao ?? '').toLowerCase().includes(q)
        )
      })
  }, [boletos, tipoAtivo, busca, filtroStatus, hojeISO, dataDe, dataAte])

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

  async function alternarParcela(parcelaId: string, pagoAtual: boolean, valor: number) {
    if (marcandoIds.has(parcelaId)) return // anti-double-click
    const novoPago = !pagoAtual
    const hojeData = new Date().toISOString().slice(0, 10)

    // Snapshot pra rollback
    const queryKey = qk.boletos.list()
    const snapshot = queryClient.getQueryData<Boleto[]>(queryKey)

    // Update otimista — UI atualiza instantâneo
    queryClient.setQueryData<Boleto[]>(queryKey, (prev) => {
      if (!prev) return prev
      return prev.map((b) => ({
        ...b,
        parcelas: b.parcelas.map((p) =>
          p.id === parcelaId
            ? { ...p, pago_em: novoPago ? hojeData : null, valor_pago: novoPago ? valor : null }
            : p,
        ),
      }))
    })

    setMarcandoIds((prev) => new Set(prev).add(parcelaId))
    try {
      await marcarParcela(parcelaId, novoPago, novoPago ? { valor_pago: valor } : undefined)
      // Atualiza a aba atual e sincroniza outras abas imediatamente.
      void refreshResources(['boletos'])
    } catch (e: unknown) {
      // Rollback se falhar
      if (snapshot) queryClient.setQueryData(queryKey, snapshot)
      alert(e instanceof Error ? e.message : 'Erro ao atualizar parcela.')
    } finally {
      setMarcandoIds((prev) => {
        const n = new Set(prev)
        n.delete(parcelaId)
        return n
      })
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
            Controle de boletos a pagar e a receber, com parcelas em múltiplos vencimentos.
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
      <div className="px-8 pt-6 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)' }}>
          <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--ac-muted)' }}>{tituloPagina} — total</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--ac-text)' }}>{moedaBR.format(totais.total)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--ac-muted)' }}>{filtrados.length} {filtrados.length === 1 ? (tipoAtivo === 'saida' ? 'lançamento' : 'boleto') : (tipoAtivo === 'saida' ? 'lançamentos' : 'boletos')}</p>
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
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Mês</label>
          <select
            value={filtroMes}
            onChange={(e) => aplicarMesAno(e.target.value, filtroAno)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
            style={{ ...inputStyle, ...selectChevron, minWidth: '140px' }}
          >
            <option value="">Todos</option>
            {MESES.map((nome, i) => (
              <option key={i + 1} value={String(i + 1)}>{nome}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Ano</label>
          <select
            value={filtroAno}
            onChange={(e) => aplicarMesAno(filtroMes, e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
            style={{ ...inputStyle, ...selectChevron, minWidth: '110px' }}
          >
            <option value="">Todos</option>
            {anosDisponiveis.map((a) => (
              <option key={a} value={String(a)}>{a}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>De</label>
          <DateInputBR
            value={dataDe}
            onChange={(iso) => { setDataDe(iso); setFiltroMes(''); setFiltroAno('') }}
            className="rounded-lg px-3 py-2.5 text-sm outline-none"
            style={{ ...inputStyle, width: '140px' }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Até</label>
          <DateInputBR
            value={dataAte}
            onChange={(iso) => { setDataAte(iso); setFiltroMes(''); setFiltroAno('') }}
            className="rounded-lg px-3 py-2.5 text-sm outline-none"
            style={{ ...inputStyle, width: '140px' }}
          />
        </div>
        {(dataDe || dataAte || filtroMes || filtroAno) && (
          <button
            type="button"
            onClick={limparPeriodo}
            className="text-xs font-semibold px-3 py-2.5 rounded-lg"
            style={{ color: 'var(--ac-muted)', border: '1px solid var(--ac-border)', background: 'var(--ac-card)' }}
            title="Limpar período"
          >
            Limpar período
          </button>
        )}
      </div>

      {/* Tabela */}
      <div className="px-8 pb-8">
        <div className="rounded-xl overflow-auto" style={{ border: '1px solid var(--ac-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
                <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Código</th>
                {tipoAtivo === 'entrada' && (
                  <>
                    <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Vendedor</th>
                    <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>UN</th>
                  </>
                )}
                <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                  {tipoAtivo === 'entrada' ? 'Cliente' : 'Fornecedor'}
                </th>
                {tipoAtivo === 'entrada' && (
                  <>
                    <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>CNPJ/CPF</th>
                    <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Nº</th>
                  </>
                )}
                <th className="text-left px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                  {tipoAtivo === 'entrada' ? 'Emitido' : 'Data'}
                </th>
                <th className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                  {tipoAtivo === 'entrada' ? 'Total' : 'Valor'}
                </th>
                {tipoAtivo === 'entrada' ? (
                  [1, 2, 3, 4, 5, 6].map((n) => (
                    <th key={n} className="text-center px-2 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                      {n}° venc.
                    </th>
                  ))
                ) : (
                  <th className="text-center px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                    Parcelas pagas
                  </th>
                )}
                <th className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Pago</th>
                <th className="text-right px-3 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Aberto</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={tipoAtivo === 'entrada' ? 16 : 8} className="text-center py-12 text-sm" style={{ color: 'var(--ac-muted)' }}>
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
                const totalParcelas = b.parcelas.length
                const parcelasPagas = b.parcelas.filter((p) => !!p.pago_em).length
                const todasPagas = totalParcelas > 0 && parcelasPagas === totalParcelas
                const bgLinha = 'var(--ac-card)'
                return (
                  <tr key={b.id}
                    onClick={() => perm.editar && abrirEditar(b)}
                    role={perm.editar ? 'button' : undefined}
                    tabIndex={perm.editar ? 0 : undefined}
                    onKeyDown={perm.editar ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        abrirEditar(b)
                      }
                    } : undefined}
                    className={perm.editar ? 'cursor-pointer' : undefined}
                    style={{ borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined, background: bgLinha }}
                    onMouseEnter={perm.editar ? (e) => { e.currentTarget.style.background = 'var(--ac-bg)' } : undefined}
                    onMouseLeave={perm.editar ? (e) => { e.currentTarget.style.background = bgLinha } : undefined}
                  >
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="font-mono text-xs font-semibold" style={{ color: 'var(--ac-accent)' }}>
                        {codigoBoleto(b)}
                      </span>
                    </td>
                    {tipoAtivo === 'entrada' && (
                      <>
                        <td className="px-3 py-2 whitespace-nowrap text-xs" style={{ color: 'var(--ac-muted)' }}>
                          {b.vendedor?.nome ?? '—'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs" style={{ color: 'var(--ac-muted)' }}>
                          {b.unidades ?? '—'}
                        </td>
                      </>
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
                      <>
                        <td className="px-3 py-2 whitespace-nowrap text-xs" style={{ color: 'var(--ac-muted)' }}>
                          {b.cnpj_cpf ?? '—'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs" style={{ color: 'var(--ac-muted)' }}>
                          {b.numero_documento ?? '—'}
                        </td>
                      </>
                    )}
                    <td className="px-3 py-2 whitespace-nowrap text-xs" style={{ color: 'var(--ac-muted)' }}>
                      {formatarData(b.emitido_em)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap" style={{ color: 'var(--ac-text)' }}>
                      {moedaBR.format(Number(b.valor_total))}
                    </td>
                    {tipoAtivo === 'entrada' && [1, 2, 3, 4, 5, 6].map((n) => {
                      const p = parcelasPorNumero.get(n)
                      if (!p) return <td key={n} className="px-2 py-2 text-center text-xs" style={{ color: 'var(--ac-muted)' }}>—</td>
                      const pPago = !!p.pago_em
                      const vencido = !pPago && p.vencimento < hojeISO
                      const marcando = marcandoIds.has(p.id)
                      return (
                        <td key={n} className="px-2 py-2">
                          <div className="flex flex-col items-center gap-1">
                            <span
                              className="rounded px-1.5 py-0.5 text-[11px] font-mono whitespace-nowrap"
                              style={{
                                background: pPago ? '#dcfce7' : vencido ? '#fee2e2' : 'var(--ac-bg)',
                                color: pPago ? '#15803d' : vencido ? '#b91c1c' : 'var(--ac-text)',
                                border: `1px solid ${pPago ? '#86efac' : vencido ? '#fca5a5' : 'var(--ac-border)'}`,
                              }}
                            >
                              {formatarData(p.vencimento)}
                            </span>
                            <button
                              type="button"
                              disabled={!perm.editar}
                              onClick={(e) => { e.stopPropagation(); alternarParcela(p.id, pPago, Number(p.valor)) }}
                              title={pPago ? `Pago em ${formatarData(p.pago_em)} — clique para desmarcar` : `Marcar parcela ${n} como paga`}
                              className={`inline-flex items-center justify-center rounded size-5 transition-colors ${marcando ? 'animate-pulse' : ''}`}
                              style={{
                                background: pPago ? '#16a34a' : 'transparent',
                                border: `1.5px solid ${pPago ? '#16a34a' : vencido ? '#fca5a5' : 'var(--ac-border)'}`,
                                cursor: perm.editar ? 'pointer' : 'default',
                                boxShadow: marcando ? '0 0 0 2px rgba(22,163,74,0.30)' : 'none',
                              }}
                              aria-label={pPago ? 'Pago — desmarcar' : 'Marcar como pago'}
                              aria-busy={marcando}
                            >
                              {pPago && (
                                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="size-3.5">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </td>
                      )
                    })}
                    {tipoAtivo === 'saida' && (
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        <span
                          className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold font-mono"
                          title={`${parcelasPagas} de ${totalParcelas} parcelas pagas`}
                          style={{
                            background: todasPagas ? '#dcfce7' : 'var(--ac-bg)',
                            color: todasPagas ? '#15803d' : 'var(--ac-text)',
                            border: `1px solid ${todasPagas ? '#86efac' : 'var(--ac-border)'}`,
                          }}
                        >
                          {parcelasPagas}/{totalParcelas}
                        </span>
                      </td>
                    )}
                    <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: '#15803d' }}>
                      {moedaBR.format(pago)}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap" style={{ color: aberto > 0 ? '#b91c1c' : 'var(--ac-muted)' }}>
                      {moedaBR.format(aberto)}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
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
