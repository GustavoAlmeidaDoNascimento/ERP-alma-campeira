'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CategoriasFacaSection } from './categorias-faca-section'
import type { CategoriaFacaDB } from '@/types'
import { createClient } from '@/lib/supabase/client'

function ThemeOption({
  value,
  current,
  onClick,
  icon,
  label,
  description,
}: {
  value: string
  current: string | undefined
  onClick: () => void
  icon: React.ReactNode
  label: string
  description: string
}) {
  const isSelected = current === value
  return (
    <button
      onClick={onClick}
      className="flex items-start gap-4 w-full rounded-xl p-4 text-left transition-all"
      style={{
        background: isSelected ? 'color-mix(in srgb, var(--ac-accent) 8%, var(--ac-card))' : 'var(--ac-card)',
        border: `2px solid ${isSelected ? 'var(--ac-accent)' : 'var(--ac-border)'}`,
      }}
    >
      <div
        className="size-10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
        style={{
          background: isSelected ? 'var(--ac-accent)' : 'var(--ac-bg)',
          color: isSelected ? '#111827' : 'var(--ac-muted)',
          border: `1px solid ${isSelected ? 'transparent' : 'var(--ac-border)'}`,
        }}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-sm" style={{ color: 'var(--ac-text)' }}>
            {label}
          </span>
          {isSelected && (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'var(--ac-accent)', color: '#111827' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Ativo
            </span>
          )}
        </div>
        <p className="text-sm mt-0.5" style={{ color: 'var(--ac-muted)' }}>
          {description}
        </p>
      </div>
    </button>
  )
}

type Props = {
  categorias: CategoriaFacaDB[]
}

export function ConfiguracoesClient({ categorias }: Props) {
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  // Evita hydration mismatch
  useEffect(() => setMounted(true), [])

  async function handleSignOut() {
    setSignOutError(null)
    setIsSigningOut(true)

    const supabase = createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      setSignOutError('Nao foi possivel sair da conta. Tente novamente.')
      setIsSigningOut(false)
      return
    }

    router.replace('/login')
    router.refresh()
  }

  return (
    <div>
      {/* Header */}
      <div className="px-8 py-6" style={{ borderBottom: '1px solid var(--ac-border)' }}>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--ac-text)' }}>Configurações</h2>
        <p className="text-sm mt-0.5" style={{ color: 'var(--ac-muted)' }}>
          Preferências do sistema
        </p>
      </div>

      <div className="px-8 py-6 max-w-2xl flex flex-col gap-6">
        {/* Seção de tema */}
        <div
          className="rounded-xl p-6"
          style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)' }}
        >
          <div className="mb-5">
            <h2 className="font-semibold text-base" style={{ color: 'var(--ac-text)' }}>
              Aparência
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--ac-muted)' }}>
              Escolha como o sistema vai aparecer para você
            </p>
          </div>

          {!mounted ? (
            <div className="h-32 rounded-xl animate-pulse" style={{ background: 'var(--ac-bg)' }} />
          ) : (
            <div className="flex flex-col gap-3">
              <ThemeOption
                value="light"
                current={theme}
                onClick={() => setTheme('light')}
                label="Claro"
                description="Fundo branco, ideal para ambientes bem iluminados"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-5">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                }
              />
              <ThemeOption
                value="dark"
                current={theme}
                onClick={() => setTheme('dark')}
                label="Escuro"
                description="Fundo escuro, mais confortável em ambientes com pouca luz"
                icon={
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-5">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                }
              />
            </div>
          )}
        </div>

        {/* Seção de categorias de facas */}
        <CategoriasFacaSection categorias={categorias} />

        {/* Seção da conta */}
        <div
          className="rounded-xl p-6"
          style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)' }}
        >
          <div className="mb-5">
            <h2 className="font-semibold text-base" style={{ color: 'var(--ac-text)' }}>
              Conta
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--ac-muted)' }}>
              Encerre sua sessao atual neste dispositivo
            </p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full sm:w-auto rounded-lg px-4 py-2 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: 'color-mix(in srgb, #ef4444 18%, transparent)',
              border: '1px solid color-mix(in srgb, #ef4444 40%, var(--ac-border))',
              color: '#ef4444',
            }}
          >
            {isSigningOut ? 'Saindo...' : 'Sair da conta'}
          </button>

          {signOutError ? (
            <p className="text-sm mt-3" style={{ color: '#ef4444' }}>
              {signOutError}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
