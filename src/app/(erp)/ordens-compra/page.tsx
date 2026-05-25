import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getPermissoesEfetivas, getAuthenticatedUser } from '@/lib/auth'
import { getFilaReposicaoList, getOrdensCompra, getUsuariosParaRegistroOC } from '@/lib/actions/ordens-compra'
import { OcClient } from '@/components/ordens-compra/oc-client'
import { OrdensCompraSkeleton } from '@/components/ui/page-skeletons-config'
import { withTiming } from '@/lib/perf/timing'

export const metadata = { title: 'Ordens de Compra — Alma Campeira' }

export default async function OrdensCompraPage() {
  return (
    <Suspense fallback={<OrdensCompraSkeleton />}>
      <OrdensCompraPageData />
    </Suspense>
  )
}

async function OrdensCompraPageData() {
  return withTiming('page:/ordens-compra (data)', async () => {
    const [perms, user] = await Promise.all([
      getPermissoesEfetivas(),
      getAuthenticatedUser(),
    ])
    if (!perms.ordens_compra.ver) redirect('/')
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
  })
}
