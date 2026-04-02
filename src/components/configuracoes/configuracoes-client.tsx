'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CategoriasFacaSection } from './categorias-faca-section'
import { CategoriasMateriaPrimaSection } from './categorias-materia-prima-section'
import { CategoriasConsumivelSection } from './categorias-consumivel-section'
import type { CategoriaFacaDB, CategoriaMateriaPrimaDB, CategoriaConsumivelDB } from '@/types'
import { createClient } from '@/lib/supabase/client'

const SETTINGS_SECTIONS = [
  { id: 'config-aparencia', label: 'Aparência' },
  { id: 'categorias-faca', label: 'Facas' },
  { id: 'categorias-materia-prima', label: 'Matérias-primas' },
  { id: 'categorias-consumivel', label: 'Consumíveis' },
  { id: 'config-conta', label: 'Conta' },
] as const

function ThemeMiniPreview({ variant }: { variant: 'light' | 'dark' }) {
  const isLight = variant === 'light'
  return (
    <div
      className="mt-3 rounded-lg overflow-hidden w-full max-w-[200px] sm:max-w-none"
      style={{
        border: '1px solid',
        borderColor: isLight ? 'color-mix(in srgb, #94a3b8 35%, transparent)' : 'color-mix(in srgb, #64748b 45%, transparent)',
        boxShadow: isLight ? '0 1px 2px rgba(15,23,42,0.06)' : '0 1px 3px rgba(0,0,0,0.35)',
      }}
      aria-hidden
    >
      <div
        className="flex items-center gap-1 px-2 py-1.5"
        style={{ background: isLight ? '#e5e7eb' : '#374151' }}
      >
        <span className="size-2 rounded-full" style={{ background: isLight ? '#f87171' : '#9ca3af' }} />
        <span className="size-2 rounded-full" style={{ background: isLight ? '#fbbf24' : '#9ca3af' }} />
        <span className="size-2 rounded-full" style={{ background: isLight ? '#34d399' : '#9ca3af' }} />
        <div className="ml-auto h-1.5 w-8 rounded-full" style={{ background: isLight ? '#d1d5db' : '#4b5563' }} />
      </div>
      <div className="flex gap-1 p-1.5" style={{ background: isLight ? '#f9fafb' : '#111827' }}>
        <div className="flex-1 rounded min-h-[36px]" style={{ background: isLight ? '#ffffff' : '#1f2937' }} />
        <div className="w-[28%] rounded min-h-[36px]" style={{ background: isLight ? '#f3f4f6' : '#0f172a' }} />
      </div>
    </div>
  )
}

function ThemeOption({
  value,
  current,
  onClick,
  icon,
  label,
  description,
  previewVariant,
}: {
  value: string
  current: string | undefined
  onClick: () => void
  icon: React.ReactNode
  label: string
  description: string
  previewVariant: 'light' | 'dark'
}) {
  const isSelected = current === value
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col sm:flex-row items-stretch gap-4 w-full rounded-xl p-4 text-left transition-all hover:opacity-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--ac-accent)] focus-visible:ring-offset-[var(--ac-bg)]"
      style={{
        background: isSelected ? 'color-mix(in srgb, var(--ac-accent) 8%, var(--ac-card))' : 'var(--ac-card)',
        border: `2px solid ${isSelected ? 'var(--ac-accent)' : 'var(--ac-border)'}`,
      }}
    >
      <div className="flex items-start gap-4 flex-1 min-w-0">
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
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
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
          <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--ac-muted)' }}>
            {description}
          </p>
        </div>
      </div>
      <div className="flex justify-center sm:justify-end sm:items-center sm:w-[min(100%,200px)] flex-shrink-0">
        <ThemeMiniPreview variant={previewVariant} />
      </div>
    </button>
  )
}

type Props = {
  categorias: CategoriaFacaDB[]
  categoriasMateriaPrima: CategoriaMateriaPrimaDB[]
  categoriasConsumivel: CategoriaConsumivelDB[]
}

export function ConfiguracoesClient({ categorias, categoriasMateriaPrima, categoriasConsumivel }: Props) {
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
    <div className="min-h-0">
      {/* Header */}
      <div
        className="px-4 sm:px-6 lg:px-8 py-5 sm:py-6"
        style={{ borderBottom: '1px solid var(--ac-border)' }}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight" style={{ color: 'var(--ac-text)' }}>
              Configurações
            </h2>
            <p className="text-sm mt-1 max-w-xl leading-relaxed" style={{ color: 'var(--ac-muted)' }}>
              Ajuste a aparência, organize categorias usadas no cadastro e gerencie sua sessão.
            </p>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="max-w-5xl mx-auto flex flex-col xl:flex-row xl:items-start gap-6 xl:gap-10">
          {/* Navegação: chips no mobile / tablet; coluna fixa no desktop largo */}
          <nav
            aria-label="Seções das configurações"
            className="xl:w-52 shrink-0 xl:sticky xl:top-4 xl:self-start"
          >
            <p
              className="hidden xl:block text-xs font-semibold uppercase tracking-wider mb-3"
              style={{ color: 'var(--ac-muted)' }}
            >
              Nesta página
            </p>
            <ul className="flex xl:flex-col gap-2 overflow-x-auto xl:overflow-visible pb-1 xl:pb-0 -mx-1 px-1 xl:mx-0 xl:px-0">
              {SETTINGS_SECTIONS.map((s) => (
                <li key={s.id} className="flex-shrink-0 xl:flex-shrink">
                  <a
                    href={`#${s.id}`}
                    className="block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors xl:w-full"
                    style={{
                      background: 'var(--ac-card)',
                      border: '1px solid var(--ac-border)',
                      color: 'var(--ac-text)',
                    }}
                    onClick={(e) => {
                      e.preventDefault()
                      document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex-1 min-w-0 flex flex-col gap-6 sm:gap-8">
            {/* Seção de tema */}
            <div
              id="config-aparencia"
              className="scroll-mt-24 rounded-xl p-5 sm:p-6 shadow-sm"
              style={{
                background: 'var(--ac-card)',
                border: '1px solid var(--ac-border)',
                boxShadow: '0 1px 3px color-mix(in srgb, var(--ac-text) 6%, transparent)',
              }}
            >
              <div className="mb-5 sm:mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--ac-text)' }}>
                    Aparência
                  </h2>
                  <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--ac-muted)' }}>
                    Escolha como o sistema vai aparecer para você. A troca é aplicada na hora.
                  </p>
                </div>
              </div>

              {!mounted ? (
                <div className="h-40 sm:h-48 rounded-xl animate-pulse" style={{ background: 'var(--ac-bg)' }} />
              ) : (
                <div className="flex flex-col gap-4">
                  <ThemeOption
                    value="light"
                    current={theme}
                    onClick={() => setTheme('light')}
                    label="Claro"
                    description="Fundo claro, ideal para ambientes bem iluminados e leitura prolongada."
                    previewVariant="light"
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
                    description="Fundo escuro, mais confortável à noite ou em ambientes com pouca luz."
                    previewVariant="dark"
                    icon={
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-5">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                    }
                  />
                </div>
              )}
            </div>

            <CategoriasFacaSection categorias={categorias} />
            <CategoriasMateriaPrimaSection categorias={categoriasMateriaPrima} />
            <CategoriasConsumivelSection categorias={categoriasConsumivel} />

            <div
              id="config-conta"
              className="scroll-mt-24 rounded-xl p-5 sm:p-6 shadow-sm"
              style={{
                background: 'var(--ac-card)',
                border: '1px solid var(--ac-border)',
                boxShadow: '0 1px 3px color-mix(in srgb, var(--ac-text) 6%, transparent)',
              }}
            >
              <div className="mb-5">
                <h2 className="text-lg font-semibold" style={{ color: 'var(--ac-text)' }}>
                  Conta
                </h2>
                <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--ac-muted)' }}>
                  Encerre sua sessão atual neste dispositivo.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={isSigningOut}
                className="w-full sm:w-auto rounded-lg px-4 py-2.5 text-sm font-semibold transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
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
      </div>
    </div>
  )
}
