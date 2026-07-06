import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getMatériasPrimas } from '@/lib/actions/materias-primas'
import { getPermissoesEfetivas } from '@/lib/auth'
import { MPClient } from '@/components/materias-primas/mp-client'
import { MateriasPrimasSkeleton } from '@/components/ui/page-skeletons-config'

export const metadata = { title: 'Matérias-Primas — Alma Campeira' }

export default async function MatériasPrimasPage() {
  return (
    <Suspense fallback={<MateriasPrimasSkeleton />}>
      <MateriasPrimasPageData />
    </Suspense>
  )
}

async function MateriasPrimasPageData() {
  const perms = await getPermissoesEfetivas()
  if (!perms.materias_primas.ver) redirect('/')
  const materiasPrimas = await getMatériasPrimas()

  return (
    <div data-nav-content-ready="Matérias-Primas">
      <MPClient materiasPrimas={materiasPrimas} perm={perms.materias_primas} />
    </div>
  )
}
