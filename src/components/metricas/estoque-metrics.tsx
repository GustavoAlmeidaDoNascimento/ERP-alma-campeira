'use client'

import { useState } from 'react'
import { KpiCard } from './kpi-card'
import { BarHorizontal } from './bar-horizontal'
import { BadgeEstoque } from '@/components/ui/badge-estoque'
import { STATUS_OC } from '@/types'
import type { MetricasEstoqueData, ConsumoBom, RankingUsuarioEstoque } from '@/lib/actions/metricas'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtN(v: number) {
  return v.toLocaleString('pt-BR')
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const TIPO_MOV_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  entrada:          { label: 'Entrada',       color: '#16a34a', bg: '#dcfce7' },
  saida_producao:   { label: 'Saída Prod.',   color: '#b45309', bg: '#fef9c3' },
  saida_venda:      { label: 'Saída Venda',   color: '#1d4ed8', bg: '#dbeafe' },
  saida_consumivel: { label: 'Baixa cons.',   color: '#c2410c', bg: '#ffedd5' },
  ajuste:           { label: 'Ajuste',        color: '#6b7280', bg: '#f3f4f6' },
}

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

function BomRow({ bom }: { bom: ConsumoBom }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--ac-border)' }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left hover:brightness-95 transition-all"
        style={{ background: 'var(--ac-card)' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: 'var(--ac-muted)', transform: open ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform 0.15s' }}>
            &#9654;
          </span>
          <span className="font-mono text-xs" style={{ color: 'var(--ac-muted)' }}>{bom.facaCodigo}</span>
          <span className="font-medium" style={{ color: 'var(--ac-text)' }}>{bom.facaNome}</span>
        </div>
        <span className="font-semibold text-xs" style={{ color: 'var(--ac-accent)' }}>{fmt(bom.custoTotalFaca)}</span>
      </button>
      {open && (
        <div className="border-t px-3 py-2" style={{ borderColor: 'var(--ac-border)', background: 'color-mix(in srgb, var(--ac-bg) 50%, var(--ac-card))' }}>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ color: 'var(--ac-muted)' }}>
                <th className="text-left py-1 font-medium">Material</th>
                <th className="text-right py-1 font-medium">Qtd</th>
                <th className="text-right py-1 font-medium">Custo Unit.</th>
                <th className="text-right py-1 font-medium">Custo Total</th>
              </tr>
            </thead>
            <tbody>
              {bom.materiais.map((m) => (
                <tr key={m.mpId} className="border-t" style={{ borderColor: 'var(--ac-border)' }}>
                  <td className="py-1" style={{ color: 'var(--ac-text)' }}>
                    <span className="font-mono" style={{ color: 'var(--ac-muted)' }}>{m.mpCodigo}</span>{' '}
                    {m.mpNome}
                  </td>
                  <td className="py-1 text-right" style={{ color: 'var(--ac-text)' }}>{fmtN(m.quantidade)}</td>
                  <td className="py-1 text-right" style={{ color: 'var(--ac-text)' }}>{fmt(m.custoUnitario)}</td>
                  <td className="py-1 text-right font-medium" style={{ color: 'var(--ac-text)' }}>{fmt(m.custoTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function EstoqueMetricsView({ data }: { data: MetricasEstoqueData }) {
  const { kpi, saudeFacas, saudeMp, movimentacoesRecentes, rankingUsuarios, consumoBom, resumoOC, alertas } = data

  const totalCriticos = kpi.facasCriticas + kpi.mpCriticas
  const totalAtencao = kpi.facasAtencao + kpi.mpAtencao

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="SKUs Facas"
          value={fmtN(kpi.totalSkusFacas)}
          detail={`${kpi.totalSkusMp} matérias-primas`}
        />
        <KpiCard
          label="Estoque Crítico"
          value={fmtN(totalCriticos)}
          detail={`${kpi.facasCriticas} facas, ${kpi.mpCriticas} MP`}
          accent="#dc2626"
        />
        <KpiCard
          label="Estoque Atenção"
          value={fmtN(totalAtencao)}
          detail={`${kpi.facasAtencao} facas, ${kpi.mpAtencao} MP`}
          accent="#b45309"
        />
        <KpiCard
          label="Itens OK"
          value={fmtN(kpi.totalSkusFacas + kpi.totalSkusMp - totalCriticos - totalAtencao)}
          accent="#16a34a"
        />
      </div>

      {/* Alertas */}
      {alertas.length > 0 && (
        <Section title="Alertas de Estoque">
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {alertas.map((a) => {
              const isZero = a.tipo === 'zero'
              return (
                <div
                  key={`${a.itemTipo}-${a.itemId}`}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm"
                  style={{
                    background: isZero ? '#fee2e2' : '#fef9c3',
                    color: isZero ? '#dc2626' : '#b45309',
                  }}
                >
                  <span className="shrink-0 w-2 h-2 rounded-full" style={{ background: isZero ? '#dc2626' : '#b45309' }} />
                  <span className="font-mono text-xs">{a.itemCodigo}</span>
                  <span className="font-medium flex-1 truncate">{a.itemNome}</span>
                  <span className="text-xs shrink-0">{a.itemTipo === 'faca' ? 'Faca' : 'MP'}</span>
                  <span className="text-xs font-medium shrink-0">{a.detalhe}</span>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Saúde Facas */}
      {saudeFacas.length > 0 && (
        <Section title="Saúde do Estoque — Facas">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--ac-muted)' }}>
                  <th className="text-left py-2 pr-3 font-medium">Código</th>
                  <th className="text-left py-2 px-3 font-medium">Nome</th>
                  <th className="text-right py-2 px-3 font-medium">Atual</th>
                  <th className="text-right py-2 px-3 font-medium">Mínimo</th>
                  <th className="text-center py-2 px-3 font-medium">Status</th>
                  <th className="text-right py-2 pl-3 font-medium">Cobertura</th>
                </tr>
              </thead>
              <tbody>
                {saudeFacas.map((f) => (
                  <tr key={f.id} className="border-t" style={{ borderColor: 'var(--ac-border)' }}>
                    <td className="py-2 pr-3 font-mono text-xs" style={{ color: 'var(--ac-muted)' }}>{f.codigo}</td>
                    <td className="py-2 px-3 font-medium" style={{ color: 'var(--ac-text)' }}>{f.nome}</td>
                    <td className="py-2 px-3 text-right font-semibold" style={{ color: 'var(--ac-text)' }}>{fmtN(f.estoqueAtual)}</td>
                    <td className="py-2 px-3 text-right" style={{ color: 'var(--ac-muted)' }}>{fmtN(f.estoqueMinimo)}</td>
                    <td className="py-2 px-3 text-center"><BadgeEstoque status={f.status} /></td>
                    <td className="py-2 pl-3 text-right" style={{
                      color: f.coberturaDias === null ? 'var(--ac-muted)'
                        : f.coberturaDias < 7 ? '#dc2626'
                        : f.coberturaDias < 14 ? '#b45309'
                        : '#16a34a',
                      fontWeight: 600,
                    }}>
                      {f.coberturaDias !== null ? `${f.coberturaDias}d` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Saúde MP */}
      {saudeMp.length > 0 && (
        <Section title="Saúde do Estoque — Matérias-Primas">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--ac-muted)' }}>
                  <th className="text-left py-2 pr-3 font-medium">Código</th>
                  <th className="text-left py-2 px-3 font-medium">Nome</th>
                  <th className="text-left py-2 px-3 font-medium">Fornecedor</th>
                  <th className="text-right py-2 px-3 font-medium">Atual</th>
                  <th className="text-right py-2 px-3 font-medium">Mínimo</th>
                  <th className="text-center py-2 pl-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {saudeMp.map((m) => (
                  <tr key={m.id} className="border-t" style={{ borderColor: 'var(--ac-border)' }}>
                    <td className="py-2 pr-3 font-mono text-xs" style={{ color: 'var(--ac-muted)' }}>{m.codigo}</td>
                    <td className="py-2 px-3 font-medium" style={{ color: 'var(--ac-text)' }}>{m.nome}</td>
                    <td className="py-2 px-3 text-sm" style={{ color: 'var(--ac-muted)' }}>{m.fornecedorNome ?? '-'}</td>
                    <td className="py-2 px-3 text-right font-semibold" style={{ color: 'var(--ac-text)' }}>{fmtN(m.estoqueAtual)}</td>
                    <td className="py-2 px-3 text-right" style={{ color: 'var(--ac-muted)' }}>{fmtN(m.estoqueMinimo)}</td>
                    <td className="py-2 pl-3 text-center"><BadgeEstoque status={m.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Movimentações Recentes */}
      {movimentacoesRecentes.length > 0 && (
        <Section title="Movimentações Recentes">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--ac-muted)' }}>
                  <th className="text-left py-2 pr-3 font-medium">Data</th>
                  <th className="text-left py-2 px-3 font-medium">Tipo</th>
                  <th className="text-left py-2 px-3 font-medium">Item</th>
                  <th className="text-left py-2 px-3 font-medium">Usuário</th>
                  <th className="text-right py-2 pl-3 font-medium">Qtd</th>
                </tr>
              </thead>
              <tbody>
                {movimentacoesRecentes.map((m) => {
                  const st = TIPO_MOV_STYLE[m.tipo] ?? TIPO_MOV_STYLE.ajuste
                  return (
                    <tr key={m.id} className="border-t" style={{ borderColor: 'var(--ac-border)' }}>
                      <td className="py-2 pr-3 text-xs" style={{ color: 'var(--ac-muted)' }}>{fmtDate(m.createdAt)}</td>
                      <td className="py-2 px-3">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                          style={{ color: st.color, background: st.bg }}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="py-2 px-3" style={{ color: 'var(--ac-text)' }}>
                        <span className="font-mono text-xs" style={{ color: 'var(--ac-muted)' }}>{m.itemCodigo}</span>{' '}
                        {m.itemNome}
                      </td>
                      <td className="py-2 px-3 text-xs" style={{ color: 'var(--ac-muted)' }}>
                        {m.usuarioNome ?? '—'}
                      </td>
                      <td className="py-2 pl-3 text-right font-semibold" style={{ color: 'var(--ac-text)' }}>{fmtN(m.quantidade)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Ranking de Usuários por Movimentações */}
      {rankingUsuarios.length > 0 && (
        <Section title="Ranking de Movimentações por Usuário">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--ac-muted)' }}>
                  <th className="text-left py-2 pr-3 font-medium">#</th>
                  <th className="text-left py-2 px-3 font-medium">Usuário</th>
                  <th className="text-right py-2 px-3 font-medium">Total</th>
                  <th className="text-right py-2 px-3 font-medium">Entradas</th>
                  <th className="text-right py-2 pl-3 font-medium">Saídas</th>
                </tr>
              </thead>
              <tbody>
                {rankingUsuarios.map((u: RankingUsuarioEstoque, i: number) => (
                  <tr key={u.usuarioId} className="border-t" style={{ borderColor: 'var(--ac-border)' }}>
                    <td className="py-2 pr-3 font-bold text-xs" style={{ color: 'var(--ac-muted)' }}>{i + 1}</td>
                    <td className="py-2 px-3 font-medium" style={{ color: 'var(--ac-text)' }}>{u.usuarioNome}</td>
                    <td className="py-2 px-3 text-right font-bold" style={{ color: 'var(--ac-text)' }}>{u.totalMovimentacoes}</td>
                    <td className="py-2 px-3 text-right text-xs font-semibold" style={{ color: '#15803d' }}>+{u.entradas}</td>
                    <td className="py-2 pl-3 text-right text-xs font-semibold" style={{ color: '#b45309' }}>-{u.saidas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Consumo BOM */}
      {consumoBom.length > 0 && (
        <Section title="Consumo de Insumos por Faca (BOM)">
          <div className="space-y-2">
            {consumoBom.map((bom) => (
              <BomRow key={bom.facaId} bom={bom} />
            ))}
          </div>
        </Section>
      )}

      {/* Resumo OC */}
      <Section title="Ordens de Compra">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {resumoOC.map((oc) => {
            const st = STATUS_OC[oc.status]
            return (
              <div
                key={oc.status}
                className="rounded-lg border-l-4 p-3 space-y-1"
                style={{ borderLeftColor: st.color, background: st.bg }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold" style={{ color: st.color }}>{st.label}</span>
                  <span className="text-lg font-bold" style={{ color: st.color }}>{oc.quantidade}</span>
                </div>
                <p className="text-xs" style={{ color: st.color }}>{fmt(oc.valorTotal)}</p>
              </div>
            )
          })}
        </div>
      </Section>
    </div>
  )
}
