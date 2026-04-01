import { Suspense } from 'react'
import { ConfiguracoesClient } from '@/components/configuracoes/configuracoes-client'
import { getCategoriasFaca } from '@/lib/actions/categorias-faca'
import { getCategoriasMateriaPrima } from '@/lib/actions/categorias-materia-prima'
import { getCategoriasConsumivel } from '@/lib/actions/categorias-consumivel'
import { PageShellFallback, PageShellTitle } from '@/components/layout/page-shell'

export const metadata = { title: 'Configurações — Alma Campeira' }

export default async function ConfiguracoesPage() {
  return (
    <>
      <PageShellTitle title="Configurações" subtitle="Carregando preferências do sistema..." />
      <Suspense fallback={<PageShellFallback />}>
        <ConfiguracoesPageData />
      </Suspense>
    </>
  )
}

async function ConfiguracoesPageData() {
  const [categorias, categoriasMateriaPrima, categoriasConsumivel] = await Promise.all([
    getCategoriasFaca(),
    getCategoriasMateriaPrima(),
    getCategoriasConsumivel(),
  ])
  return (
    <div data-nav-content-ready="Configurações">
      <ConfiguracoesClient
        categorias={categorias}
        categoriasMateriaPrima={categoriasMateriaPrima}
        categoriasConsumivel={categoriasConsumivel}
      />
    </div>
  )
}
