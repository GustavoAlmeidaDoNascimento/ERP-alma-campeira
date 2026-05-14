import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getMatériasPrimas } from '@/lib/actions/materias-primas'
import { getFornecedores } from '@/lib/actions/fornecedores'
import { getCategoriasMateriaPrima } from '@/lib/actions/categorias-materia-prima'
import { getPermissoesEfetivas } from '@/lib/auth'
import { MPClient } from '@/components/materias-primas/mp-client'
import { PageShellFallback } from '@/components/layout/page-shell'

export const metadata = { title: 'Matérias-Primas — Alma Campeira' }

export default async function MatériasPrimasPage() {
  return (
    <Suspense fallback={<PageShellFallback />}>
      <MateriasPrimasPageData />
    </Suspense>
  )
}

async function MateriasPrimasPageData() {
  const perms = await getPermissoesEfetivas()
  if (!perms.materias_primas.ver) redirect('/')
  const [materiasPrimas, fornecedores, categoriasMateriaPrima] = await Promise.all([
    getMatériasPrimas(120),
    getFornecedores(80),
    getCategoriasMateriaPrima(),
  ])

  return (
    <div data-nav-content-ready="Matérias-Primas">
      <MPClient
        materiasPrimas={materiasPrimas}
        fornecedores={fornecedores}
        categoriasMateriaPrima={categoriasMateriaPrima}
        perm={perms.materias_primas}
      />
    </div>
  )
}
