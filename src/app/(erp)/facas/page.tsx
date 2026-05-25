import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getFacas } from '@/lib/actions/facas'
import { getCategoriasFaca } from '@/lib/actions/categorias-faca'
import { getPermissoesEfetivas } from '@/lib/auth'
import { getTaxasLucroConfig } from '@/lib/actions/app-config'
import { FacasClient } from '@/components/facas/facas-client'
import { FacasSkeleton } from '@/components/ui/page-skeletons-config'

export const metadata = { title: 'Facas — Alma Campeira' }

export default async function FacasPage() {
  return (
    <Suspense fallback={<FacasSkeleton />}>
      <FacasPageData />
    </Suspense>
  )
}

async function FacasPageData() {
  const perms = await getPermissoesEfetivas()
  if (!perms.facas.ver) redirect('/')
  const verLucro = perms.lucro.ver
  // Caminho crítico: apenas o necessário pra renderizar a tabela. `materiasPrimas`
  // só é usada no modal de edição, então cai fora do bloqueio — o hook
  // `useMateriasPrimas` busca via React Query quando o componente monta (cache
  // do unstable_cache já está populado pelo prefetch do ErpLayout).
  const [facas, categorias, taxasLucro] = await Promise.all([
    getFacas(120),
    getCategoriasFaca(),
    verLucro
      ? getTaxasLucroConfig()
      : Promise.resolve({ taxa_producao: 0, margem_lucro: 0, taxa_comissao: 0 }),
  ])
  return (
    <div data-nav-content-ready="Facas">
      <FacasClient
        facas={facas}
        categorias={categorias}
        materiasPrimas={undefined}
        perm={perms.facas}
        verPrecoVenda={perms.preco_venda.ver}
        verLucro={verLucro}
        taxasLucro={taxasLucro}
      />
    </div>
  )
}
