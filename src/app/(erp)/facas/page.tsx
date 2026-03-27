import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getFacas } from '@/lib/actions/facas'
import { getCategoriasFaca } from '@/lib/actions/categorias-faca'
import { getMatériasPrimas } from '@/lib/actions/materias-primas'
import { getPermissoesEfetivas } from '@/lib/auth'
import { FacasClient } from '@/components/facas/facas-client'
import { PageShellFallback, PageShellTitle } from '@/components/layout/page-shell'

export const metadata = { title: 'Facas — Alma Campeira' }

export default async function FacasPage() {
  return (
    <>
      <PageShellTitle title="Facas" subtitle="Carregando facas e categorias..." />
      <Suspense fallback={<PageShellFallback />}>
        <FacasPageData />
      </Suspense>
    </>
  )
}

async function FacasPageData() {
  const perms = await getPermissoesEfetivas()
  if (!perms.facas.ver) redirect('/')
  const [facas, categorias, materiasPrimas] = await Promise.all([getFacas(120), getCategoriasFaca(), getMatériasPrimas(200)])
  return (
    <div data-nav-content-ready="Facas">
      <FacasClient facas={facas} categorias={categorias} materiasPrimas={materiasPrimas} perm={perms.facas} />
    </div>
  )
}
