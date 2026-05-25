import { Suspense } from 'react'
import { ConfiguracoesClient } from '@/components/configuracoes/configuracoes-client'
import { getCategoriasFaca } from '@/lib/actions/categorias-faca'
import { getCategoriasMateriaPrima } from '@/lib/actions/categorias-materia-prima'
import { getCategoriasConsumivel } from '@/lib/actions/categorias-consumivel'
import { getTaxasLucroConfig } from '@/lib/actions/app-config'
import { getEmpresa } from '@/lib/actions/empresa'
import { getPermissoesEfetivas } from '@/lib/auth'
import { ConfiguracoesSkeleton } from '@/components/ui/page-skeletons-config'

export const metadata = { title: 'Configurações — Alma Campeira' }

export default async function ConfiguracoesPage() {
  return (
    <Suspense fallback={<ConfiguracoesSkeleton />}>
      <ConfiguracoesPageData />
    </Suspense>
  )
}

async function ConfiguracoesPageData() {
  const [perms, categorias, categoriasMateriaPrima, categoriasConsumivel, taxasLucro, empresa] = await Promise.all([
    getPermissoesEfetivas(),
    getCategoriasFaca(),
    getCategoriasMateriaPrima(),
    getCategoriasConsumivel(),
    getTaxasLucroConfig(),
    getEmpresa().catch(() => null),
  ])
  return (
    <div data-nav-content-ready="Configurações">
      <ConfiguracoesClient
        categorias={categorias}
        categoriasMateriaPrima={categoriasMateriaPrima}
        categoriasConsumivel={categoriasConsumivel}
        taxasLucro={taxasLucro}
        permTaxasLucro={perms.taxas_lucro}
        empresa={empresa}
      />
    </div>
  )
}
