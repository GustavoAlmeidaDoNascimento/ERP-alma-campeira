'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CategoriasFacaSection } from './categorias-faca-section'
import { CategoriasMateriaPrimaSection } from './categorias-materia-prima-section'
import { CategoriasConsumivelSection } from './categorias-consumivel-section'
import { EmpresaSection } from './empresa-section'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateTaxasLucroConfig, type TaxasLucroConfig } from '@/lib/actions/app-config'
import type { CategoriaFacaDB, CategoriaMateriaPrimaDB, CategoriaConsumivelDB, Empresa } from '@/types'

const SENHA_MIN_LEN = 8

function usuarioPodeSenhaEmail(identities: { provider: string }[] | undefined): boolean {
  return Boolean(identities?.some((i) => i.provider === 'email'))
}

function mapearErroSenhaAutenticacao(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return 'Senha atual incorreta.'
  if (m.includes('password should be at least') || (m.includes('at least') && m.includes('character'))) {
    return 'A nova senha não atende ao tamanho mínimo exigido pelo sistema.'
  }
  if (m.includes('same as the old password') || m.includes('different from the old')) {
    return 'A nova senha deve ser diferente da senha atual.'
  }
  if (m.includes('weak') || m.includes('pwned') || m.includes('leaked')) {
    return 'Esta senha é considerada fraca ou comprometida. Escolha outra.'
  }
  return message
}

function PasswordInputToggle({
  id,
  label,
  value,
  onChange,
  disabled,
  autoComplete,
}: {
  id: string
  label: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  disabled?: boolean
  autoComplete?: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          disabled={disabled}
          className="w-full rounded-lg py-2.5 pl-3 pr-11 text-sm outline-none transition-all"
          style={{
            background: 'var(--ac-card)',
            border: '1px solid var(--ac-border)',
            color: 'var(--ac-text)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--ac-accent)'
            e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--ac-accent) 20%, transparent)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--ac-border)'
            e.currentTarget.style.boxShadow = 'none'
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          disabled={disabled}
          className="absolute right-0 top-0 flex h-full min-w-11 items-center justify-center rounded-r-lg transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ac-accent)]"
          style={{ color: 'var(--ac-muted)' }}
          onMouseEnter={(e) => {
            if (!disabled) e.currentTarget.style.color = 'var(--ac-text)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--ac-muted)'
          }}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={visible}
        >
          {visible ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-5 shrink-0"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.182 4.182L9.88 9.88"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-5 shrink-0"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

const SETTINGS_SECTIONS = [
  { id: 'config-aparencia', label: 'Aparência' },
  { id: 'config-empresa', label: 'Empresa' },
  { id: 'config-taxas-lucro', label: 'Taxa' },
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

type PermTaxas = { ver: boolean; editar: boolean }

type Props = {
  categorias: CategoriaFacaDB[]
  categoriasMateriaPrima: CategoriaMateriaPrimaDB[]
  categoriasConsumivel: CategoriaConsumivelDB[]
  taxasLucro: TaxasLucroConfig
  permTaxasLucro: PermTaxas
  empresa: Empresa | null
}

export function ConfiguracoesClient({
  categorias,
  categoriasMateriaPrima,
  categoriasConsumivel,
  taxasLucro,
  permTaxasLucro,
  empresa,
}: Props) {
  const { theme, setTheme } = useTheme()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)
  const [authContaLoading, setAuthContaLoading] = useState(true)
  const [podeTrocarSenha, setPodeTrocarSenha] = useState(false)
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [senhaConfirmar, setSenhaConfirmar] = useState('')
  const [passwordPending, setPasswordPending] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null)
  const [tp, setTp] = useState(String(taxasLucro.taxa_producao))
  const [ml, setMl] = useState(String(taxasLucro.margem_lucro))
  const [tc, setTc] = useState(String(taxasLucro.taxa_comissao))
  const [taxasMsg, setTaxasMsg] = useState<string | null>(null)
  const [taxasErr, setTaxasErr] = useState<string | null>(null)
  const [pendingTaxas, startTaxas] = useTransition()

  // Evita hydration mismatch
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const response = await fetch('/api/auth/user', { cache: 'no-store' })
      const body = (await response.json().catch(() => null)) as {
        user?: { email?: string | null; identities?: { provider: string }[] } | null
      } | null
      const user = response.ok ? body?.user ?? null : null
      if (cancelled) return
      const emailOk = Boolean(user?.email?.trim())
      setPodeTrocarSenha(emailOk && usuarioPodeSenhaEmail(user?.identities))
      setAuthContaLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    setTp(String(taxasLucro.taxa_producao))
    setMl(String(taxasLucro.margem_lucro))
    setTc(String(taxasLucro.taxa_comissao))
  }, [taxasLucro.taxa_producao, taxasLucro.margem_lucro, taxasLucro.taxa_comissao])

  async function handleSignOut() {
    setSignOutError(null)
    setIsSigningOut(true)

    const response = await fetch('/api/auth/logout', {
      method: 'POST',
    })

    if (!response.ok) {
      setSignOutError('Nao foi possivel sair da conta. Tente novamente.')
      setIsSigningOut(false)
      return
    }

    router.replace('/login')
    router.refresh()
  }

  async function handleTrocarSenha(e: React.FormEvent) {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(null)

    const atual = senhaAtual
    const nova = senhaNova.trim()
    const conf = senhaConfirmar.trim()

    if (nova.length < SENHA_MIN_LEN) {
      setPasswordError(`A nova senha deve ter pelo menos ${SENHA_MIN_LEN} caracteres.`)
      return
    }
    if (nova !== conf) {
      setPasswordError('A confirmação não coincide com a nova senha.')
      return
    }
    if (nova === atual) {
      setPasswordError('A nova senha deve ser diferente da senha atual.')
      return
    }

    setPasswordPending(true)
    try {
      const response = await fetch('/api/auth/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: atual,
          password: nova,
        }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null
        setPasswordError(mapearErroSenhaAutenticacao(body?.error ?? 'Erro ao alterar senha.'))
        return
      }

      setSenhaAtual('')
      setSenhaNova('')
      setSenhaConfirmar('')
      setPasswordSuccess('Senha alterada com sucesso.')
      router.refresh()
    } finally {
      setPasswordPending(false)
    }
  }

  function salvarTaxasLucro() {
    setTaxasMsg(null)
    setTaxasErr(null)
    const taxa_producao = parseFloat(tp.replace(',', '.'))
    const margem_lucro = parseFloat(ml.replace(',', '.'))
    const taxa_comissao = parseFloat(tc.replace(',', '.'))
    if (!Number.isFinite(taxa_producao) || taxa_producao < 0) {
      setTaxasErr('Informe um valor válido para a taxa de produção (R$ ≥ 0).')
      return
    }
    if (!Number.isFinite(margem_lucro) || margem_lucro < 0) {
      setTaxasErr('Informe uma margem de lucro válida (% ≥ 0).')
      return
    }
    if (!Number.isFinite(taxa_comissao) || taxa_comissao < 0 || taxa_comissao > 100) {
      setTaxasErr('Informe a taxa de comissão entre 0 e 100%.')
      return
    }
    startTaxas(async () => {
      try {
        await updateTaxasLucroConfig({ taxa_producao, margem_lucro, taxa_comissao })
        setTaxasMsg('Taxas salvas.')
      } catch (e: unknown) {
        setTaxasErr(e instanceof Error ? e.message : 'Erro ao salvar.')
      }
    })
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
              Ajuste a aparência, taxas usadas no cálculo de lucro, organize categorias no cadastro e gerencie sua sessão.
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

            <EmpresaSection empresa={empresa} podeEditar={permTaxasLucro.editar} />

            {permTaxasLucro.ver && (
              <div
                id="config-taxas-lucro"
                className="scroll-mt-24 rounded-xl p-5 sm:p-6 shadow-sm"
                style={{
                  background: 'var(--ac-card)',
                  border: '1px solid var(--ac-border)',
                  boxShadow: '0 1px 3px color-mix(in srgb, var(--ac-text) 6%, transparent)',
                }}
              >
                <div className="mb-5 sm:mb-6">
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--ac-text)' }}>
                    Taxas para cálculo de lucro
                  </h2>
                  <p className="text-sm mt-1 leading-relaxed max-w-2xl" style={{ color: 'var(--ac-muted)' }}>
                    Custo de produção = custo BOM + taxa de produção (R$ fixo). Preço de venda = custo de produção × (1 + margem de lucro). Lucro = preço de venda − comissão − custo de produção.
                    {!permTaxasLucro.editar && ' Você pode visualizar os valores; apenas quem tem permissão de edição altera as taxas.'}
                  </p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
                  <Input
                    id="taxa_producao_lucro"
                    label="Taxa de produção (R$)"
                    type="text"
                    inputMode="decimal"
                    value={tp}
                    onChange={(e) => setTp(e.target.value)}
                    disabled={!permTaxasLucro.editar || pendingTaxas}
                  />
                  <Input
                    id="margem_lucro"
                    label="Margem de lucro (%)"
                    type="text"
                    inputMode="decimal"
                    value={ml}
                    onChange={(e) => setMl(e.target.value)}
                    disabled={!permTaxasLucro.editar || pendingTaxas}
                  />
                  <Input
                    id="taxa_comissao_lucro"
                    label="Taxa de comissão (%)"
                    type="text"
                    inputMode="decimal"
                    value={tc}
                    onChange={(e) => setTc(e.target.value)}
                    disabled={!permTaxasLucro.editar || pendingTaxas}
                  />
                </div>
                {permTaxasLucro.editar && (
                  <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
                    <Button type="button" onClick={salvarTaxasLucro} loading={pendingTaxas}>
                      Salvar taxas
                    </Button>
                    {taxasMsg && <span className="text-sm" style={{ color: '#15803d' }}>{taxasMsg}</span>}
                  </div>
                )}
                {taxasErr && (
                  <p className="text-sm mt-3 rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>
                    {taxasErr}
                  </p>
                )}
              </div>
            )}

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
                  Altere sua senha ou encerre a sessão neste dispositivo.
                </p>
              </div>

              {authContaLoading ? (
                <p className="text-sm mb-6" style={{ color: 'var(--ac-muted)' }}>
                  Carregando opções da conta…
                </p>
              ) : podeTrocarSenha ? (
                <form onSubmit={handleTrocarSenha} className="mb-8 flex flex-col gap-4 max-w-md">
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--ac-text)' }}>
                    Alterar senha
                  </h3>
                  <PasswordInputToggle
                    id="conta_senha_atual"
                    label="Senha atual *"
                    autoComplete="current-password"
                    value={senhaAtual}
                    onChange={(e) => setSenhaAtual(e.target.value)}
                    disabled={passwordPending}
                  />
                  <PasswordInputToggle
                    id="conta_senha_nova"
                    label={`Nova senha * (mín. ${SENHA_MIN_LEN} caracteres)`}
                    autoComplete="new-password"
                    value={senhaNova}
                    onChange={(e) => setSenhaNova(e.target.value)}
                    disabled={passwordPending}
                  />
                  <PasswordInputToggle
                    id="conta_senha_confirmar"
                    label="Confirmar nova senha *"
                    autoComplete="new-password"
                    value={senhaConfirmar}
                    onChange={(e) => setSenhaConfirmar(e.target.value)}
                    disabled={passwordPending}
                  />
                  <div>
                    <Button type="submit" loading={passwordPending}>
                      Alterar senha
                    </Button>
                  </div>
                  {passwordSuccess ? (
                    <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#15803d', background: '#dcfce7' }}>
                      {passwordSuccess}
                    </p>
                  ) : null}
                  {passwordError ? (
                    <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>
                      {passwordError}
                    </p>
                  ) : null}
                </form>
              ) : (
                <div
                  className="mb-8 rounded-lg px-3 py-3 text-sm leading-relaxed max-w-xl"
                  style={{ background: 'var(--ac-bg)', color: 'var(--ac-muted)', border: '1px solid var(--ac-border)' }}
                >
                  Sua conta não usa login com e-mail e senha (por exemplo, apenas provedor social). A troca de senha
                  por aqui não está disponível. Use o fluxo oferecido pelo provedor ou, na tela de login, a opção de
                  recuperação por e-mail, se configurada no projeto.
                </div>
              )}

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
