import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getCargos } from '@/lib/actions/cargos'
import { getPermissoesEfetivas } from '@/lib/auth'
import { CargosClient } from '@/components/cargos/cargos-client'
import { PageShellFallback } from '@/components/layout/page-shell'

export const metadata = { title: 'Cargos — Alma Campeira' }

export default async function CargosPage() {
  return (
    <Suspense fallback={<PageShellFallback />}>
      <CargosPageData />
    </Suspense>
  )
}

async function CargosPageData() {
  const perms = await getPermissoesEfetivas()
  if (!perms.cargos.ver) redirect('/')
  const cargos = await getCargos(120)
  return (
    <div data-nav-content-ready="Cargos">
      <CargosClient cargos={cargos} perm={perms.cargos} />
    </div>
  )
}
