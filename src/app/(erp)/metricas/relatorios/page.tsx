import { getMetricasEstoque, getMetricasVendas, getMetricasFinanceiro } from '@/lib/actions/metricas'
import { MetricasClient } from '@/components/metricas/metricas-client'
import { getPermissoesEfetivas } from '@/lib/auth'
import { defaultDateRange } from '@/lib/metricas-periodos'
import {
  getAuditLogs,
  getAuditLogTabelas,
  getAuditLogUsuarios,
} from '@/lib/actions/auditoria'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Relatórios — Alma Campeira' }

export default async function MetricasRelatoriosPage() {
  const perms = await getPermissoesEfetivas()
  if (!perms.metricas.ver) redirect('/')
  const range = defaultDateRange()
  const [vendas, estoque, financeiro, auditoria, tabelas, usuarios] = await Promise.all([
    getMetricasVendas(range),
    getMetricasEstoque(range),
    getMetricasFinanceiro(range),
    getAuditLogs({ limit: 100 }),
    getAuditLogTabelas(),
    getAuditLogUsuarios(),
  ])
  return (
    <div data-nav-content-ready="Relatórios">
      <MetricasClient
        vendasData={vendas}
        estoqueData={estoque}
        financeiroData={financeiro}
        atividadeData={{
          logs: auditoria.logs,
          total: auditoria.total,
          tabelas,
          usuarios,
        }}
      />
    </div>
  )
}
