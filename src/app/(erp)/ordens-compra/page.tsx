import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getPermissoesEfetivas } from '@/lib/auth'
import { getFilaReposicao, getOrdensCompra } from '@/lib/actions/ordens-compra'
import { OcClient } from '@/components/ordens-compra/oc-client'
import { PageShellFallback, PageShellTitle } from '@/components/layout/page-shell'

export const metadata = { title: 'Ordens de Compra — Alma Campeira' }

export default async function OrdensCompraPage() {
  return (
    <>
      <PageShellTitle title="Ordens de Compra" subtitle="Carregando fila de reposição e histórico..." />
      <Suspense fallback={<PageShellFallback />}>
        <OrdensCompraPageData />
      </Suspense>
    </>
  )
}

async function OrdensCompraPageData() {
  const perms = await getPermissoesEfetivas()
  if (!perms.ordens_compra.ver) redirect('/')
  const [fila, ordens] = await Promise.all([getFilaReposicao(), getOrdensCompra()])

  return (
    <div data-nav-content-ready="Ordens de Compra">
      <OcClient
        fila={fila}
        ordens={ordens}
        perm={perms.ordens_compra}
      />
    </div>
  )
}
