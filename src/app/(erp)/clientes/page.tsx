import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getClientes } from '@/lib/actions/clientes'
import { getPermissoesEfetivas } from '@/lib/auth'
import { ClientesClient } from '@/components/clientes/clientes-client'
import { PageShellFallback } from '@/components/layout/page-shell'

export const metadata = { title: 'Clientes — Alma Campeira' }

export default async function ClientesPage() {
  return (
    <Suspense fallback={<PageShellFallback />}>
      <ClientesPageData />
    </Suspense>
  )
}

async function ClientesPageData() {
  const perms = await getPermissoesEfetivas()
  if (!perms.clientes.ver) redirect('/')
  const clientes = await getClientes(120)
  return (
    <div data-nav-content-ready="Clientes">
      <ClientesClient clientes={clientes} perm={perms.clientes} />
    </div>
  )
}
