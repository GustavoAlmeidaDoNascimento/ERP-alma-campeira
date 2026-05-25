import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getFacaDetalhe } from '@/lib/actions/facas'
import { getMatériasPrimas } from '@/lib/actions/materias-primas'
import { getCategoriasFaca } from '@/lib/actions/categorias-faca'
import { getUsuarios } from '@/lib/actions/usuarios'
import { getPermissoesEfetivas, requireAuthenticatedUserId } from '@/lib/auth'
import { FacaDetalheClient } from '@/components/facas/faca-detalhe-client'
import { FacaDetalheSkeleton } from '@/components/ui/page-skeletons-config'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }

export const metadata = { title: 'Faca — Alma Campeira' }

export default async function FacaDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return (
    <Suspense fallback={<FacaDetalheSkeleton />}>
      <FacaDetalhePageData id={id} />
    </Suspense>
  )
}

async function FacaDetalhePageData({ id }: { id: string }) {
  const perms = await getPermissoesEfetivas()
  if (!perms.facas.ver) redirect('/')

  const [detalhe, materiasPrimas, categorias, todosUsuarios, usuarioAtualId] = await Promise.all([
    getFacaDetalhe(id),
    getMatériasPrimas(200),
    getCategoriasFaca(),
    getUsuarios(200),
    requireAuthenticatedUserId(),
  ])

  const usuarios = todosUsuarios.map((u) => ({ id: u.id, nome: u.nome }))
  const perm = perms.facas as Perm
  const permEditarMovAdmin = !!perms.usuarios?.editar

  return (
    <div data-nav-content-ready="Faca">
      <FacaDetalheClient
        detalhe={detalhe}
        materiasPrimas={materiasPrimas}
        categorias={categorias}
        perm={perm}
        verPrecoVenda={perms.preco_venda.ver}
        usuarios={usuarios}
        usuarioAtualId={usuarioAtualId}
        permEditarMovAdmin={permEditarMovAdmin}
      />
    </div>
  )
}
