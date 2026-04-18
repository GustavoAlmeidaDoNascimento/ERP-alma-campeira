'use client'

import { useCallback, useState, useTransition } from 'react'
import { VendasMetricsView } from './vendas-metrics'
import { EstoqueMetricsView } from './estoque-metrics'
import {
  getMetricasVendas,
  getMetricasEstoque,
  type MetricasVendasData,
  type MetricasEstoqueData,
} from '@/lib/actions/metricas'
import { type DateRange } from '@/lib/metricas-periodos'

export type MetricasClientProps = {
  vendasData: MetricasVendasData
  estoqueData: MetricasEstoqueData
}

type PainelId = 'vendas' | 'estoque'

export function MetricasClient({ vendasData: vendasInitial, estoqueData: estoqueInitial }: MetricasClientProps) {
  const initialRange: DateRange =
    vendasInitial.dateRange ??
    estoqueInitial.dateRange ??
    (() => {
      const ate = new Date()
      const desde = new Date()
      desde.setDate(desde.getDate() - 30)
      return { desde: desde.toISOString().split('T')[0], ate: ate.toISOString().split('T')[0] }
    })()

  const [desde, setDesde] = useState(initialRange.desde)
  const [ate, setAte] = useState(initialRange.ate)
  const [vData, setVData] = useState(vendasInitial)
  const [eData, setEData] = useState(estoqueInitial)
  const [painel, setPainel] = useState<PainelId>('vendas')
  const [isPending, startTransition] = useTransition()

  const fetchWithRange = useCallback((range: DateRange) => {
    startTransition(async () => {
      const [v, e] = await Promise.all([getMetricasVendas(range), getMetricasEstoque(range)])
      setVData(v)
      setEData(e)
    })
  }, [])

  function handleDesdeChange(value: string) {
    setDesde(value)
    if (!value || !ate || value > ate) return
    fetchWithRange({ desde: value, ate })
  }

  function handleAteChange(value: string) {
    setAte(value)
    if (!value || !desde || desde > value) return
    fetchWithRange({ desde, ate: value })
  }

  const kpiV = vData.kpi
  const kpiE = eData.kpi
  const criticosE = kpiE.facasCriticas + kpiE.mpCriticas

  return (
    <div className="w-full min-w-0 max-w-full overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 space-y-5 mx-auto">
      <header className="space-y-2 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ac-accent)' }}>
          Relatórios
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--ac-text)' }}>
          Visão comercial e de estoque
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--ac-muted)' }}>
          Escolha o painel abaixo. Só um tema é exibido por vez para manter a página leve; dentro de cada painel, os detalhes ficam em blocos expansíveis.
        </p>
      </header>

      <div
        className="rounded-2xl border p-4 sm:p-5 shadow-sm min-w-0"
        style={{ borderColor: 'var(--ac-border)', background: 'var(--ac-card)' }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
              Período do relatório
            </span>
            <p className="text-xs" style={{ color: 'var(--ac-muted)' }}>
              Vendas por data de pedido; estoque por movimentações e consumo no intervalo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <div className="flex items-center gap-2">
              <label className="text-xs whitespace-nowrap" style={{ color: 'var(--ac-muted)' }}>
                De
              </label>
              <input
                type="date"
                value={desde}
                max={ate}
                onChange={(e) => handleDesdeChange(e.target.value)}
                disabled={isPending}
                className="rounded-lg px-3 py-2 text-sm outline-none transition-all disabled:opacity-60"
                style={{
                  background: 'var(--ac-bg)',
                  border: '1px solid var(--ac-border)',
                  color: 'var(--ac-text)',
                  colorScheme: 'light',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ac-accent)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ac-border)'
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs whitespace-nowrap" style={{ color: 'var(--ac-muted)' }}>
                Até
              </label>
              <input
                type="date"
                value={ate}
                min={desde}
                onChange={(e) => handleAteChange(e.target.value)}
                disabled={isPending}
                className="rounded-lg px-3 py-2 text-sm outline-none transition-all disabled:opacity-60"
                style={{
                  background: 'var(--ac-bg)',
                  border: '1px solid var(--ac-border)',
                  color: 'var(--ac-text)',
                  colorScheme: 'light',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ac-accent)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'var(--ac-border)'
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-1">
              {[
                { label: '7 dias', days: 7 },
                { label: '30 dias', days: 30 },
                { label: '90 dias', days: 90 },
                { label: '1 ano', days: 365 },
              ].map((s) => (
                <button
                  key={s.label}
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    const to = new Date()
                    const from = new Date()
                    from.setDate(from.getDate() - s.days)
                    const range: DateRange = {
                      desde: from.toISOString().split('T')[0],
                      ate: to.toISOString().split('T')[0],
                    }
                    setDesde(range.desde)
                    setAte(range.ate)
                    fetchWithRange(range)
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60"
                  style={{
                    color: 'var(--ac-muted)',
                    background: 'var(--ac-bg)',
                    border: '1px solid var(--ac-border)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--ac-accent)'
                    e.currentTarget.style.borderColor = 'var(--ac-accent)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--ac-muted)'
                    e.currentTarget.style.borderColor = 'var(--ac-border)'
                  }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div
        className="rounded-2xl border overflow-hidden min-w-0"
        style={{ borderColor: 'var(--ac-border)', background: 'var(--ac-card)' }}
        role="tablist"
        aria-label="Tipo de relatório"
      >
        <div className="flex p-1 gap-1 sm:inline-flex sm:flex-row w-full sm:w-auto rounded-xl m-2" style={{ background: 'var(--ac-bg)' }}>
          <button
            type="button"
            role="tab"
            aria-selected={painel === 'vendas'}
            id="tab-relatorio-vendas"
            aria-controls="panel-relatorio-vendas"
            onClick={() => setPainel('vendas')}
            className="flex-1 sm:flex-none min-w-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all"
            style={{
              color: painel === 'vendas' ? 'var(--ac-text)' : 'var(--ac-muted)',
              background: painel === 'vendas' ? 'var(--ac-card)' : 'transparent',
              boxShadow: painel === 'vendas' ? '0 1px 3px color-mix(in srgb, var(--ac-text) 12%, transparent)' : 'none',
              border: painel === 'vendas' ? '1px solid var(--ac-border)' : '1px solid transparent',
            }}
          >
            <span className="block truncate">Vendas</span>
            <span className="block text-[11px] font-normal opacity-80 truncate" style={{ color: 'var(--ac-muted)' }}>
              {kpiV.totalPedidos} ped. · {kpiV.faturamentoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={painel === 'estoque'}
            id="tab-relatorio-estoque"
            aria-controls="panel-relatorio-estoque"
            onClick={() => setPainel('estoque')}
            className="flex-1 sm:flex-none min-w-0 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all"
            style={{
              color: painel === 'estoque' ? 'var(--ac-text)' : 'var(--ac-muted)',
              background: painel === 'estoque' ? 'var(--ac-card)' : 'transparent',
              boxShadow: painel === 'estoque' ? '0 1px 3px color-mix(in srgb, var(--ac-text) 12%, transparent)' : 'none',
              border: painel === 'estoque' ? '1px solid var(--ac-border)' : '1px solid transparent',
            }}
          >
            <span className="block truncate">Estoque</span>
            <span className="block text-[11px] font-normal opacity-80 truncate" style={{ color: 'var(--ac-muted)' }}>
              {criticosE} crít. · {kpiE.totalSkusFacas + kpiE.totalSkusMp} SKUs
            </span>
          </button>
        </div>

        {isPending && (
          <div className="flex items-center gap-2 px-4 pb-2 text-sm" style={{ color: 'var(--ac-muted)' }}>
            <span
              className="inline-block w-4 h-4 border-2 rounded-full animate-spin"
              style={{ borderColor: 'var(--ac-border)', borderTopColor: 'var(--ac-accent)' }}
            />
            Atualizando…
          </div>
        )}

        <div
          className="px-3 pb-4 sm:px-5 sm:pb-6 min-w-0"
          style={{ opacity: isPending ? 0.55 : 1, transition: 'opacity 0.2s' }}
        >
          {painel === 'vendas' ? (
            <div
              role="tabpanel"
              id="panel-relatorio-vendas"
              aria-labelledby="tab-relatorio-vendas"
              className="rounded-xl border min-w-0 overflow-hidden"
              style={{ borderColor: 'var(--ac-border)', background: 'var(--ac-bg)' }}
            >
              <div
                className="px-4 py-3 border-b text-sm font-medium"
                style={{ borderColor: 'var(--ac-border)', color: 'var(--ac-muted)' }}
              >
                Desempenho de vendas — abra cada seção para ver o detalhe.
              </div>
              <div className="p-3 sm:p-4 min-w-0">
                <VendasMetricsView data={vData} />
              </div>
            </div>
          ) : (
            <div
              role="tabpanel"
              id="panel-relatorio-estoque"
              aria-labelledby="tab-relatorio-estoque"
              className="rounded-xl border min-w-0 overflow-hidden"
              style={{ borderColor: 'var(--ac-border)', background: 'var(--ac-bg)' }}
            >
              <div
                className="px-4 py-3 border-b text-sm font-medium"
                style={{ borderColor: 'var(--ac-border)', color: 'var(--ac-muted)' }}
              >
                Estoque e movimentação — alertas abrem automaticamente quando existirem.
              </div>
              <div className="p-3 sm:p-4 min-w-0">
                <EstoqueMetricsView data={eData} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
