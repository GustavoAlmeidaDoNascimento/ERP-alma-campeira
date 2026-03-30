import { getMetricasVendas } from '@/lib/actions/metricas'
import { MetricasClient } from '@/components/metricas/metricas-client'

export const metadata = { title: 'Métricas — Alma Campeira' }

export default async function MetricasPage() {
  const data = await getMetricasVendas()
  return (
    <div data-nav-content-ready="Métricas">
      <MetricasClient initialTab="vendas" vendasData={data} />
    </div>
  )
}
