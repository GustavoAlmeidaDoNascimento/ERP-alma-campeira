'use client'

import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback } from 'react'

import {
  getQueryKeysForResources,
  getResourcesForPath,
  type RealtimeResource,
} from '@/lib/realtime/resources'

const BROADCAST_NAME = 'erp-sync'

type InvalidateAllMessage = { type: 'invalidate-all' }
type InvalidateResourcesMessage = {
  type: 'invalidate-resources'
  resources: RealtimeResource[]
}

export type RealtimeBroadcastMessage = InvalidateAllMessage | InvalidateResourcesMessage

export async function invalidateResourceQueries(
  queryClient: QueryClient,
  resources: ReadonlyArray<RealtimeResource>,
) {
  const keys = getQueryKeysForResources(resources)

  await Promise.allSettled(
    keys.map((queryKey) =>
      queryClient.invalidateQueries({
        queryKey,
      }),
    ),
  )
}

export function broadcastResourceInvalidation(resources: ReadonlyArray<RealtimeResource>) {
  if (resources.length === 0) return

  try {
    const bc = new BroadcastChannel(BROADCAST_NAME)
    bc.postMessage({
      type: 'invalidate-resources',
      resources: Array.from(new Set(resources)),
    } satisfies InvalidateResourcesMessage)
    bc.close()
  } catch {
    // navegador sem BroadcastChannel — ok, fica apenas sem sync cross-tab
  }
}

export async function invalidatePathResources(queryClient: QueryClient, path: string) {
  const resources = getResourcesForPath(path)
  if (resources.length === 0) {
    await queryClient.invalidateQueries({ type: 'active' })
    return resources
  }

  await invalidateResourceQueries(queryClient, resources)
  return resources
}

export function useResourceRefresh() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const pathname = usePathname() || '/'

  const refreshResources = useCallback(
    async (
      resources: ReadonlyArray<RealtimeResource>,
      options?: {
        refreshRoute?: boolean
        broadcast?: boolean
      },
    ) => {
      await invalidateResourceQueries(queryClient, resources)
      if (options?.broadcast !== false) {
        broadcastResourceInvalidation(resources)
      }
      if (options?.refreshRoute) {
        router.refresh()
      }
    },
    [queryClient, router],
  )

  const refreshPath = useCallback(
    async (
      path: string,
      options?: {
        refreshRoute?: boolean
        broadcast?: boolean
      },
    ) => {
      const resources = await invalidatePathResources(queryClient, path)
      if (resources.length > 0 && options?.broadcast !== false) {
        broadcastResourceInvalidation(resources)
      }
      if (options?.refreshRoute) {
        router.refresh()
      }
      return resources
    },
    [queryClient, router],
  )

  const refreshActivePath = useCallback(
    async (options?: { refreshRoute?: boolean; broadcast?: boolean }) =>
      refreshPath(pathname, {
        refreshRoute: options?.refreshRoute ?? true,
        broadcast: options?.broadcast,
      }),
    [pathname, refreshPath],
  )

  return {
    activePath: pathname,
    activeResources: getResourcesForPath(pathname),
    refreshResources,
    refreshPath,
    refreshActivePath,
  }
}
