import { getMetricasVendas } from '@/lib/actions/metricas'
import { MetricasClient } from '@/components/metricas/metricas-client'
import { getPermissoesEfetivas } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Métricas — Alma Campeira' }

export default async function MetricasPage() {
  const perms = await getPermissoesEfetivas()
  if (!perms.metricas.ver) redirect('/')
  const data = await getMetricasVendas()
  return (
    <div data-nav-content-ready="Métricas">
      <MetricasClient initialTab="vendas" vendasData={data} />
    </div>
  )
}
