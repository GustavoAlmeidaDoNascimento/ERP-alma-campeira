import { getPermissoesEfetivas } from '@/lib/auth'
import { redirect } from 'next/navigation'

export const metadata = { title: 'Relatórios — Alma Campeira' }

export default async function MetricasEstoquePageRedirect() {
  const perms = await getPermissoesEfetivas()
  if (!perms.metricas.ver) redirect('/')
  redirect('/metricas/relatorios')
}
