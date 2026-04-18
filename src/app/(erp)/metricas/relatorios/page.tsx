import { getMetricasEstoque, getMetricasVendas } from '@/lib/actions/metricas'
import { MetricasClient } from '@/components/metricas/metricas-client'
import { getPermissoesEfetivas } from '@/lib/auth'
import { defaultDateRange } from '@/lib/metricas-periodos'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Relatórios — Alma Campeira' }

export default async function MetricasRelatoriosPage() {
  const perms = await getPermissoesEfetivas()
  if (!perms.metricas.ver) redirect('/')
  const range = defaultDateRange()
  const [vendas, estoque] = await Promise.all([getMetricasVendas(range), getMetricasEstoque(range)])
  return (
    <div data-nav-content-ready="Relatórios">
      <MetricasClient vendasData={vendas} estoqueData={estoque} />
    </div>
  )
}
