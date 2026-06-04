import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getFornecedores } from '@/lib/actions/fornecedores'
import { getPermissoesEfetivas } from '@/lib/auth'
import { FornecedoresClient } from '@/components/fornecedores/fornecedores-client'
import { FornecedoresSkeleton } from '@/components/ui/page-skeletons-config'

export const metadata = { title: 'Fornecedores — Alma Campeira' }

export default async function FornecedoresPage() {
  return (
    <Suspense fallback={<FornecedoresSkeleton />}>
      <FornecedoresPageData />
    </Suspense>
  )
}

async function FornecedoresPageData() {
  const perms = await getPermissoesEfetivas()
  if (!perms.fornecedores.ver) redirect('/')
  const fornecedores = await getFornecedores(120)
  return (
    <div data-nav-content-ready="Fornecedores">
      <FornecedoresClient
        fornecedores={fornecedores}
        perm={perms.fornecedores}
        podeVerOrdensCompra={perms.ordens_compra.ver}
      />
    </div>
  )
}
