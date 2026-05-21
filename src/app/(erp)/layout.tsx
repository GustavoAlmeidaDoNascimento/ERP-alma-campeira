import { redirect } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { ErpTabsProvider } from '@/components/layout/erp-tabs'
import { PermissoesVerProvider } from '@/components/layout/permissoes-provider'
import { QueryProvider } from '@/lib/query/provider'
import { RealtimeProvider } from '@/lib/realtime/provider'
import { getAuthenticatedUser, getPermissoesEfetivas } from '@/lib/auth'
import { permissoesParaVer } from '@/lib/permissoes-ver'
import {
  fetchMatériasPrimasList,
  fetchFornecedoresFullList,
  fetchFornecedoresSelect,
  fetchCategoriasMateriaPrimaList,
  fetchFacasComCustoList,
  fetchCategoriasFacaList,
  fetchClientesList,
  fetchTaxasLucroConfig,
  fetchOrdensCompraList,
  fetchFilaReposicaoList as fetchFilaReposicaoListCache,
  fetchUsuariosRegistroOC,
} from '@/lib/cache/list-data'

/**
 * Aquece em background as caches das principais listas do ERP. Dispara em paralelo
 * sem aguardar — quando o usuário clica num link da sidebar, o `unstable_cache`
 * já está populado e a primeira hit fica tão rápida quanto as subsequentes.
 *
 * `void` + `.catch(() => {})` para evitar unhandled rejection se uma das queries
 * falhar (a página de destino vai mostrar o erro de verdade, isso aqui é só warmup).
 */
function aquecerListas(userId: string, perms: ReturnType<typeof permissoesParaVer>) {
  const fire = (p: Promise<unknown>) => { p.catch(() => {}) }
  if (perms.materias_primas) {
    fire(fetchMatériasPrimasList(userId))
    fire(fetchCategoriasMateriaPrimaList(userId))
    fire(fetchFornecedoresSelect(userId))
  }
  if (perms.facas) {
    fire(fetchFacasComCustoList(userId))
    fire(fetchCategoriasFacaList(userId))
    fire(fetchTaxasLucroConfig())
  }
  if (perms.fornecedores) fire(fetchFornecedoresFullList(userId))
  if (perms.clientes) fire(fetchClientesList(userId))
  if (perms.ordens_compra) {
    fire(fetchOrdensCompraList(userId))
    fire(fetchFilaReposicaoListCache(userId))
    fire(fetchUsuariosRegistroOC(userId))
  }
}

export default async function ErpLayout({ children }: { children: React.ReactNode }) {
  const user = await getAuthenticatedUser()

  if (!user) redirect('/login')

  const perms = await getPermissoesEfetivas()
  const permVer = permissoesParaVer(perms)

  aquecerListas(user.id, permVer)

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
