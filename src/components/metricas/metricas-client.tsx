'use client'

import { useErpTabs } from '@/components/layout/erp-tabs'
import { VendasMetricsView } from './vendas-metrics'
import { EstoqueMetricsView } from './estoque-metrics'
import type { MetricasVendasData, MetricasEstoqueData } from '@/lib/actions/metricas'

type MetricaTabId = 'vendas' | 'estoque'

const METRICA_TABS: { id: MetricaTabId; label: string; href: string }[] = [
  { id: 'vendas', label: 'Vendas', href: '/metricas/vendas' },
  { id: 'estoque', label: 'Estoque', href: '/metricas/estoque' },
]

type MetricasClientProps = {
  initialTab?: MetricaTabId
  vendasData?: MetricasVendasData
  estoqueData?: MetricasEstoqueData
}

export function MetricasClient({ initialTab = 'vendas', vendasData, estoqueData }: MetricasClientProps) {
  const { openTab } = useErpTabs()

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

      {/* Tab Switcher */}
      <div
        className="rounded-xl border p-2 sm:p-3"
        style={{ borderColor: 'var(--ac-border)', background: 'var(--ac-card)' }}
      >
        <div className="flex flex-wrap gap-2">
          {METRICA_TABS.map((tab) => {
            const isActive = tab.id === initialTab
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => { if (!isActive) openTab(tab.href) }}
                className="w-full sm:w-auto px-3 py-2 rounded-lg text-sm transition-colors"
                style={{
                  color: isActive ? 'var(--ac-accent)' : 'var(--ac-muted)',
                  background: isActive
                    ? 'color-mix(in srgb, var(--ac-accent) 12%, transparent)'
                    : 'transparent',
                  border: `1px solid ${isActive ? 'var(--ac-accent)' : 'var(--ac-border)'}`,
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Content */}
      {initialTab === 'vendas' && vendasData && <VendasMetricsView data={vendasData} />}
      {initialTab === 'estoque' && estoqueData && <EstoqueMetricsView data={estoqueData} />}
    </div>
  )
}
