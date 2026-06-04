'use client'

import type { MetricasFinanceiroData } from '@/lib/actions/metricas'
import { FORMAS_PAGAMENTO, metaTipoGasto } from '@/types'

const moedaBR = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const moedaCompacta = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

function formatarData(s: string) {
  if (!s) return '—'
  const [y, m, d] = s.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return s
  return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`
}

export function FinanceiroMetricsView({ data }: { data: MetricasFinanceiroData }) {
  const { kpi, despesasPorTipo, serieMensal, topGastos } = data

  const lucroPositivo = kpi.lucroLiquido >= 0
  const maxBarra = Math.max(
    1,
    ...serieMensal.map((m) => Math.max(m.receita, m.despesa))
  )

  return (
    <div className="flex flex-col gap-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Receita" valor={moedaBR.format(kpi.receitaTotal)} cor="#15803d" bg="#dcfce7" />
        <KpiCard label="Despesas" valor={moedaBR.format(kpi.despesaTotal)} cor="#b91c1c" bg="#fee2e2" />
        <KpiCard
          label="Lucro líquido"
          valor={moedaBR.format(kpi.lucroLiquido)}
          cor={lucroPositivo ? '#15803d' : '#b91c1c'}
          bg={lucroPositivo ? '#dcfce7' : '#fee2e2'}
        />
        <KpiCard
          label="Margem líquida"
          valor={`${kpi.margemLiquida.toFixed(1)}%`}
          cor={lucroPositivo ? '#15803d' : '#b91c1c'}
          bg={lucroPositivo ? '#dcfce7' : '#fee2e2'}
        />
      </div>

      {/* Despesas por tipo */}
      <Card title="Despesas por tipo">
        {despesasPorTipo.length === 0 ? (
          <Empty>Nenhum gasto registrado neste período.</Empty>
        ) : (
          <div className="flex flex-col gap-2">
            {despesasPorTipo.map((d) => {
              const meta = metaTipoGasto(d.tipo)
              return (
                <div key={d.tipo}>
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="font-medium" style={{ color: 'var(--ac-text)' }}>{meta.label}</span>
                    <span style={{ color: 'var(--ac-muted)' }}>
                      {moedaBR.format(d.total)} · {d.percentual.toFixed(1)}% · {d.quantidade}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--ac-border)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${d.percentual}%`, background: meta.color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* Série mensal */}
      <Card title="Receita vs Despesa por mês">
        {serieMensal.length === 0 ? (
          <Empty>Sem dados para o período selecionado.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[480px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--ac-border)' }}>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Mês</th>
                  <th className="text-right px-2 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Receita</th>
                  <th className="text-right px-2 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Despesa</th>
                  <th className="text-right px-2 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Saldo</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Comparativo</th>
                </tr>
              </thead>
              <tbody>
                {serieMensal.map((m) => {
                  const saldo = m.receita - m.despesa
                  const recPct = (m.receita / maxBarra) * 100
                  const despPct = (m.despesa / maxBarra) * 100
                  return (
                    <tr key={m.mes} style={{ borderTop: '1px solid var(--ac-border)' }}>
                      <td className="px-2 py-2 font-medium" style={{ color: 'var(--ac-text)' }}>{m.mesLabel}</td>
                      <td className="px-2 py-2 text-right font-mono text-xs" style={{ color: '#15803d' }}>{moedaCompacta.format(m.receita)}</td>
                      <td className="px-2 py-2 text-right font-mono text-xs" style={{ color: '#b91c1c' }}>{moedaCompacta.format(m.despesa)}</td>
                      <td className="px-2 py-2 text-right font-mono text-xs font-semibold"
                        style={{ color: saldo >= 0 ? '#15803d' : '#b91c1c' }}>
                        {moedaCompacta.format(saldo)}
                      </td>
                      <td className="px-2 py-2 w-1/3">
                        <div className="flex flex-col gap-0.5">
                          <div className="h-1.5 rounded-full" style={{ background: '#dcfce7' }}>
                            <div className="h-full rounded-full" style={{ width: `${recPct}%`, background: '#15803d' }} />
                          </div>
                          <div className="h-1.5 rounded-full" style={{ background: '#fee2e2' }}>
                            <div className="h-full rounded-full" style={{ width: `${despPct}%`, background: '#b91c1c' }} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Top gastos */}
      <Card title="Maiores despesas do período">
        {topGastos.length === 0 ? (
          <Empty>Nenhum gasto registrado neste período.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--ac-border)' }}>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Data</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Tipo</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Descrição</th>
                  <th className="text-right px-2 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Valor</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Pagamento</th>
                  <th className="text-left px-2 py-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>OC</th>
                </tr>
              </thead>
              <tbody>
                {topGastos.map((g) => {
                  const meta = metaTipoGasto(g.tipo)
                  return (
                    <tr key={g.id} style={{ borderTop: '1px solid var(--ac-border)' }}>
                      <td className="px-2 py-2 whitespace-nowrap" style={{ color: 'var(--ac-muted)' }}>{formatarData(g.data)}</td>
                      <td className="px-2 py-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap"
                          style={{ color: meta.color, background: meta.bg, border: `1px solid ${meta.border}` }}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-2 py-2" style={{ color: 'var(--ac-text)' }}>{g.descricao}</td>
                      <td className="px-2 py-2 text-right font-mono font-semibold whitespace-nowrap" style={{ color: 'var(--ac-text)' }}>
                        {moedaBR.format(g.valor)}
                      </td>
                      <td className="px-2 py-2 whitespace-nowrap" style={{ color: 'var(--ac-muted)' }}>
                        {FORMAS_PAGAMENTO[g.forma_pagamento]?.label ?? g.forma_pagamento}
                      </td>
                      <td className="px-2 py-2 font-mono text-xs whitespace-nowrap" style={{ color: 'var(--ac-muted)' }}>
                        {g.ordem_compra_codigo ?? '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function KpiCard({ label, valor, cor, bg }: { label: string; valor: string; cor: string; bg: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)' }}>
      <div
        className="inline-block px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wide"
        style={{ color: cor, background: bg }}
      >
        {label}
      </div>
      <p className="text-2xl font-bold mt-2" style={{ color: 'var(--ac-text)' }}>{valor}</p>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)' }}>
      <h3 className="font-semibold mb-3" style={{ color: 'var(--ac-text)' }}>{title}</h3>
      {children}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm py-4 text-center" style={{ color: 'var(--ac-muted)' }}>{children}</p>
}
