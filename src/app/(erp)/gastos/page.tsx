import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { listarGastos } from '@/lib/actions/gastos'
import { getUsuariosPerfisList } from '@/lib/actions/usuarios'
import { getPermissoesEfetivas, getAuthenticatedUser } from '@/lib/auth'
import { GastosClient } from '@/components/gastos/gastos-client'
import { GastosSkeleton } from '@/components/ui/page-skeletons-config'

export const metadata = { title: 'Gastos — Alma Campeira' }

export default async function GastosPage() {
  return (
    <Suspense fallback={<GastosSkeleton />}>
      <GastosPageData />
    </Suspense>
  )
}

async function GastosPageData() {
  const perms = await getPermissoesEfetivas()
  if (!perms.gastos.ver) redirect('/')
  const [gastos, usuarios, authUser] = await Promise.all([
    listarGastos(),
    getUsuariosPerfisList(),
    getAuthenticatedUser(),
  ])
  return (
    <div data-nav-content-ready="Gastos">
      <GastosClient
        gastos={gastos}
        usuarios={usuarios}
        usuarioLogadoId={authUser?.id ?? null}
        perm={perms.gastos}
      />
    </div>
  )
}
