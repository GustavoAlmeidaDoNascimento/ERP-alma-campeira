import { getPermissoesEfetivas } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Relatórios — Alma Campeira' }

/** Rota antiga: conciliação foi unificada ao painel de relatórios. */
export default async function MetricasConciliacaoPageRedirect() {
  const perms = await getPermissoesEfetivas()
  if (!perms.metricas.ver) redirect('/')
  redirect('/metricas/relatorios')
}
