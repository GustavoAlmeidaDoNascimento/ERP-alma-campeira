'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { OrcamentoFormModal } from './orcamento-form-modal'
import { OrcamentoDetalheModal } from './orcamento-detalhe-modal'
import { getOrcamentoDetalhe, getOrcamentos } from '@/lib/actions/orcamentos'
import { useErpTabs } from '@/components/layout/erp-tabs'
import { useOrcamentos } from '@/lib/query/hooks'
import type { Orcamento, Cliente, Faca } from '@/types'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }

type Props = {
  orcamentos: Orcamento[]
  clientes: Cliente[]
  facas: Faca[]
  usuarios: { id: string; nome: string }[]
  perm: Perm
  /** Permissão de criar venda — necessária para "Transformar em venda". */
  permVendasCriar: boolean
  usuarioLogadoId: string | null
}

const STATUS_TABS: { value: 'todos' | 'pendentes' | 'convertidos'; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'pendentes', label: 'Pendentes' },
  { value: 'convertidos', label: 'Convertidos' },
]

function normalizeDate(date: string) {
  const d = new Date(`${date}T12:00:00`)
  d.setHours(0, 0, 0, 0)
  return d
}

function parseStatusParam(value: string | null): 'todos' | 'pendentes' | 'convertidos' {
  if (value === 'pendentes' || value === 'convertidos') return value
  return 'todos'
}

function isFullDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
}

export function OrcamentosClient({
  orcamentos: orcamentosIniciais,
  clientes,
  facas,
  usuarios,
  perm,
  permVendasCriar,
  usuarioLogadoId,
}: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const statusParam = searchParams.get('status')
  const vendedorParam = searchParams.get('vendedor')
  const clienteParam = searchParams.get('cliente')
  const valorMinParam = searchParams.get('valor_min')
  const valorMaxParam = searchParams.get('valor_max')
  const dataInicioParam = searchParams.get('data_inicio')
  const dataFimParam = searchParams.get('data_fim')
  const isOrcamentosRoute = pathname === '/orcamentos'

  const [orcamentos, setOrcamentos] = useState<Orcamento[]>(orcamentosIniciais)
  const { data: orcamentosHook } = useOrcamentos({ initialData: orcamentosIniciais })
  useEffect(() => {
    if (orcamentosHook) setOrcamentos(orcamentosHook)
  }, [orcamentosHook])
  const { refreshActiveTab, refreshTab } = useErpTabs()
  const [formAberto, setFormAberto] = useState(false)
  const [editando, setEditando] = useState<Orcamento | null>(null)
  const [detalhe, setDetalhe] = useState<Orcamento | null>(null)
  const [detalheCarregando, setDetalheCarregando] = useState(false)
  const [detalheErroCarregar, setDetalheErroCarregar] = useState<string | null>(null)
  const detalheFetchSeq = useRef(0)

  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendentes' | 'convertidos'>(() => parseStatusParam(statusParam))
  const [filtroVendedor, setFiltroVendedor] = useState(() => vendedorParam ?? '')
  const [filtroCliente, setFiltroCliente] = useState(() => clienteParam ?? '')
  const [valorMin, setValorMin] = useState(() => valorMinParam ?? '')
  const [valorMax, setValorMax] = useState(() => valorMaxParam ?? '')
  const [dataInicio, setDataInicio] = useState(() => dataInicioParam ?? '')
  const [dataFim, setDataFim] = useState(() => dataFimParam ?? '')

  type OrdemColuna = 'cliente' | 'vendedor' | 'data' | 'frete' | 'total'
  const [ordenacao, setOrdenacao] = useState<{ coluna: OrdemColuna | null; dir: 'asc' | 'desc' }>({
    coluna: 'data',
    dir: 'desc',
  })

  function toggleOrdem(coluna: OrdemColuna) {
    setOrdenacao((prev) => {
      if (prev.coluna === coluna) return { coluna, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      return { coluna, dir: 'asc' }
    })
  }

  // Sincroniza quando TabPane re-busca dados (ex: ao reabrir a aba)
  useEffect(() => {
    setOrcamentos(orcamentosIniciais)
  }, [orcamentosIniciais])

  useEffect(() => {
    if (!isOrcamentosRoute) return
    setFiltroStatus(parseStatusParam(statusParam))
    setFiltroVendedor(vendedorParam ?? '')
    setFiltroCliente(clienteParam ?? '')
    setValorMin(valorMinParam ?? '')
    setValorMax(valorMaxParam ?? '')
    setDataInicio(dataInicioParam ?? '')
    setDataFim(dataFimParam ?? '')
  }, [isOrcamentosRoute, statusParam, vendedorParam, clienteParam, valorMinParam, valorMaxParam, dataInicioParam, dataFimParam])

  useEffect(() => {
    if (!isOrcamentosRoute) return
    const nextParams = new URLSearchParams(searchParams.toString())
    const upsert = (key: string, value: string) => {
      if (value.trim()) nextParams.set(key, value.trim())
      else nextParams.delete(key)
    }
    upsert('status', filtroStatus === 'todos' ? '' : filtroStatus)
    upsert('vendedor', filtroVendedor)
    upsert('cliente', filtroCliente)
    upsert('valor_min', valorMin)
    upsert('valor_max', valorMax)
    upsert('data_inicio', isFullDate(dataInicio) ? dataInicio : '')
    upsert('data_fim', isFullDate(dataFim) ? dataFim : '')

    const query = nextParams.toString()
    if (query === searchParams.toString()) return
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [isOrcamentosRoute, pathname, router, searchParams, filtroStatus, filtroVendedor, filtroCliente, valorMin, valorMax, dataInicio, dataFim])

  const filtrados = useMemo(() => {
    const vendedorNorm = filtroVendedor.trim().toLowerCase()
    const clienteNorm = filtroCliente.trim().toLowerCase()
    const valorMinNum = valorMin.trim() ? Number(valorMin) : null
    const valorMaxNum = valorMax.trim() ? Number(valorMax) : null
    const dataInicioNorm = dataInicio ? normalizeDate(dataInicio) : null
    const dataFimNorm = dataFim ? normalizeDate(dataFim) : null

    return orcamentos.filter((o) => {
      const matchStatus =
        filtroStatus === 'todos' ||
        (filtroStatus === 'convertidos' ? !!o.convertido_pedido_id : !o.convertido_pedido_id)
      const matchVendedor = !vendedorNorm || o.vendedor?.nome?.toLowerCase().includes(vendedorNorm)
      const matchCliente = !clienteNorm || o.cliente?.nome?.toLowerCase().includes(clienteNorm)
      const total = o.valor_total ?? 0
      const matchValorMin = valorMinNum == null || (!Number.isNaN(valorMinNum) && total >= valorMinNum)
      const matchValorMax = valorMaxNum == null || (!Number.isNaN(valorMaxNum) && total <= valorMaxNum)
      const dataOrc = normalizeDate(o.data_orcamento)
      const matchDataInicio = !dataInicioNorm || dataOrc >= dataInicioNorm
      const matchDataFim = !dataFimNorm || dataOrc <= dataFimNorm

      return matchStatus && matchVendedor && matchCliente && matchValorMin && matchValorMax && matchDataInicio && matchDataFim
    })
  }, [orcamentos, filtroStatus, filtroVendedor, filtroCliente, valorMin, valorMax, dataInicio, dataFim])

  const ordenados = useMemo(() => {
    const ordemColuna = ordenacao.coluna
    if (!ordemColuna) return filtrados
    const dir = ordenacao.dir === 'asc' ? 1 : -1
    return [...filtrados].sort((a, b) => {
      switch (ordemColuna) {
        case 'cliente': {
          const na = a.cliente?.nome ?? ''
          const nb = b.cliente?.nome ?? ''
          return na.localeCompare(nb, 'pt-BR', { sensitivity: 'base' }) * dir
        }
        case 'vendedor': {
          const na = a.vendedor?.nome ?? ''
          const nb = b.vendedor?.nome ?? ''
          return na.localeCompare(nb, 'pt-BR', { sensitivity: 'base' }) * dir
        }
        case 'data':
          return (a.data_orcamento < b.data_orcamento ? -1 : a.data_orcamento > b.data_orcamento ? 1 : 0) * dir
        case 'frete':
          return ((a.frete ?? 0) - (b.frete ?? 0)) * dir
        case 'total':
          return ((a.valor_total ?? 0) - (b.valor_total ?? 0)) * dir
        default:
          return 0
      }
    })
  }, [filtrados, ordenacao])

  function abrirNovo() { setEditando(null); setFormAberto(true) }
  function abrirEditar(o: Orcamento) { setEditando(o); setFormAberto(true) }

  const abrirDetalhe = useCallback((o: Orcamento) => {
    setDetalhe(o)
    setDetalheCarregando(true)
    setDetalheErroCarregar(null)
    const seq = ++detalheFetchSeq.current
    void getOrcamentoDetalhe(o.id)
      .then((completo) => {
        if (detalheFetchSeq.current !== seq) return
        setDetalhe(completo)
        setDetalheCarregando(false)
      })
      .catch((e: unknown) => {
        if (detalheFetchSeq.current !== seq) return
        setDetalheCarregando(false)
        setDetalheErroCarregar(e instanceof Error ? e.message : 'Erro ao carregar o orçamento.')
      })
  }, [])

  async function handleSaved() {
    try {
      const fresh = await getOrcamentos()
      setOrcamentos(fresh)
    } catch {
      // mantém otimismo
    } finally {
      refreshActiveTab()
    }
  }

  async function handleConvertido() {
    // Atualiza orçamentos (campo convertido_pedido_id) e a aba de vendas (novo pedido).
    try {
      const fresh = await getOrcamentos()
      setOrcamentos(fresh)
    } catch {
      // ignora
    } finally {
      refreshTab('/vendas')
      refreshActiveTab()
    }
  }

  function handleDeletado(id: string) {
    setOrcamentos((prev) => prev.filter((o) => o.id !== id))
    refreshActiveTab()
  }

  // Counts pra badges das tabs
  const counts = useMemo(() => {
    const c = { todos: orcamentos.length, pendentes: 0, convertidos: 0 }
    for (const o of orcamentos) {
      if (o.convertido_pedido_id) c.convertidos += 1
      else c.pendentes += 1
    }
    return c
  }, [orcamentos])

  const temFiltrosAtivos =
    filtroStatus !== 'todos' ||
    !!filtroVendedor.trim() ||
    !!filtroCliente.trim() ||
    !!valorMin.trim() ||
    !!valorMax.trim() ||
    !!dataInicio ||
    !!dataFim

  function limparFiltros() {
    setFiltroStatus('todos')
    setFiltroVendedor('')
    setFiltroCliente('')
    setValorMin('')
    setValorMax('')
    setDataInicio('')
    setDataFim('')
  }

  const detalhePerm = {
    editar: perm.editar,
    deletar: perm.deletar,
    converterEmVenda: perm.editar && permVendasCriar,
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6" style={{ borderBottom: '1px solid var(--ac-border)' }}>
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ac-text)' }}>Orçamentos</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ac-muted)' }}>
            {counts.pendentes} pendentes · {counts.convertidos} convertidos em venda
          </p>
        </div>
        {perm.criar && (
          <Button onClick={abrirNovo}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-4">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Novo orçamento
          </Button>
        )}
      </div>

      {/* Tabs status */}
      <div className="px-8 pt-4 pb-2 flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {STATUS_TABS.map((tab) => {
            const ativo = filtroStatus === tab.value
            return (
              <button
                key={tab.value}
                onClick={() => setFiltroStatus(tab.value)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  color: ativo ? 'var(--ac-accent)' : 'var(--ac-muted)',
                  background: ativo ? 'color-mix(in srgb, var(--ac-accent) 10%, transparent)' : 'transparent',
                  border: `1px solid ${ativo ? 'var(--ac-accent)' : 'transparent'}`,
                }}
              >
                {tab.label}
                {(counts[tab.value] ?? 0) > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[10px]"
                    style={{ background: ativo ? 'rgba(0,0,0,0.15)' : 'var(--ac-border)', color: ativo ? 'inherit' : 'var(--ac-muted)' }}
                  >
                    {counts[tab.value]}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Filtros */}
      <div className="px-8 pb-2 flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Vendedor"
          value={filtroVendedor}
          onChange={(e) => setFiltroVendedor(e.target.value)}
          list="vendedores-orcamentos"
          className="px-3 py-2 rounded-lg text-sm outline-none transition-all"
          style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)', color: 'var(--ac-text)', width: '180px' }}
        />
        <datalist id="vendedores-orcamentos">
          {usuarios.map((u) => (<option key={u.id} value={u.nome} />))}
        </datalist>

        <input
          type="text"
          placeholder="Cliente"
          value={filtroCliente}
          onChange={(e) => setFiltroCliente(e.target.value)}
          list="clientes-orcamentos"
          className="px-3 py-2 rounded-lg text-sm outline-none transition-all"
          style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)', color: 'var(--ac-text)', width: '220px' }}
        />
        <datalist id="clientes-orcamentos">
          {clientes.map((c) => (<option key={c.id} value={c.nome} />))}
        </datalist>

        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Valor mín."
          value={valorMin}
          onChange={(e) => setValorMin(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none transition-all"
          style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)', color: 'var(--ac-text)', width: '130px' }}
        />
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Valor máx."
          value={valorMax}
          onChange={(e) => setValorMax(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none transition-all"
          style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)', color: 'var(--ac-text)', width: '130px' }}
        />
        <input
          type="date"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none transition-all"
          style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)', color: 'var(--ac-text)' }}
        />
        <input
          type="date"
          value={dataFim}
          onChange={(e) => setDataFim(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none transition-all"
          style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)', color: 'var(--ac-text)' }}
        />

        {temFiltrosAtivos && (
          <Button variant="secondary" onClick={limparFiltros}>Limpar filtros</Button>
        )}
      </div>

      {/* Tabela */}
      <div className="px-8 pb-8 pt-2">
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Código</th>
                {(['cliente', 'vendedor', 'data'] as const).map((col) => (
                  <th key={col}
                    onClick={() => toggleOrdem(col)}
                    className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide select-none cursor-pointer"
                    style={{ color: ordenacao.coluna === col ? 'var(--ac-accent)' : 'var(--ac-muted)', whiteSpace: 'nowrap' }}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col === 'cliente' ? 'Cliente' : col === 'vendedor' ? 'Vendedor' : 'Data'}
                      <span style={{ opacity: ordenacao.coluna === col ? 1 : 0.3, fontSize: '10px' }}>
                        {ordenacao.coluna === col ? (ordenacao.dir === 'asc' ? '▲' : '▼') : '▲'}
                      </span>
                    </span>
                  </th>
                ))}
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Status</th>
                {(['frete', 'total'] as const).map((col) => (
                  <th key={col}
                    onClick={() => toggleOrdem(col)}
                    className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide select-none cursor-pointer"
                    style={{ color: ordenacao.coluna === col ? 'var(--ac-accent)' : 'var(--ac-muted)', whiteSpace: 'nowrap' }}
                  >
                    <span className="inline-flex items-center justify-end gap-1">
                      {col === 'frete' ? 'Frete' : 'Total'}
                      <span style={{ opacity: ordenacao.coluna === col ? 1 : 0.3, fontSize: '10px' }}>
                        {ordenacao.coluna === col ? (ordenacao.dir === 'asc' ? '▲' : '▼') : '▲'}
                      </span>
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {ordenados.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm" style={{ color: 'var(--ac-muted)' }}>
                    {temFiltrosAtivos ? 'Nenhum orçamento para esse filtro.' : 'Nenhum orçamento cadastrado ainda.'}
                  </td>
                </tr>
              )}
              {ordenados.map((o, i) => {
                const convertido = !!o.convertido_pedido_id
                const podeEditar = !convertido && perm.editar
                return (
                  <tr key={o.id}
                    onClick={() => abrirDetalhe(o)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrirDetalhe(o) } }}
                    style={{
                      borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined,
                      background: 'var(--ac-card)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ac-bg)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ac-card)')}
                  >
                    <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: 'var(--ac-muted)' }}>
                      {o.codigo}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--ac-text)' }}>
                      {o.cliente ? (
                        <div>
                          <span className="font-medium">{o.cliente.nome}</span>
                          <span className="ml-2 text-xs" style={{ color: 'var(--ac-muted)' }}>{o.cliente.tipo}</span>
                        </div>
                      ) : (
                        <span style={{ color: 'var(--ac-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--ac-text)' }}>
                      {o.vendedor ? o.vendedor.nome : <span style={{ color: 'var(--ac-muted)' }}>—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--ac-muted)' }}>
                      {new Date(o.data_orcamento + 'T12:00:00').toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3">
                      {convertido ? (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                          style={{ color: '#6b21a8', background: '#f3e8ff', border: '1px solid #e9d5ff' }}
                        >
                          Convertido
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                          style={{ color: '#1d4ed8', background: '#dbeafe', border: '1px solid #bfdbfe' }}
                        >
                          Pendente
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-sm" style={{ color: (o.frete ?? 0) > 0 ? 'var(--ac-text)' : 'var(--ac-muted)' }}>
                      {(o.frete ?? 0) > 0
                        ? (o.frete ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: 'var(--ac-text)' }}>
                      {(o.valor_total ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {podeEditar && (
                          <button
                            onClick={(e) => { e.stopPropagation(); abrirEditar(o) }}
                            className="p-1.5 rounded-lg transition-colors"
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
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <OrcamentoFormModal
        open={formAberto}
        onClose={() => setFormAberto(false)}
        editando={editando}
        clientes={clientes}
        facas={facas}
        usuarios={usuarios}
        usuarioLogadoId={usuarioLogadoId}
        onSaved={handleSaved}
      />

      <OrcamentoDetalheModal
        orcamento={detalhe}
        carregando={detalheCarregando}
        erroCarregar={detalheErroCarregar}
        onClose={() => {
          detalheFetchSeq.current += 1
          setDetalhe(null)
          setDetalheCarregando(false)
          setDetalheErroCarregar(null)
        }}
        onEditar={(o) => {
          detalheFetchSeq.current += 1
          setDetalhe(null)
          setDetalheCarregando(false)
          setDetalheErroCarregar(null)
          abrirEditar(o)
        }}
        onConvertido={handleConvertido}
        onDeletado={handleDeletado}
        perm={detalhePerm}
      />
    </>
  )
}
