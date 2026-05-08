'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'

import { createClient } from '@/lib/supabase/client'
import { REALTIME_TABLES, TABLE_TO_KEYS } from '@/lib/realtime/table-to-keys'

const LOG = process.env.NODE_ENV === 'development'
const BROADCAST_NAME = 'erp-sync'

type BroadcastMsg = { table: string }

/**
 * Subscreve a um único canal Supabase Realtime que escuta `postgres_changes`
 * em todas as tabelas relevantes e invalida queries do TanStack Query
 * conforme `TABLE_TO_KEYS`.
 *
 * Cross-tab no mesmo navegador: quando este provider recebe um evento, ele
 * também faz `BroadcastChannel.postMessage(table)`, então outras abas
 * invalidam suas queries sem precisar duplicar o WebSocket.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const bcRef = useRef<BroadcastChannel | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // BroadcastChannel para sync entre abas do mesmo navegador.
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel(BROADCAST_NAME)
      bcRef.current = bc
      bc.onmessage = (ev: MessageEvent<BroadcastMsg>) => {
        const table = ev.data?.table
        if (!table) return
        invalidateForTable(table)
      }
    } catch {
      // navegador sem BroadcastChannel — sem problema, apenas sem cross-tab sync
    }

    function invalidateForTable(table: string) {
      const keys = TABLE_TO_KEYS[table]
      if (!keys) return
      if (LOG) console.log('[REALTIME] invalidate', { table, keys })
      for (const key of keys) {
        queryClient.invalidateQueries({ queryKey: key as unknown[] })
      }
    }

    const channel = supabase.channel('erp-global', {
      config: { broadcast: { self: false } },
    })

    for (const table of REALTIME_TABLES) {
      channel.on(
        'postgres_changes' as never,
        { event: '*', schema: 'public', table },
        (payload: { table: string; eventType: string }) => {
          if (LOG) console.log('[REALTIME] event', payload.eventType, payload.table)
          invalidateForTable(payload.table)
          bcRef.current?.postMessage({ table: payload.table } satisfies BroadcastMsg)
        },
      )
    }

    channel.subscribe((status) => {
      if (LOG) console.log('[REALTIME] channel status', status)
    })

    return () => {
      supabase.removeChannel(channel)
      bcRef.current?.close()
      bcRef.current = null
    }
  }, [queryClient])

  return <>{children}</>
}
