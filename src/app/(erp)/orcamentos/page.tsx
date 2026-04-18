import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getOrcamentos } from '@/lib/actions/orcamentos'
import { getClientes } from '@/lib/actions/clientes'
import { getFacas } from '@/lib/actions/facas'
import { getUsuariosPerfisList } from '@/lib/actions/usuarios'
import { getPermissoesEfetivas } from '@/lib/auth'
import { OrcamentosClient } from '@/components/orcamentos/orcamentos-client'
import { PageShellFallback, PageShellTitle } from '@/components/layout/page-shell'

export const metadata = { title: 'Orçamentos — Alma Campeira' }

export default async function OrcamentosPage() {
  return (
    <>
      <PageShellTitle title="Orçamentos" subtitle="Carregando dados de orçamentos..." />
      <Suspense fallback={<PageShellFallback />}>
        <OrcamentosPageData />
      </Suspense>
    </>
  )
}

async function OrcamentosPageData() {
  const perms = await getPermissoesEfetivas()
  const permOrc = (perms as Record<string, { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }>).orcamentos
  if (!permOrc?.ver) redirect('/')

  const [orcamentos, clientes, facas, usuarios] = await Promise.all([
    getOrcamentos(80),
    getClientes(80),
    getFacas(120),
    getUsuariosPerfisList(),
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
      />
    </div>
  )
}
