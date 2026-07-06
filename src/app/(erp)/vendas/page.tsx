import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getVendas } from '@/lib/actions/vendas'
import { getClientes } from '@/lib/actions/clientes'
import { getFacasCatalogoList } from '@/lib/actions/facas'
import { getUsuariosPerfisList } from '@/lib/actions/usuarios'
import { getAuthenticatedUser, getPermissoesEfetivas } from '@/lib/auth'
import { VendasClient } from '@/components/vendas/vendas-client'
import { VendasSkeleton } from '@/components/ui/page-skeletons-config'

export const metadata = { title: 'Vendas — Alma Campeira' }

export default async function VendasPage() {
  return (
    <Suspense fallback={<VendasSkeleton />}>
      <VendasPageData />
    </Suspense>
  )
}

async function VendasPageData() {
  const perms = await getPermissoesEfetivas()
  if (!perms.vendas.ver) redirect('/')
  const [pedidos, clientes, facas, usuarios, authUser] = await Promise.all([
    getVendas(80),
    getClientes(80),
    getFacasCatalogoList(120),
    getUsuariosPerfisList(),
    getAuthenticatedUser(),
  ])

  return (
    <div data-nav-content-ready="Vendas">
      <VendasClient
        pedidos={pedidos}
        clientes={clientes}
        facas={facas}
        usuarios={usuarios}
        perm={perms.vendas}
        usuarioLogadoId={authUser?.id ?? null}
      />
    </div>
  )
}
