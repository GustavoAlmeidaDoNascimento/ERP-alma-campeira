'use client'

import { createContext, useContext, type ReactNode } from 'react'

const PermissoesVerContext = createContext<Record<string, boolean> | null>(null)

export function PermissoesVerProvider({
  permVer,
  children,
}: {
  permVer: Record<string, boolean>
  children: ReactNode
}) {
  return (
    <PermissoesVerContext.Provider value={permVer}>
      {children}
    </PermissoesVerContext.Provider>
  )
}

export function usePermissoesVer(): Record<string, boolean> | null {
  return useContext(PermissoesVerContext)
}
