'use client'

import { useMemo, useState } from 'react'

type MetricaTabId = 'vendas' | 'estoque'

type MetricaTab = {
  id: MetricaTabId
  label: string
  hint: string
  notes: string[]
}

const METRICA_TABS: MetricaTab[] = [
  {
    id: 'vendas',
    label: 'Vendas',
    hint: 'Quanto, quem e como venderam ao longo do tempo.',
    notes: [
      'Curva temporal de vendas (dia/semana/mes) com comparativos de periodos.',
      'Ranking por clientes e por produtos (facas) com participacao no faturamento.',
      'Mix de canais de venda e ticket medio por canal.',
    ],
  },
  {
    id: 'estoque',
    label: 'Estoque',
    hint: 'Movimentacao e saude do estoque ao longo do tempo.',
    notes: [
      'Entradas e saidas por periodo para materias-primas e facas.',
      'Interligacao materias-primas -> facas (consumo de insumos por produto final).',
      'Estoque medio, cobertura de dias e rupturas por item.',
      'Indicadores de compras: lead time, atraso e aderencia das ordens de compra.',
      'Alertas de variacao anomala e giro por SKU.',
    ],
  },
]

type MetricasClientProps = {
  initialTab?: MetricaTabId
}

export function MetricasClient({ initialTab = 'vendas' }: MetricasClientProps) {
  const [activeTab, setActiveTab] = useState<MetricaTabId>(initialTab)

  const currentTab = useMemo(
    () => METRICA_TABS.find((tab) => tab.id === activeTab) ?? METRICA_TABS[0],
    [activeTab],
  )

  return (
    <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 space-y-5">
      <header className="space-y-1">
        <h1 className="text-xl sm:text-2xl font-bold" style={{ color: 'var(--ac-text)' }}>
          Metricas
        </h1>
        <p className="text-sm" style={{ color: 'var(--ac-muted)' }}>
          Base para o modulo analitico. Os blocos abaixo guiam a implementacao futura.
        </p>
      </header>

      <div
        className="rounded-xl border p-2 sm:p-3"
        style={{ borderColor: 'var(--ac-border)', background: 'var(--ac-card)' }}
      >
        <div className="flex flex-wrap gap-2">
          {METRICA_TABS.map((tab) => {
            const isActive = tab.id === activeTab
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
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

      <section
        className="rounded-xl border p-4 sm:p-5 space-y-4"
        style={{ borderColor: 'var(--ac-border)', background: 'var(--ac-card)' }}
      >
        <div>
          <h2 className="text-base sm:text-lg font-semibold" style={{ color: 'var(--ac-text)' }}>
            {currentTab.label}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--ac-muted)' }}>
            Funcionalidade em construcao.
          </p>
          <p className="text-sm mt-2" style={{ color: 'var(--ac-muted)' }}>
            {currentTab.hint}
          </p>
        </div>

        <div className="rounded-lg border p-3 sm:p-4" style={{ borderColor: 'var(--ac-border)' }}>
          <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--ac-muted)' }}>
            Anotacoes para implementacao futura
          </p>
          <ul className="space-y-2 text-sm" style={{ color: 'var(--ac-text)' }}>
            {currentTab.notes.map((note) => (
              <li key={note} className="leading-relaxed">
                - {note}
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
