import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getUsuarios } from '@/lib/actions/usuarios'
import { getCargos } from '@/lib/actions/cargos'
import { getPermissoesEfetivas } from '@/lib/auth'
import { UsuariosClient } from '@/components/usuarios/usuarios-client'
import { UsuariosSkeleton } from '@/components/ui/page-skeletons-config'

export const metadata = { title: 'Usuários — Alma Campeira' }

export default async function UsuariosPage() {
  return (
    <Suspense fallback={<UsuariosSkeleton />}>
      <UsuariosPageData />
    </Suspense>
  )
}

async function UsuariosPageData() {
  const perms = await getPermissoesEfetivas()
  if (!perms.usuarios.ver) redirect('/')
  const [usuarios, cargos] = await Promise.all([getUsuarios(120), getCargos(80)])
  return (
    <div data-nav-content-ready="Usuários">
      <UsuariosClient usuarios={usuarios} cargos={cargos} perm={perms.usuarios} />
    </div>
  )
}
