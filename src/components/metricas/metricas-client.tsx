'use client'

import { useState, useTransition } from 'react'
import { VendasMetricsView } from './vendas-metrics'
import { EstoqueMetricsView } from './estoque-metrics'
import { ConciliacaoMetricsView } from './conciliacao-metrics'
import {
  getMetricasVendas,
  getMetricasEstoque,
  type MetricasVendasData,
  type MetricasEstoqueData,
} from '@/lib/actions/metricas'
import { type ResultadoConciliacao } from '@/lib/actions/conciliacao'
import { type DateRange } from '@/lib/metricas-periodos'

type MetricaTabId = 'vendas' | 'estoque' | 'conciliacao'

type MetricasClientProps = {
  initialTab?: MetricaTabId
  vendasData?: MetricasVendasData
  estoqueData?: MetricasEstoqueData
  conciliacaoData?: ResultadoConciliacao
}

export function MetricasClient({ initialTab = 'vendas', vendasData, estoqueData, conciliacaoData }: MetricasClientProps) {
  const initialRange: DateRange = vendasData?.dateRange ?? estoqueData?.dateRange ?? (() => {
    const ate = new Date()
    const desde = new Date()
    desde.setDate(desde.getDate() - 30)
    return { desde: desde.toISOString().split('T')[0], ate: ate.toISOString().split('T')[0] }
  })()

  const [desde, setDesde] = useState(initialRange.desde)
  const [ate, setAte] = useState(initialRange.ate)
  const [vData, setVData] = useState(vendasData)
  const [eData, setEData] = useState(estoqueData)
  const [isPending, startTransition] = useTransition()

  const isConciliacao = initialTab === 'conciliacao'

  function fetchWithRange(range: DateRange) {
    if (isConciliacao) return
    startTransition(async () => {
      if (initialTab === 'vendas') {
        const data = await getMetricasVendas(range)
        setVData(data)
      } else {
        const data = await getMetricasEstoque(range)
        setEData(data)
      }
    })
  }

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
    <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--ac-text)' }}>
          Métricas
        </h1>
        <p className="text-sm" style={{ color: 'var(--ac-muted)' }}>
          Painel analítico para controle de vendas, estoque e operações.
        </p>
      </header>

      {!isConciliacao && (
        <div
          className="rounded-xl border p-3 sm:p-4"
          style={{ borderColor: 'var(--ac-border)', background: 'var(--ac-card)' }}
        >
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
              Período
            </span>
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: 'var(--ac-muted)' }}>De</label>
              <input
                type="date"
                value={desde}
                max={ate}
                onChange={(e) => handleDesdeChange(e.target.value)}
                disabled={isPending}
                className="rounded-lg px-3 py-1.5 text-sm outline-none transition-all disabled:opacity-60"
                style={{
                  background: 'var(--ac-bg)',
                  border: '1px solid var(--ac-border)',
                  color: 'var(--ac-text)',
                  colorScheme: 'light',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ac-accent)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ac-border)' }}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: 'var(--ac-muted)' }}>Até</label>
              <input
                type="date"
                value={ate}
                min={desde}
                onChange={(e) => handleAteChange(e.target.value)}
                disabled={isPending}
                className="rounded-lg px-3 py-1.5 text-sm outline-none transition-all disabled:opacity-60"
                style={{
                  background: 'var(--ac-bg)',
                  border: '1px solid var(--ac-border)',
                  color: 'var(--ac-text)',
                  colorScheme: 'light',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ac-accent)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ac-border)' }}
              />
            </div>

            {/* Atalhos rápidos */}
            <div className="flex items-center gap-1 ml-1">
              {[
                { label: '7d', days: 7 },
                { label: '30d', days: 30 },
                { label: '90d', days: 90 },
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
                  className="px-2 py-1 rounded text-xs transition-colors disabled:opacity-60"
                  style={{ color: 'var(--ac-muted)', background: 'var(--ac-bg)', border: '1px solid var(--ac-border)' }}
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
      )}

      {/* Loading indicator */}
      {isPending && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ac-muted)' }}>
          <span
            className="inline-block w-4 h-4 border-2 rounded-full animate-spin"
            style={{ borderColor: 'var(--ac-border)', borderTopColor: 'var(--ac-accent)' }}
          />
          Atualizando métricas...
        </div>
      )}

      {/* Content */}
      <div style={{ opacity: isPending ? 0.5 : 1, transition: 'opacity 0.2s' }}>
        {initialTab === 'vendas' && vData && <VendasMetricsView data={vData} />}
        {initialTab === 'estoque' && eData && <EstoqueMetricsView data={eData} />}
        {initialTab === 'conciliacao' && conciliacaoData && <ConciliacaoMetricsView data={conciliacaoData} />}
      </div>
    </div>
  )
}
