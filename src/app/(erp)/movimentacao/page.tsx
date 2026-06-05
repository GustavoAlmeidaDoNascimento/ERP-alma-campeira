import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { listarMovimentacoes } from '@/lib/actions/movimentacao'
import { listarTiposGasto } from '@/lib/actions/tipos-gasto'
import { getUsuariosPerfisList } from '@/lib/actions/usuarios'
import { getPermissoesEfetivas, getAuthenticatedUser } from '@/lib/auth'
import { MovimentacaoClient } from '@/components/movimentacao/movimentacao-client'
import { MovimentacaoSkeleton } from '@/components/ui/page-skeletons-config'

export const metadata = { title: 'Movimentação — Alma Campeira' }

export default async function MovimentacaoPage() {
  return (
    <Suspense fallback={<MovimentacaoSkeleton />}>
      <MovimentacaoPageData />
    </Suspense>
  )
}

async function MovimentacaoPageData() {
  const perms = await getPermissoesEfetivas()
  if (!perms.gastos.ver) redirect('/')
  const [movimentacoes, tiposGasto, usuarios, authUser] = await Promise.all([
    listarMovimentacoes(),
    listarTiposGasto(),
    getUsuariosPerfisList(),
    getAuthenticatedUser(),
  ])
  return (
    <div data-nav-content-ready="Movimentação">
      <MovimentacaoClient
        movimentacoes={movimentacoes}
        tiposGasto={tiposGasto}
        usuarios={usuarios}
        usuarioLogadoId={authUser?.id ?? null}
        perm={perms.gastos}
      />
    </div>
  )
}
