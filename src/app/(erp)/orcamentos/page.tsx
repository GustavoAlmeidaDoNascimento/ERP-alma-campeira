import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getOrcamentos } from '@/lib/actions/orcamentos'
import { getClientes } from '@/lib/actions/clientes'
import { getFacasCatalogoList } from '@/lib/actions/facas'
import { getUsuariosPerfisList } from '@/lib/actions/usuarios'
import { getAuthenticatedUser, getPermissoesEfetivas } from '@/lib/auth'
import { OrcamentosClient } from '@/components/orcamentos/orcamentos-client'
import { OrcamentosSkeleton } from '@/components/ui/page-skeletons-config'

export const metadata = { title: 'Orçamentos — Alma Campeira' }

export default async function OrcamentosPage() {
  return (
    <Suspense fallback={<OrcamentosSkeleton />}>
      <OrcamentosPageData />
    </Suspense>
  )
}

async function OrcamentosPageData() {
  const perms = await getPermissoesEfetivas()
  const permOrc = (perms as Record<string, { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }>).orcamentos
  if (!permOrc?.ver) redirect('/')

  const [orcamentos, clientes, facas, usuarios, authUser] = await Promise.all([
    getOrcamentos(80),
    getClientes(80),
    getFacasCatalogoList(120),
    getUsuariosPerfisList(),
    getAuthenticatedUser(),
  ])

  return (
    <div data-nav-content-ready="Orçamentos">
      <OrcamentosClient
        orcamentos={orcamentos}
        clientes={clientes}
        facas={facas}
        usuarios={usuarios}
        perm={permOrc}
        permVendasCriar={!!perms.vendas?.criar}
        usuarioLogadoId={authUser?.id ?? null}
      />
    </div>
  )
}
