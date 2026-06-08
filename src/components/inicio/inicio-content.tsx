'use client'

import { useEffect, useState } from 'react'

function formatTime(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour12: false })
}

function formatDate(d: Date) {
  const s = d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function InicioContent() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-6 text-center">
        <div className="flex items-center gap-4">
          <div
            className="size-16 flex-shrink-0"
            style={{
              backgroundColor: 'var(--ac-accent)',
              maskImage: 'url(/images/logo.png)',
              maskSize: 'contain',
              maskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskImage: 'url(/images/logo.png)',
              WebkitMaskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
            }}
            aria-hidden
          />
          <h1 className="font-bold text-4xl tracking-tight" style={{ color: 'var(--ac-text)' }}>
            Alma Campeira
          </h1>
        </div>

        <div className="flex flex-col items-center gap-1">
          <div
            className="font-mono font-semibold tabular-nums text-6xl"
            style={{ color: 'var(--ac-text)' }}
            suppressHydrationWarning
          >
            {now ? formatTime(now) : '--:--:--'}
          </div>
          <div className="text-sm" style={{ color: 'var(--ac-muted)' }} suppressHydrationWarning>
            {now ? formatDate(now) : ''}
          </div>
        </div>
      </div>
    </div>
  )
}
