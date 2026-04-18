'use client'

import { useState } from 'react'
import type { ReactNode } from 'react'
import { KpiCard } from './kpi-card'
import { BarHorizontal } from './bar-horizontal'
import { CollapseSection } from './collapse-section'
import {
  IconRelatorioCalendario,
  IconRelatorioClientes,
  IconRelatorioClipboardUser,
  IconRelatorioComissoes,
  IconRelatorioPipeline,
  IconRelatorioProdutos,
  IconRelatorioRanking,
  IconRelatorioSegmentos,
} from './relatorio-icons'
import { STATUS_PEDIDO } from '@/types'
import type { MetricasVendasData, RelatorioVendedor } from '@/lib/actions/metricas'

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtN(v: number) {
  return v.toLocaleString('pt-BR')
}

function fmtP(v: number) {
  return `${v.toFixed(1)}%`
}

function VendedorRow({ v, taxaComissao }: { v: RelatorioVendedor; taxaComissao: number }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
        style={{ background: open ? 'color-mix(in srgb, var(--ac-accent) 6%, var(--ac-bg))' : 'var(--ac-bg)' }}
        onMouseEnter={(e) => {
          if (!open) e.currentTarget.style.background = 'var(--ac-card)'
        }}
        onMouseLeave={(e) => {
          if (!open) e.currentTarget.style.background = 'var(--ac-bg)'
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="size-3.5 shrink-0 transition-transform"
          style={{ color: 'var(--ac-muted)', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold" style={{ color: 'var(--ac-text)' }}>
            {v.vendedorNome}
          </span>
        </div>
        <div className="flex items-center gap-6 text-right shrink-0">
          <div>
            <p className="text-xs" style={{ color: 'var(--ac-muted)' }}>
              Pedidos
            </p>
            <p className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>
              {fmtN(v.totalPedidos)}
            </p>
          </div>
          <div>
            <p className="text-xs" style={{ color: 'var(--ac-muted)' }}>
              Faturamento
            </p>
            <p className="text-sm font-semibold" style={{ color: 'var(--ac-text)' }}>
              {fmt(v.totalValor)}
            </p>
          </div>
          {taxaComissao > 0 && (
            <div>
              <p className="text-xs" style={{ color: 'var(--ac-muted)' }}>
                Comissão ({taxaComissao}%)
              </p>
              <p className="text-sm font-semibold" style={{ color: '#16a34a' }}>
                {fmt(v.totalComissao)}
              </p>
            </div>
          )}
        </div>
      </button>

      {open && v.porMes.length > 0 && (
        <div style={{ borderTop: '1px solid var(--ac-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
                <th
                  className="text-left px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--ac-muted)' }}
                >
                  Mês
                </th>
                <th
                  className="text-right px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--ac-muted)' }}
                >
                  Pedidos
                </th>
                <th
                  className="text-right px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: 'var(--ac-muted)' }}
                >
                  Faturamento
                </th>
                {taxaComissao > 0 && (
                  <th
                    className="text-right px-4 py-2 text-xs font-semibold uppercase tracking-wide"
                    style={{ color: 'var(--ac-muted)' }}
                  >
                    Comissão ({taxaComissao}%)
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {v.porMes.map((m, i) => (
                <tr
                  key={m.mes}
                  style={{
                    borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined,
                    background: 'var(--ac-card)',
                  }}
                >
                  <td className="px-4 py-2.5 font-medium text-xs" style={{ color: 'var(--ac-text)' }}>
                    {m.mesLabel}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--ac-muted)' }}>
                    {fmtN(m.totalPedidos)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-medium" style={{ color: 'var(--ac-text)' }}>
                    {fmt(m.totalValor)}
                  </td>
                  {taxaComissao > 0 && (
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: '#16a34a' }}>
                      {fmt(m.comissao)}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            {v.porMes.length > 1 && (
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--ac-border)', background: 'var(--ac-bg)' }}>
                  <td className="px-4 py-2.5 text-xs font-bold" style={{ color: 'var(--ac-text)' }}>
                    Total
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-xs" style={{ color: 'var(--ac-text)' }}>
                    {fmtN(v.totalPedidos)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-bold text-xs" style={{ color: 'var(--ac-text)' }}>
                    {fmt(v.totalValor)}
                  </td>
                  {taxaComissao > 0 && (
                    <td className="px-4 py-2.5 text-right tabular-nums font-bold text-xs" style={{ color: '#16a34a' }}>
                      {fmt(v.totalComissao)}
                    </td>
                  )}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {open && v.porMes.length === 0 && (
        <p className="px-4 py-3 text-sm" style={{ color: 'var(--ac-muted)', borderTop: '1px solid var(--ac-border)' }}>
          Sem vendas no período.
        </p>
      )}
    </div>
  )
}

export function VendasMetricsView({ data }: { data: MetricasVendasData }) {
  const { kpi, vendasPorMes, rankingClientes, rankingProdutos, pipeline, vendasPorTipo, rankingVendedores, relatorioVendedores, taxaComissao } =
    data

  const maxMesValor = Math.max(...vendasPorMes.map((v) => v.totalValor), 1)

  const comissaoTotal = relatorioVendedores.reduce((s, v) => s + v.totalComissao, 0)
  const comissaoPorMes = (() => {
    const map = new Map<string, { mesLabel: string; total: number }>()
    for (const v of relatorioVendedores) {
      for (const m of v.porMes) {
        const entry = map.get(m.mes) ?? { mesLabel: m.mesLabel, total: 0 }
        entry.total += m.comissao
        map.set(m.mes, entry)
      }
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([mes, v]) => ({ mes, ...v }))
  })()

  const comissoesNode: ReactNode =
    taxaComissao > 0 && relatorioVendedores.length > 0 ? (
      <div className="space-y-4">
        <div
          className="flex items-center justify-between rounded-lg px-4 py-3"
          style={{ background: 'color-mix(in srgb, #16a34a 10%, transparent)', border: '1px solid #16a34a40' }}
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--ac-text)' }}>
            Total de comissões no período
          </span>
          <span className="text-xl font-bold" style={{ color: '#16a34a' }}>
            {fmt(comissaoTotal)}
          </span>
        </div>

        {comissaoPorMes.length > 1 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--ac-border)' }}>
                  <th className="text-left py-2 pr-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                    Mês
                  </th>
                  {relatorioVendedores.map((v, i) => (
                    <th
                      key={v.vendedorId ?? i}
                      className="text-right py-2 px-3 font-semibold text-xs uppercase tracking-wide"
                      style={{ color: 'var(--ac-muted)' }}
                    >
                      {v.vendedorNome}
                    </th>
                  ))}
                  <th className="text-right py-2 pl-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                    Total mês
                  </th>
                </tr>
              </thead>
              <tbody>
                {comissaoPorMes.map((m, i) => (
                  <tr key={m.mes} style={{ borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined }}>
                    <td className="py-2.5 pr-3 font-medium text-xs" style={{ color: 'var(--ac-text)' }}>
                      {m.mesLabel}
                    </td>
                    {relatorioVendedores.map((v, vi) => {
                      const mesData = v.porMes.find((pm) => pm.mes === m.mes)
                      return (
                        <td key={v.vendedorId ?? vi} className="py-2.5 px-3 text-right tabular-nums text-xs" style={{ color: '#16a34a' }}>
                          {mesData ? fmt(mesData.comissao) : '—'}
                        </td>
                      )
                    })}
                    <td className="py-2.5 pl-3 text-right tabular-nums font-bold text-xs" style={{ color: '#16a34a' }}>
                      {fmt(m.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--ac-border)', background: 'var(--ac-bg)' }}>
                  <td className="py-2.5 pr-3 font-bold text-xs" style={{ color: 'var(--ac-text)' }}>
                    Total
                  </td>
                  {relatorioVendedores.map((v, vi) => (
                    <td key={v.vendedorId ?? vi} className="py-2.5 px-3 text-right tabular-nums font-bold text-xs" style={{ color: '#16a34a' }}>
                      {fmt(v.totalComissao)}
                    </td>
                  ))}
                  <td className="py-2.5 pl-3 text-right tabular-nums font-bold text-xs" style={{ color: '#16a34a' }}>
                    {fmt(comissaoTotal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {comissaoPorMes.length <= 1 && (
          <div className="space-y-2">
            {relatorioVendedores.map((v, i) => (
              <div
                key={v.vendedorId ?? i}
                className="flex items-center justify-between rounded-lg px-4 py-3"
                style={{ background: 'var(--ac-bg)', border: '1px solid var(--ac-border)' }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>
                    {v.vendedorNome}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--ac-muted)' }}>
                    {fmtN(v.totalPedidos)} pedidos · {fmt(v.totalValor)} em vendas
                  </p>
                </div>
                <span className="text-lg font-bold" style={{ color: '#16a34a' }}>
                  {fmt(v.totalComissao)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    ) : null

  return (
    <div className="space-y-4 min-w-0">
      <p className="text-xs" style={{ color: 'var(--ac-muted)' }}>
        Resumo do período — abaixo, abra cada bloco para ver detalhes (tabelas e rankings podem ser longos).
      </p>

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

      <CollapseSection
        title="Pipeline de pedidos"
        description="Quantidade e valor por status no período."
        icon={<IconRelatorioPipeline className="size-[18px]" />}
        badge={`${pipeline.length} status`}
      >
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
                  <span className="text-sm font-semibold" style={{ color: st.color }}>
                    {st.label}
                  </span>
                  <span className="text-lg font-bold" style={{ color: st.color }}>
                    {p.quantidade}
                  </span>
                </div>
                <p className="text-xs" style={{ color: st.color }}>
                  {fmt(p.valorTotal)}
                </p>
                <BarHorizontal percentage={p.percentual} color={st.color} height={6} />
                <p className="text-xs text-right" style={{ color: st.color }}>
                  {fmtP(p.percentual)}
                </p>
              </div>
            )
          })}
        </div>
      </CollapseSection>

      {vendasPorMes.length > 0 && (
        <CollapseSection
          title="Vendas por período"
          description="Pedidos, itens e faturamento mês a mês."
          icon={<IconRelatorioCalendario className="size-[18px]" />}
          badge={`${vendasPorMes.length} meses`}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--ac-muted)' }}>
                  <th className="text-left py-2 pr-3 font-medium">
                    Mês
                  </th>
                  <th className="text-right py-2 px-3 font-medium">
                    Pedidos
                  </th>
                  <th className="text-right py-2 px-3 font-medium">
                    Itens
                  </th>
                  <th className="text-right py-2 px-3 font-medium">
                    Faturamento
                  </th>
                  <th className="py-2 pl-3 w-32 font-medium" />
                </tr>
              </thead>
              <tbody>
                {vendasPorMes.map((v) => (
                  <tr key={v.mes} className="border-t" style={{ borderColor: 'var(--ac-border)' }}>
                    <td className="py-2 pr-3 font-medium" style={{ color: 'var(--ac-text)' }}>
                      {v.mesLabel}
                    </td>
                    <td className="py-2 px-3 text-right" style={{ color: 'var(--ac-text)' }}>
                      {fmtN(v.totalPedidos)}
                    </td>
                    <td className="py-2 px-3 text-right" style={{ color: 'var(--ac-text)' }}>
                      {fmtN(v.totalItens)}
                    </td>
                    <td className="py-2 px-3 text-right font-medium" style={{ color: 'var(--ac-text)' }}>
                      {fmt(v.totalValor)}
                    </td>
                    <td className="py-2 pl-3">
                      <BarHorizontal percentage={(v.totalValor / maxMesValor) * 100} height={6} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapseSection>
      )}

      {rankingClientes.length > 0 && (
        <CollapseSection
          title="Top clientes por faturamento"
          description="Participação no faturamento do período."
          icon={<IconRelatorioClientes className="size-[18px]" />}
          badge={rankingClientes.length}
        >
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
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--ac-text)' }}>
                      {c.clienteNome}
                    </span>
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
                  <p className="text-sm font-semibold" style={{ color: 'var(--ac-text)' }}>
                    {fmt(c.totalValor)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--ac-muted)' }}>
                    {fmtP(c.participacao)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CollapseSection>
      )}

      {rankingProdutos.length > 0 && (
        <CollapseSection
          title="Top produtos por faturamento"
          description="Facas mais vendidas em valor no período."
          icon={<IconRelatorioProdutos className="size-[18px]" />}
          badge={rankingProdutos.length}
        >
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
                    <span className="text-xs font-mono" style={{ color: 'var(--ac-muted)' }}>
                      {p.facaCodigo}
                    </span>
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--ac-text)' }}>
                      {p.facaNome}
                    </span>
                  </div>
                  <BarHorizontal percentage={p.participacao} height={5} />
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--ac-text)' }}>
                    {fmt(p.totalValor)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--ac-muted)' }}>
                    {fmtN(p.totalQuantidade)} unid. · {fmtP(p.participacao)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CollapseSection>
      )}

      {vendasPorTipo.length > 0 && (
        <CollapseSection
          title="Vendas por tipo de cliente"
          description="Distribuição entre perfis de cliente."
          icon={<IconRelatorioSegmentos className="size-[18px]" />}
          badge={vendasPorTipo.length}
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {vendasPorTipo.map((v) => (
              <div key={v.tipo} className="rounded-lg border p-3 space-y-2" style={{ borderColor: 'var(--ac-border)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--ac-text)' }}>
                  {v.tipo}
                </p>
                <p className="text-lg font-bold" style={{ color: 'var(--ac-accent)' }}>
                  {fmt(v.totalValor)}
                </p>
                <BarHorizontal percentage={v.percentual} height={6} />
                <div className="flex justify-between text-xs" style={{ color: 'var(--ac-muted)' }}>
                  <span>{v.totalPedidos} pedidos</span>
                  <span>{fmtP(v.percentual)}</span>
                </div>
              </div>
            ))}
          </div>
        </CollapseSection>
      )}

      {relatorioVendedores.length > 0 && (
        <CollapseSection
          title="Relatório por vendedor"
          description="Abra cada vendedor para ver o detalhamento mensal."
          icon={<IconRelatorioClipboardUser className="size-[18px]" />}
          badge={relatorioVendedores.length}
        >
          <div className="space-y-2">
            {relatorioVendedores.map((v, i) => (
              <VendedorRow key={v.vendedorId ?? i} v={v} taxaComissao={taxaComissao} />
            ))}
          </div>
        </CollapseSection>
      )}

      {rankingVendedores.length > 0 && (
        <CollapseSection
          title="Top vendedores por faturamento"
          description="Ranking rápido por valor vendido."
          icon={<IconRelatorioRanking className="size-[18px]" />}
          badge={rankingVendedores.length}
        >
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
                    <span className="text-sm font-medium truncate" style={{ color: 'var(--ac-text)' }}>
                      {v.vendedorNome}
                    </span>
                  </div>
                  <BarHorizontal percentage={v.participacao} height={5} />
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--ac-text)' }}>
                    {fmt(v.totalValor)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--ac-muted)' }}>
                    {fmtP(v.participacao)} · {v.totalPedidos} pedidos
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CollapseSection>
      )}

      {taxaComissao > 0 && relatorioVendedores.length > 0 && (
        <CollapseSection
          title={`Comissões a pagar — taxa ${taxaComissao}%`}
          description="Totais e visão por mês e por vendedor."
          icon={<IconRelatorioComissoes className="size-[18px]" />}
          badge={fmt(comissaoTotal)}
        >
          {comissoesNode}
        </CollapseSection>
      )}
    </div>
  )
}
