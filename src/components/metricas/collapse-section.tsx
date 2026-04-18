'use client'

import { useId, useState } from 'react'
import type { ReactNode } from 'react'

type CollapseSectionProps = {
  title: string
  description?: string
  /** Ícone à esquerda do título (identificação visual) */
  icon?: ReactNode
  /** Texto ou contagem exibida à direita (ex.: nº de linhas) */
  badge?: ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}

export function CollapseSection({ title, description, icon, badge, defaultOpen = false, children }: CollapseSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <div
      className="rounded-xl border overflow-hidden min-w-0"
      style={{ borderColor: 'var(--ac-border)', background: 'var(--ac-card)' }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start gap-2.5 sm:gap-3 px-4 py-3.5 sm:px-5 text-left transition-colors"
        style={{
          background: open ? 'color-mix(in srgb, var(--ac-accent) 6%, var(--ac-card))' : 'var(--ac-card)',
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="size-4 shrink-0 mt-1 transition-transform duration-200"
          style={{ color: 'var(--ac-muted)', transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}
          aria-hidden
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {icon ? (
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg mt-0.5"
            style={{
              color: 'var(--ac-accent)',
              background: 'color-mix(in srgb, var(--ac-accent) 12%, var(--ac-bg))',
              border: '1px solid color-mix(in srgb, var(--ac-accent) 22%, var(--ac-border))',
            }}
            aria-hidden
          >
            {icon}
          </span>
        ) : null}
        <div className="flex-1 min-w-0 space-y-0.5 pt-0.5">
          <h3 className="text-sm font-semibold leading-tight" style={{ color: 'var(--ac-text)' }}>
            {title}
          </h3>
          {description ? (
            <p className="text-xs leading-snug" style={{ color: 'var(--ac-muted)' }}>
              {description}
            </p>
          ) : null}
        </div>
        {badge != null && badge !== '' ? (
          <span
            className="shrink-0 text-xs font-medium tabular-nums px-2 py-1 rounded-md"
            style={{
              color: 'var(--ac-muted)',
              background: 'var(--ac-bg)',
              border: '1px solid var(--ac-border)',
            }}
          >
            {badge}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          id={panelId}
          className="px-4 pb-4 pt-0 sm:px-5 sm:pb-5 border-t min-w-0 overflow-x-auto"
          style={{ borderColor: 'var(--ac-border)' }}
        >
          <div className="pt-4 space-y-3">{children}</div>
        </div>
      ) : null}
    </div>
  )
}
