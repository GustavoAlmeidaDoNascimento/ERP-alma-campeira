import { getMetricasEstoque } from '@/lib/actions/metricas'
import { MetricasClient } from '@/components/metricas/metricas-client'

export const metadata = { title: 'Métricas de Estoque — Alma Campeira' }

export default async function MetricasEstoquePage() {
  const data = await getMetricasEstoque()
  return (
    <div data-nav-content-ready="Métricas de Estoque">
      <MetricasClient initialTab="estoque" estoqueData={data} />
    </div>
  )
}
