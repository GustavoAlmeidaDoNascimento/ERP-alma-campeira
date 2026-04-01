import { getMetricasEstoque } from '@/lib/actions/metricas'
import { MetricasClient } from '@/components/metricas/metricas-client'
import { getPermissoesEfetivas } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Métricas de Estoque — Alma Campeira' }

export default async function MetricasEstoquePage() {
  const perms = await getPermissoesEfetivas()
  if (!perms.metricas.ver) redirect('/')
  const data = await getMetricasEstoque()
  return (
    <div data-nav-content-ready="Métricas de Estoque">
      <MetricasClient initialTab="estoque" estoqueData={data} />
    </div>
  )
}
