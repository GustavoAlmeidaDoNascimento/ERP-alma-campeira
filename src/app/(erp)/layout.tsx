import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { ErpTabsProvider } from '@/components/layout/erp-tabs'
import { PermissoesVerProvider } from '@/components/layout/permissoes-provider'
import { QueryProvider } from '@/lib/query/provider'
import { RealtimeProvider } from '@/lib/realtime/provider'
import { getAuthenticatedUser, getPermissoesEfetivas } from '@/lib/auth'
import { permissoesParaVer } from '@/lib/permissoes-ver'

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthenticatedUser()

  if (!user) redirect('/login')

  const perms = await getPermissoesEfetivas()
  const permVer = permissoesParaVer(perms)

  return (
    <div className="min-h-screen" style={{ background: 'var(--ac-bg)' }}>
      <QueryProvider>
        <RealtimeProvider>
          <ErpTabsProvider>
            <PermissoesVerProvider permVer={permVer}>
              <Sidebar />
              <main style={{ marginLeft: 'var(--ac-sidebar-w)' }} className="min-h-screen">
                {children}
              </main>
            </PermissoesVerProvider>
          </ErpTabsProvider>
        </RealtimeProvider>
      </QueryProvider>
    </div>
  )
}
