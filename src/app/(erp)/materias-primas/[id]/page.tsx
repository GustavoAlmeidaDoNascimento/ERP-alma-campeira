import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getMPDetalhe } from '@/lib/actions/materias-primas'
import { getPermissoesEfetivas } from '@/lib/auth'
import { MPDetalheClient } from '@/components/materias-primas/mp-detalhe-client'
import { MateriaPrimaDetalheSkeleton } from '@/components/ui/page-skeletons-config'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }

export const metadata = { title: 'Matéria-Prima — Alma Campeira' }

export default async function MateriaPrimaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense fallback={<MateriaPrimaDetalheSkeleton />}>
      <MateriaPrimaDetalhePageData id={id} />
    </Suspense>
  )
}

async function MateriaPrimaDetalhePageData({ id }: { id: string }) {
  const perms = await getPermissoesEfetivas()
  if (!perms.materias_primas.ver) redirect('/')

  const detalhe = await getMPDetalhe(id)

  const perm = perms.materias_primas as Perm
  const permEditarMov = !!perms.movimentacoes_estoque?.editar
  const permVerMov = !!perms.movimentacoes_estoque?.ver

  return (
    <div data-nav-content-ready="Matéria-Prima">
      <MPDetalheClient
        detalhe={detalhe}
        perm={perm}
        permEditarMov={permEditarMov}
        permVerMov={permVerMov}
      />
    </div>
  )
}
