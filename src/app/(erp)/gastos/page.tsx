import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { listarGastos } from '@/lib/actions/gastos'
import { getPermissoesEfetivas } from '@/lib/auth'
import { GastosClient } from '@/components/gastos/gastos-client'
import { PageShellFallback, PageShellTitle } from '@/components/layout/page-shell'

export const metadata = { title: 'Gastos — Alma Campeira' }

export default async function GastosPage() {
  return (
    <>
      <PageShellTitle title="Gastos" subtitle="Carregando lançamentos..." />
      <Suspense fallback={<PageShellFallback />}>
        <GastosPageData />
      </Suspense>
    </>
  )
}

async function GastosPageData() {
  const perms = await getPermissoesEfetivas()
  if (!perms.gastos.ver) redirect('/')
  const gastos = await listarGastos()
  return (
    <div data-nav-content-ready="Gastos">
      <GastosClient gastos={gastos} perm={perms.gastos} />
    </div>
  )
}
