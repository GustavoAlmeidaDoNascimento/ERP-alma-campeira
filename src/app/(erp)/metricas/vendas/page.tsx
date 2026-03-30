import { getMetricasVendas } from '@/lib/actions/metricas'
import { MetricasClient } from '@/components/metricas/metricas-client'

export const metadata = { title: 'Métricas de Vendas — Alma Campeira' }

export default async function MetricasVendasPage() {
  const data = await getMetricasVendas()
  return (
    <div data-nav-content-ready="Métricas de Vendas">
      <MetricasClient initialTab="vendas" vendasData={data} />
    </div>
  )
}
