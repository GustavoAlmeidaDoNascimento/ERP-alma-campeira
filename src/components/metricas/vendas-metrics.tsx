'use client'

import { KpiCard } from './kpi-card'
import { BarHorizontal } from './bar-horizontal'
import { STATUS_PEDIDO } from '@/types'
import type { MetricasVendasData } from '@/lib/actions/metricas'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtN(v: number) {
  return v.toLocaleString('pt-BR')
}

function fmtP(v: number) {
  return `${v.toFixed(1)}%`
}

// ── Section wrapper ──
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-xl border p-4 sm:p-5 space-y-3"
      style={{ borderColor: 'var(--ac-border)', background: 'var(--ac-card)' }}
    >
      <h3 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
        {title}
      </h3>
      {children}
    </section>
  )
}

export function VendasMetricsView({ data }: { data: MetricasVendasData }) {
  const { kpi, vendasPorMes, rankingClientes, rankingProdutos, pipeline, vendasPorTipo, rankingVendedores } = data

  const maxMesValor = Math.max(...vendasPorMes.map((v) => v.totalValor), 1)

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Faturamento Total" value={fmt(kpi.faturamentoTotal)} />
        <KpiCard label="Total Pedidos" value={fmtN(kpi.totalPedidos)} />
        <KpiCard label="Ticket Médio" value={fmt(kpi.ticketMedio)} />
        <KpiCard
          label="Taxa de Entrega"
          value={fmtP(kpi.taxaEntrega)}
          detail={`${kpi.pedidosEntregues} entregues de ${kpi.totalPedidos}`}
          accent="#16a34a"
        />
      </div>

      {/* Pipeline de Status */}
      <Section title="Pipeline de Pedidos">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {pipeline.map((p) => {
            const st = STATUS_PEDIDO[p.status]
            return (
              <div
                key={p.status}
                className="rounded-lg border-l-4 p-3 space-y-2"
                style={{ borderLeftColor: st.color, background: st.bg }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold" style={{ color: st.color }}>{st.label}</span>
                  <span className="text-lg font-bold" style={{ color: st.color }}>{p.quantidade}</span>
                </div>
                <p className="text-xs" style={{ color: st.color }}>{fmt(p.valorTotal)}</p>
                <BarHorizontal percentage={p.percentual} color={st.color} height={6} />
                <p className="text-xs text-right" style={{ color: st.color }}>{fmtP(p.percentual)}</p>
              </div>
            )
          })}
        </div>
      </Section>

      {/* Vendas por Mês */}
      {vendasPorMes.length > 0 && (
        <Section title="Vendas por Período">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--ac-muted)' }}>
                  <th className="text-left py-2 pr-3 font-medium">Mês</th>
                  <th className="text-right py-2 px-3 font-medium">Pedidos</th>
                  <th className="text-right py-2 px-3 font-medium">Itens</th>
                  <th className="text-right py-2 px-3 font-medium">Faturamento</th>
                  <th className="py-2 pl-3 w-32 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {vendasPorMes.map((v) => (
                  <tr key={v.mes} className="border-t" style={{ borderColor: 'var(--ac-border)' }}>
                    <td className="py-2 pr-3 font-medium" style={{ color: 'var(--ac-text)' }}>{v.mesLabel}</td>
                    <td className="py-2 px-3 text-right" style={{ color: 'var(--ac-text)' }}>{fmtN(v.totalPedidos)}</td>
                    <td className="py-2 px-3 text-right" style={{ color: 'var(--ac-text)' }}>{fmtN(v.totalItens)}</td>
                    <td className="py-2 px-3 text-right font-medium" style={{ color: 'var(--ac-text)' }}>{fmt(v.totalValor)}</td>
                    <td className="py-2 pl-3">
                      <BarHorizontal percentage={(v.totalValor / maxMesValor) * 100} height={6} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Ranking Clientes */}
      {rankingClientes.length > 0 && (
        <Section title="Top Clientes por Faturamento">
          <div className="space-y-2">
            {rankingClientes.map((c, i) => (
              <div key={c.clienteId ?? i} className="flex items-center gap-3">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--ac-accent) 15%, transparent)', color: 'var(--ac-accent)' }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--ac-text)' }}>{c.clienteNome}</span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded shrink-0"
                      style={{ background: 'color-mix(in srgb, var(--ac-border) 60%, transparent)', color: 'var(--ac-muted)' }}
                    >
                      {c.clienteTipo}
                    </span>
                  </div>
                  <BarHorizontal percentage={c.participacao} height={5} />
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--ac-text)' }}>{fmt(c.totalValor)}</p>
                  <p className="text-xs" style={{ color: 'var(--ac-muted)' }}>{fmtP(c.participacao)}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Ranking Vendedores */}
      {rankingVendedores.length > 0 && (
        <Section title="Top Vendedores por Faturamento">
          <div className="space-y-2">
            {rankingVendedores.map((v, i) => (
              <div key={v.vendedorId ?? i} className="flex items-center gap-3">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--ac-accent) 15%, transparent)', color: 'var(--ac-accent)' }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--ac-text)' }}>{v.vendedorNome}</span>
                  </div>
                  <BarHorizontal percentage={v.participacao} height={5} />
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--ac-text)' }}>{fmt(v.totalValor)}</p>
                  <p className="text-xs" style={{ color: 'var(--ac-muted)' }}>{fmtP(v.participacao)} &middot; {v.totalPedidos} pedidos</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Ranking Produtos */}
      {rankingProdutos.length > 0 && (
        <Section title="Top Produtos por Faturamento">
          <div className="space-y-2">
            {rankingProdutos.map((p, i) => (
              <div key={p.facaId} className="flex items-center gap-3">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--ac-accent) 15%, transparent)', color: 'var(--ac-accent)' }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono" style={{ color: 'var(--ac-muted)' }}>{p.facaCodigo}</span>
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--ac-text)' }}>{p.facaNome}</span>
                  </div>
                  <BarHorizontal percentage={p.participacao} height={5} />
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--ac-text)' }}>{fmt(p.totalValor)}</p>
                  <p className="text-xs" style={{ color: 'var(--ac-muted)' }}>{fmtN(p.totalQuantidade)} unid. &middot; {fmtP(p.participacao)}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Vendas por Tipo de Cliente */}
      {vendasPorTipo.length > 0 && (
        <Section title="Vendas por Tipo de Cliente">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {vendasPorTipo.map((v) => (
              <div
                key={v.tipo}
                className="rounded-lg border p-3 space-y-2"
                style={{ borderColor: 'var(--ac-border)' }}
              >
                <p className="text-sm font-semibold" style={{ color: 'var(--ac-text)' }}>{v.tipo}</p>
                <p className="text-lg font-bold" style={{ color: 'var(--ac-accent)' }}>{fmt(v.totalValor)}</p>
                <BarHorizontal percentage={v.percentual} height={6} />
                <div className="flex justify-between text-xs" style={{ color: 'var(--ac-muted)' }}>
                  <span>{v.totalPedidos} pedidos</span>
                  <span>{fmtP(v.percentual)}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
