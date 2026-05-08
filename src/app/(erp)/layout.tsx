import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { ErpTabsProvider } from '@/components/layout/erp-tabs'
import { QueryProvider } from '@/lib/query/provider'
import { RealtimeProvider } from '@/lib/realtime/provider'
import { getAuthenticatedUser } from '@/lib/auth'

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthenticatedUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-screen" style={{ background: 'var(--ac-bg)' }}>
      <QueryProvider>
        <RealtimeProvider>
          <ErpTabsProvider>
            <Sidebar />
            <main style={{ marginLeft: 'var(--ac-sidebar-w)' }} className="min-h-screen">
              {children}
            </main>
          </ErpTabsProvider>
        </RealtimeProvider>
      </QueryProvider>
    </div>
  )
}
