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

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

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

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 space-y-6 max-w-[1600px] mx-auto">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--ac-accent)' }}>
          Relatórios
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: 'var(--ac-text)' }}>
          Visão comercial e de estoque
        </h1>
        <p className="text-sm max-w-2xl leading-relaxed" style={{ color: 'var(--ac-muted)' }}>
          Acompanhe faturamento, pedidos e desempenho de vendas no mesmo painel em que acompanha saúde de SKUs,
          movimentações e consumo de materiais — tudo filtrado pelo mesmo período.
        </p>
      </header>

      <div
        className="rounded-2xl border p-4 sm:p-5 shadow-sm"
        style={{ borderColor: 'var(--ac-border)', background: 'var(--ac-card)' }}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
              Período do relatório
            </span>
            <p className="text-xs" style={{ color: 'var(--ac-muted)' }}>
              Vendas usam datas de pedido; estoque considera movimentações e consumo no intervalo.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
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

      <nav
        className="flex flex-wrap gap-2 sticky top-0 z-10 py-2 -mx-1 px-1"
        style={{ background: 'color-mix(in srgb, var(--ac-bg) 92%, transparent)', backdropFilter: 'blur(8px)' }}
        aria-label="Ir para seção"
      >
        <button
          type="button"
          onClick={() => scrollToId('relatorios-vendas')}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
          style={{
            background: 'var(--ac-card)',
            border: '1px solid var(--ac-border)',
            color: 'var(--ac-text)',
            boxShadow: '0 1px 2px color-mix(in srgb, var(--ac-text) 6%, transparent)',
          }}
        >
          <span
            className="size-2 rounded-full"
            style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
            aria-hidden
          />
          Vendas
        </button>
        <button
          type="button"
          onClick={() => scrollToId('relatorios-estoque')}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors"
          style={{
            background: 'var(--ac-card)',
            border: '1px solid var(--ac-border)',
            color: 'var(--ac-text)',
            boxShadow: '0 1px 2px color-mix(in srgb, var(--ac-text) 6%, transparent)',
          }}
        >
          <span
            className="size-2 rounded-full"
            style={{ background: 'linear-gradient(135deg, #2563eb, #6366f1)' }}
            aria-hidden
          />
          Estoque
        </button>
      </nav>

      {isPending && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ac-muted)' }}>
          <span
            className="inline-block w-4 h-4 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--ac-border)', borderTopColor: 'var(--ac-accent)' }}
          />
          Atualizando relatórios…
        </div>
      )}

      <div className="space-y-10" style={{ opacity: isPending ? 0.55 : 1, transition: 'opacity 0.2s' }}>
        <section
          id="relatorios-vendas"
          className="scroll-mt-24 rounded-2xl border overflow-hidden"
          style={{ borderColor: 'var(--ac-border)', background: 'var(--ac-card)' }}
        >
          <div
            className="px-5 py-4 sm:px-6 border-b flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2"
            style={{
              borderColor: 'var(--ac-border)',
              background: 'linear-gradient(135deg, color-mix(in srgb, #059669 12%, var(--ac-card)), var(--ac-card))',
            }}
          >
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--ac-text)' }}>
                Desempenho de vendas
              </h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--ac-muted)' }}>
                Faturamento, ticket médio, pipeline e rankings no período.
              </p>
            </div>
          </div>
          <div className="p-4 sm:p-6" style={{ background: 'var(--ac-bg)' }}>
            <VendasMetricsView data={vData} />
          </div>
        </section>

        <section
          id="relatorios-estoque"
          className="scroll-mt-24 rounded-2xl border overflow-hidden"
          style={{ borderColor: 'var(--ac-border)', background: 'var(--ac-card)' }}
        >
          <div
            className="px-5 py-4 sm:px-6 border-b flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2"
            style={{
              borderColor: 'var(--ac-border)',
              background: 'linear-gradient(135deg, color-mix(in srgb, #2563eb 12%, var(--ac-card)), var(--ac-card))',
            }}
          >
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--ac-text)' }}>
                Saúde e movimentação de estoque
              </h2>
              <p className="text-sm mt-0.5" style={{ color: 'var(--ac-muted)' }}>
                Críticos, consumo (BOM), ordens de compra e atividade recente.
              </p>
            </div>
          </div>
          <div className="p-4 sm:p-6" style={{ background: 'var(--ac-bg)' }}>
            <EstoqueMetricsView data={eData} />
          </div>
        </section>
      </div>
    </div>
  )
}
