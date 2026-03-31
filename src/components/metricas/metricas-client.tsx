'use client'

import { useState, useTransition } from 'react'
import { useErpTabs } from '@/components/layout/erp-tabs'
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
import { PERIODOS, type PeriodoId } from '@/lib/metricas-periodos'

type MetricaTabId = 'vendas' | 'estoque' | 'conciliacao'

const METRICA_TABS: { id: MetricaTabId; label: string; href: string; alerta?: boolean }[] = [
  { id: 'vendas', label: 'Vendas', href: '/metricas/vendas' },
  { id: 'estoque', label: 'Estoque', href: '/metricas/estoque' },
  { id: 'conciliacao', label: 'Conciliação', href: '/metricas/conciliacao' },
]

type MetricasClientProps = {
  initialTab?: MetricaTabId
  vendasData?: MetricasVendasData
  estoqueData?: MetricasEstoqueData
  conciliacaoData?: ResultadoConciliacao
}

export function MetricasClient({ initialTab = 'vendas', vendasData, estoqueData, conciliacaoData }: MetricasClientProps) {
  const { openTab } = useErpTabs()
  const [periodo, setPeriodo] = useState<PeriodoId>(vendasData?.periodo ?? estoqueData?.periodo ?? 'tudo')
  const [vData, setVData] = useState(vendasData)
  const [eData, setEData] = useState(estoqueData)
  const [isPending, startTransition] = useTransition()

  const isConciliacao = initialTab === 'conciliacao'
  const temDivergencias = conciliacaoData && !conciliacaoData.tudoOk

  function handlePeriodoChange(novoPeriodo: PeriodoId) {
    if (novoPeriodo === periodo || isConciliacao) return
    setPeriodo(novoPeriodo)
    startTransition(async () => {
      if (initialTab === 'vendas') {
        const data = await getMetricasVendas(novoPeriodo)
        setVData(data)
      } else {
        const data = await getMetricasEstoque(novoPeriodo)
        setEData(data)
      }
    })
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

      {/* Controls: Tabs + Período */}
      <div
        className="rounded-xl border p-2 sm:p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        style={{ borderColor: 'var(--ac-border)', background: 'var(--ac-card)' }}
      >
        {/* Tab Switcher */}
        <div className="flex flex-wrap gap-2">
          {METRICA_TABS.map((tab) => {
            const isActive = tab.id === initialTab
            const showAlerta = tab.id === 'conciliacao' && temDivergencias && !isActive
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { if (!isActive) openTab(tab.href) }}
                className="relative px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  color: isActive ? 'var(--ac-accent)' : 'var(--ac-muted)',
                  background: isActive
                    ? 'color-mix(in srgb, var(--ac-accent) 12%, transparent)'
                    : 'transparent',
                  border: `1px solid ${isActive ? 'var(--ac-accent)' : 'var(--ac-border)'}`,
                }}
              >
                {tab.label}
                {showAlerta && (
                  <span
                    className="absolute -top-1.5 -right-1.5 flex size-3.5 items-center justify-center rounded-full text-[9px] font-bold"
                    style={{ background: '#dc2626', color: '#fff' }}
                  >
                    !
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Período Selector — oculto na aba de conciliação */}
        {!isConciliacao && (
          <div className="flex flex-wrap gap-1.5">
            {PERIODOS.map((p) => {
              const isActive = p.id === periodo
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handlePeriodoChange(p.id)}
                  disabled={isPending}
                  className="px-2.5 py-1.5 rounded-md text-xs transition-colors disabled:opacity-60"
                  style={{
                    color: isActive ? 'var(--ac-card)' : 'var(--ac-muted)',
                    background: isActive ? 'var(--ac-accent)' : 'transparent',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        )}
      </div>

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
