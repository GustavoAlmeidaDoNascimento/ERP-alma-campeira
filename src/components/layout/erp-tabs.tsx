'use client'

/**
 * Shim de compatibilidade do antigo sistema de abas customizado.
 *
 * O motor real foi removido — agora a navegação usa o router nativo do Next.js
 * e os dados vivem no cache do TanStack Query (com Realtime invalidando entre
 * abas/sessões automaticamente).
 *
 * Este arquivo mantém a API pública (`useErpTabs`, `ErpTabsProvider`, `ErpTabs`)
 * para os ~19 componentes que ainda chamam `refreshActiveTab()` / `openTab()`,
 * sem precisar refatorar todos de uma vez.
 *
 * - `openTab(href)` → `router.push(href)`
 * - `refreshActiveTab()` / `refreshTab()` → invalida TODAS as queries
 *   (forçando refetch imediato após mutações locais) + `router.refresh()`
 * - `activeHref` → `usePathname()`
 */

import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'

type OpenTab = { href: string; label: string }

type ErpTabsContextValue = {
  openTabs: OpenTab[]
  activeHref: string
  openTab: (href: string) => void
  selectTab: (href: string) => void
  closeTab: (href: string) => void
  reorderTabs: (fromHref: string, toHref: string) => void
  updateTabLabel: (href: string, label: string) => void
  refreshActiveTab: () => void
  refreshTab: (href: string) => void
  tabRefreshSeq: Record<string, number>
}

const ErpTabsContext = createContext<ErpTabsContextValue | null>(null)

export function useErpTabs(): ErpTabsContextValue {
  const ctx = useContext(ErpTabsContext)
  if (!ctx) throw new Error('useErpTabs deve ser usado dentro de ErpTabsProvider.')
  return ctx
}

export function ErpTabsProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname() || '/'
  const queryClient = useQueryClient()

  const openTab = useCallback(
    (href: string) => {
      router.push(href)
    },
    [router],
  )

  /**
   * Após mutação local, invalida tudo (refetch imediato) e dá um `router.refresh()`
   * para revalidar o RSC. O Realtime do Supabase também vai disparar invalidações
   * em outras abas — isto aqui é só para a aba que originou a mutação responder
   * sem esperar o WebSocket.
   */
  const refreshActiveTab = useCallback(() => {
    queryClient.invalidateQueries()
    router.refresh()
  }, [router, queryClient])

  const refreshTab = useCallback(
    (_href: string) => {
      queryClient.invalidateQueries()
      router.refresh()
    },
    [router, queryClient],
  )

  const noop = useCallback(() => {}, [])

  const value = useMemo<ErpTabsContextValue>(
    () => ({
      openTabs: [{ href: pathname, label: pathname }],
      activeHref: pathname,
      openTab,
      selectTab: openTab,
      closeTab: noop,
      reorderTabs: noop,
      updateTabLabel: noop,
      refreshActiveTab,
      refreshTab,
      tabRefreshSeq: {},
    }),
    [pathname, openTab, noop, refreshActiveTab, refreshTab],
  )

  return <ErpTabsContext.Provider value={value}>{children}</ErpTabsContext.Provider>
}

/**
 * Antigo container de abas — agora apenas renderiza children (o conteúdo da rota).
 * Mantido como export para não quebrar imports legados.
 */
export function ErpTabs({ children }: { children?: ReactNode }) {
  return <>{children}</>
}
