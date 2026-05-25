import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getConsumiveis } from '@/lib/actions/consumiveis'
import { getFornecedores } from '@/lib/actions/fornecedores'
import { getCategoriasConsumivel } from '@/lib/actions/categorias-consumivel'
import { getPermissoesEfetivas } from '@/lib/auth'
import { ConsumivelClient } from '@/components/consumiveis/consumivel-client'
import { ConsumiveisSkeleton } from '@/components/ui/page-skeletons-config'

export const metadata = { title: 'Consumíveis — Alma Campeira' }

export default async function ConsumiveisPage() {
  return (
    <Suspense fallback={<ConsumiveisSkeleton />}>
      <ConsumiveisPageData />
    </Suspense>
  )
}

async function ConsumiveisPageData() {
  const perms = await getPermissoesEfetivas()
  if (!perms.consumiveis.ver) redirect('/')
  const [consumiveis, fornecedores, categoriasConsumivel] = await Promise.all([
    getConsumiveis(120),
    getFornecedores(80),
    getCategoriasConsumivel(),
  ])

  return (
    <div data-nav-content-ready="Consumíveis">
      <ConsumivelClient
        consumiveis={consumiveis}
        fornecedores={fornecedores}
        categoriasConsumivel={categoriasConsumivel}
        perm={perms.consumiveis}
      />
    </div>
  )
}
