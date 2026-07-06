'use client'

import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

const LOG = process.env.NODE_ENV === 'development'

/**
 * Mantém os dados do app atualizados por polling a cada 30 segundos.
 *
 * Usa um modelo simples: invalida todas as queries ativas do TanStack Query
 * periodicamente. O intervalo de 30s é suficiente para um ERP interno onde
 * atualizações em tempo real não são críticas ao milissegundo.
 *
 * Cross-tab: BroadcastChannel garante que quando uma aba faz uma mutação,
 * as outras abas invalidam suas queries imediatamente (sem esperar o próximo tick).
 */

const POLL_INTERVAL_MS = 30_000
const BROADCAST_NAME = 'erp-sync'

type BroadcastMsg = { type: 'invalidate-all' }

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()

  useEffect(() => {
    // BroadcastChannel para sync entre abas do mesmo navegador
    let bc: BroadcastChannel | null = null
    try {
      bc = new BroadcastChannel(BROADCAST_NAME)
      bc.onmessage = (ev: MessageEvent<BroadcastMsg>) => {
        if (ev.data?.type === 'invalidate-all') {
          if (LOG) console.log('[REALTIME] cross-tab invalidate')
          queryClient.invalidateQueries({ type: 'active' })
        }
      }
    } catch {
      // navegador sem BroadcastChannel — ok, apenas sem cross-tab sync
    }

    // Polling periódico
    const interval = setInterval(() => {
      if (LOG) console.log('[REALTIME] poll invalidate')
      queryClient.invalidateQueries({ type: 'active' })
    }, POLL_INTERVAL_MS)

    return () => {
      clearInterval(interval)
      bc?.close()
    }
  }, [queryClient])

  return <>{children}</>
}

/**
 * Notifica outras abas para invalidar queries imediatamente.
 * Chame após mutações no cliente para sincronizar outras abas.
 */
export function broadcastInvalidate() {
  try {
    const bc = new BroadcastChannel(BROADCAST_NAME)
    bc.postMessage({ type: 'invalidate-all' } satisfies BroadcastMsg)
    bc.close()
  } catch {
    // sem suporte a BroadcastChannel — ignora
  }
}
