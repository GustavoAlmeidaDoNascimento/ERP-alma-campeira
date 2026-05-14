import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getFornecedores } from '@/lib/actions/fornecedores'
import { getPermissoesEfetivas } from '@/lib/auth'
import { FornecedoresClient } from '@/components/fornecedores/fornecedores-client'
import { PageShellFallback } from '@/components/layout/page-shell'

export const metadata = { title: 'Fornecedores — Alma Campeira' }

export default async function FornecedoresPage() {
  return (
    <Suspense fallback={<PageShellFallback />}>
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
      <FornecedoresClient fornecedores={fornecedores} perm={perms.fornecedores} />
    </div>
  )
}
