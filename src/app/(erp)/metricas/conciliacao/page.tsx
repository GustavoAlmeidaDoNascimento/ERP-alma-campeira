import { getConciliacao } from '@/lib/actions/conciliacao'
import { MetricasClient } from '@/components/metricas/metricas-client'
import { getPermissoesEfetivas } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Conciliação — Alma Campeira' }

export default async function MetricasConciliacaoPage() {
  const perms = await getPermissoesEfetivas()
  if (!perms.metricas.ver) redirect('/')
  const data = await getConciliacao()
  return (
    <div data-nav-content-ready="Conciliação">
      <MetricasClient initialTab="conciliacao" conciliacaoData={data} />
    </div>
  )
}
