import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { listarBoletos } from '@/lib/actions/boletos'
import { getClientes } from '@/lib/actions/clientes'
import { getFornecedores } from '@/lib/actions/fornecedores'
import { getUsuariosPerfisList } from '@/lib/actions/usuarios'
import { getPermissoesEfetivas } from '@/lib/auth'
import { BoletosClient } from '@/components/boletos/boletos-client'
import { BoletosSkeleton } from '@/components/ui/page-skeletons-config'

export const metadata = { title: 'Boletos — Alma Campeira' }

export default async function BoletosPage() {
  return (
    <Suspense fallback={<BoletosSkeleton />}>
      <BoletosPageData />
    </Suspense>
  )
}

async function BoletosPageData() {
  const perms = await getPermissoesEfetivas()
  if (!perms.boletos.ver) redirect('/')
  const [boletos, clientes, fornecedores, usuarios] = await Promise.all([
    listarBoletos(),
    getClientes(200),
    getFornecedores(200),
    getUsuariosPerfisList(),
  ])
  return (
    <div data-nav-content-ready="Boletos">
      <BoletosClient
        boletos={boletos}
        clientes={clientes}
        fornecedores={fornecedores}
        usuarios={usuarios}
        perm={perms.boletos}
      />
    </div>
  )
}
