'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { sections } from '@/components/layout/erp-navigation'
import { useErpTabs } from '@/components/layout/erp-tabs'

const iconGear = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-[16px] flex-shrink-0">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

function getInitials(email: string) {
  const name = email.split('@')[0]
  const parts = name.split(/[._-]/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

export function Sidebar() {
  const { openTab, activeHref } = useErpTabs()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>(() =>
    sections.reduce<Record<string, boolean>>((acc, section) => {
      acc[section.label] = true
      return acc
    }, {}),
  )

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null)
    })
  }, [])

  return (
    <aside
      style={{ width: 'var(--ac-sidebar-w)', background: 'var(--ac-sidebar)', borderRight: '1px solid var(--ac-border)' }}
      className="fixed inset-y-0 left-0 flex flex-col z-30"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-4 py-5" style={{ borderBottom: '1px solid var(--ac-border)' }}>
        <div
          className="size-8 flex-shrink-0"
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
        <span className="font-bold text-sm" style={{ color: 'var(--ac-text)' }}>Alma Campeira</span>
      </div>

      {/* Nav com seções */}
      <nav className="flex-1 overflow-y-auto py-2">
        {sections.map((section) => (
          <div key={section.label} className="mb-1">
            {/* Label da seção */}
            <button
              type="button"
              onClick={() => {
                setExpandedSections((prev) => ({
                  ...prev,
                  [section.label]: !prev[section.label],
                }))
              }}
              aria-expanded={expandedSections[section.label]}
              className="w-full px-4 pt-3 pb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-widest transition-opacity hover:opacity-90"
              style={{ color: 'var(--ac-muted)', opacity: 0.7 }}
            >
              <span>{section.label}</span>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                className={[
                  'size-3.5 transition-transform duration-200',
                  expandedSections[section.label] ? 'rotate-180' : '',
                ].join(' ')}
                aria-hidden
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {/* Itens */}
            {expandedSections[section.label] && section.items.map((item) => {
              const isActive = activeHref === item.href || activeHref.startsWith(item.href + '/')
              return (
                <button
                  key={item.href}
                  type="button"
                  onClick={() => {
                    if (!item.available) return
                    openTab(item.href)
                  }}
                  className={[
                    'flex w-[calc(100%-1rem)] items-center gap-3 px-4 py-2 mx-2 rounded-lg text-sm transition-colors',
                    item.available && !isActive
                      ? 'hover:bg-[color-mix(in_srgb,var(--ac-accent)_8%,transparent)]'
                      : '',
                    isActive
                      ? 'bg-[color-mix(in_srgb,var(--ac-accent)_10%,transparent)]'
                      : '',
                    isActive
                      ? 'font-semibold'
                      : item.available
                      ? 'font-normal'
                      : 'opacity-35 cursor-not-allowed pointer-events-none',
                  ].join(' ')}
                  style={{
                    color: isActive ? 'var(--ac-accent)' : 'var(--ac-muted)',
                  }}
                >
                  <span style={{ color: isActive ? 'var(--ac-accent)' : 'var(--ac-muted)' }}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Rodapé — usuário logado */}
      <div className="px-3 py-3" style={{ borderTop: '1px solid var(--ac-border)' }}>
        <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg" style={{ background: 'color-mix(in srgb, var(--ac-muted) 8%, transparent)' }}>
          {/* Avatar com iniciais */}
          <div
            className="size-7 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
            style={{ background: 'var(--ac-accent)', color: '#111827' }}
          >
            {userEmail ? getInitials(userEmail) : '…'}
          </div>

          {/* E-mail truncado */}
          <span
            className="flex-1 text-xs truncate"
            style={{ color: 'var(--ac-muted)' }}
            title={userEmail ?? ''}
          >
            {userEmail ?? 'Carregando...'}
          </span>

          {/* Engrenagem → configurações */}
          <button
            type="button"
            className="flex-shrink-0 p-1 rounded-md transition-colors hover:opacity-80"
            style={{
              color: activeHref.startsWith('/configuracoes') ? 'var(--ac-accent)' : 'var(--ac-muted)',
              background: activeHref.startsWith('/configuracoes')
                ? 'color-mix(in srgb, var(--ac-accent) 12%, transparent)'
                : 'transparent',
            }}
            title="Configurações"
            onClick={() => openTab('/configuracoes')}
          >
            {iconGear}
          </button>
        </div>
      </div>
    </aside>
  )
}
