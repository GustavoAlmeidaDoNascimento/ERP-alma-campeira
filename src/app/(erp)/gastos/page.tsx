import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { listarGastos } from '@/lib/actions/gastos'
import { getUsuariosPerfisList } from '@/lib/actions/usuarios'
import { getPermissoesEfetivas, getAuthenticatedUser } from '@/lib/auth'
import { GastosClient } from '@/components/gastos/gastos-client'
import { PageShellFallback, PageShellTitle } from '@/components/layout/page-shell'

export const metadata = { title: 'Gastos — Alma Campeira' }

export default async function GastosPage() {
  return (
    <>
      <PageShellTitle title="Gastos" subtitle="Carregando lançamentos..." />
      <Suspense fallback={<PageShellFallback />}>
        <GastosPageData />
      </Suspense>
    </>
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
