import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getPermissoesEfetivas, getAuthenticatedUser } from '@/lib/auth'
import { getFilaReposicaoList, getOrdensCompra, getUsuariosParaRegistroOC } from '@/lib/actions/ordens-compra'
import { OcClient } from '@/components/ordens-compra/oc-client'
import { PageShellFallback } from '@/components/layout/page-shell'

export const metadata = { title: 'Ordens de Compra — Alma Campeira' }

export default async function OrdensCompraPage() {
  return (
    <Suspense fallback={<PageShellFallback />}>
      <OrdensCompraPageData />
    </Suspense>
  )
}

async function OrdensCompraPageData() {
  const perms = await getPermissoesEfetivas()
  if (!perms.ordens_compra.ver) redirect('/')
  const user = await getAuthenticatedUser()
  const [fila, ordens, usuariosRegistro] = await Promise.all([
    getFilaReposicaoList(),
    getOrdensCompra(),
    perms.ordens_compra.editar ? getUsuariosParaRegistroOC() : Promise.resolve([]),
  ])

  return (
    <div data-nav-content-ready="Ordens de Compra">
      <OcClient
        fila={fila}
        ordens={ordens}
        perm={perms.ordens_compra}
        usuarioLogadoId={user?.id ?? null}
        usuariosRegistroInicial={usuariosRegistro}
      />
    </div>
  )
}
