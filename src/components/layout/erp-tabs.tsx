'use client'

import Image from 'next/image'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

import { getRouteIcon, getRouteLabel, normalizePath } from '@/components/layout/erp-navigation'
import type { ReactNode } from 'react'

import { getErpTabData, type ErpTabData } from '@/lib/actions/erp-tab-data'

import { MPClient } from '@/components/materias-primas/mp-client'
import { MPDetalheClient } from '@/components/materias-primas/mp-detalhe-client'
import { FacasClient } from '@/components/facas/facas-client'
import { FacaDetalheClient } from '@/components/facas/faca-detalhe-client'
import { FornecedoresClient } from '@/components/fornecedores/fornecedores-client'
import { OcClient } from '@/components/ordens-compra/oc-client'
import { VendasClient } from '@/components/vendas/vendas-client'
import { ClientesClient } from '@/components/clientes/clientes-client'
import { UsuariosClient } from '@/components/usuarios/usuarios-client'
import { CargosClient } from '@/components/cargos/cargos-client'
import { ConfiguracoesClient } from '@/components/configuracoes/configuracoes-client'
import { ConsumivelClient } from '@/components/consumiveis/consumivel-client'
import { MetricasClient } from '@/components/metricas/metricas-client'

type OpenTab = {
  href: string
  label: string
}

const STORAGE_KEY = 'erp_open_tabs_v1'
const ACTIVE_KEY = 'erp_active_tab_v1'

const LOG = process.env.NODE_ENV === 'development'

/** Rota padrão após login — alinhado a `src/app/page.tsx` */
const ERP_FALLBACK_HREF = '/materias-primas'

function normalizeHref(href: string) {
  const [pathOnly] = href.split('?')
  return normalizePath(pathOnly || '/')
}

function parseStoredTabs(value: string | null): OpenTab[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value) as OpenTab[]
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((item) => typeof item?.href === 'string' && typeof item?.label === 'string')
      .map((item) => ({ href: normalizeHref(item.href), label: item.label }))
  } catch {
    return []
  }
}

type ErpTabsContextValue = {
  openTabs: OpenTab[]
  activeHref: string
  openTab: (href: string) => void
  selectTab: (href: string) => void
  closeTab: (href: string) => void
  reorderTabs: (fromHref: string, toHref: string) => void
  updateTabLabel: (href: string, label: string) => void
  tabRefreshSeq: Record<string, number>
  refreshTab: (href: string) => void
  refreshActiveTab: () => void
}

const ErpTabsContext = createContext<ErpTabsContextValue | null>(null)

export function useErpTabs() {
  const ctx = useContext(ErpTabsContext)
  if (!ctx) throw new Error('useErpTabs deve ser usado dentro de ErpTabsProvider.')
  return ctx
}

function SkeletonHeader({ wide = false }: { wide?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="space-y-2">
        <div className="h-7 w-44 rounded-lg" style={{ background: 'var(--ac-border)' }} />
        <div className="h-3.5 w-52 rounded-lg" style={{ background: 'var(--ac-border)' }} />
      </div>
      <div className={`h-9 rounded-lg ${wide ? 'w-40' : 'w-32'}`} style={{ background: 'var(--ac-border)' }} />
    </div>
  )
}

function SkeletonSearchAndFilters({ withSelect = false }: { withSelect?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="h-9 w-full sm:w-80 rounded-lg" style={{ background: 'var(--ac-border)' }} />
      {withSelect ? <div className="h-9 w-full sm:w-56 rounded-lg" style={{ background: 'var(--ac-border)' }} /> : null}
    </div>
  )
}

function SkeletonTable({ cols = 6, rows = 6 }: { cols?: number; rows?: number }) {
  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--ac-border)', background: 'var(--ac-card)' }}>
      <div className="flex gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--ac-border)', background: 'color-mix(in srgb, var(--ac-border) 30%, transparent)' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <div
            key={i}
            className="h-3.5 rounded"
            style={{ background: 'var(--ac-border)', width: `${Math.max(52, 120 - i * 8)}px` }}
          />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3 px-4 py-3 border-b last:border-0" style={{ borderColor: 'var(--ac-border)' }}>
          {Array.from({ length: cols }).map((__, j) => (
            <div
              key={`${i}-${j}`}
              className="h-3.5 rounded"
              style={{ background: 'var(--ac-border)', width: `${Math.max(44, 96 - j * 6 + ((i + j) % 3) * 10)}px` }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function TabSkeleton({ href }: { href: string }) {
  const path = normalizeHref(href)

  if (path === '/ordens-compra') {
    return (
      <div className="p-6 sm:p-8 space-y-5 animate-pulse">
        <SkeletonHeader wide />
        <div className="flex gap-2">
          <div className="h-9 w-36 rounded-lg" style={{ background: 'var(--ac-border)' }} />
          <div className="h-9 w-36 rounded-lg" style={{ background: 'var(--ac-border)' }} />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--ac-border)', background: 'var(--ac-card)' }}>
              <div className="h-5 w-52 rounded" style={{ background: 'var(--ac-border)' }} />
              <div className="h-3.5 w-72 rounded" style={{ background: 'var(--ac-border)' }} />
              <SkeletonTable cols={4} rows={2} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (path === '/vendas') {
    return (
      <div className="p-6 sm:p-8 space-y-5 animate-pulse">
        <SkeletonHeader />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-24 rounded-lg" style={{ background: 'var(--ac-border)' }} />
          ))}
        </div>
        <SkeletonSearchAndFilters />
        <SkeletonTable cols={6} rows={7} />
      </div>
    )
  }

  if (path.startsWith('/facas/')) {
    return (
      <div className="p-6 sm:p-8 space-y-5 animate-pulse">
        <div className="flex items-start gap-6">
          <div className="w-[120px] h-[120px] rounded-2xl" style={{ background: 'var(--ac-border)' }} />
          <div className="flex-1 space-y-3">
            <div className="h-4 w-32 rounded" style={{ background: 'var(--ac-border)' }} />
            <div className="h-7 w-64 rounded-lg" style={{ background: 'var(--ac-border)' }} />
            <div className="flex gap-3">
              <div className="h-5 w-20 rounded" style={{ background: 'var(--ac-border)' }} />
              <div className="h-5 w-24 rounded" style={{ background: 'var(--ac-border)' }} />
              <div className="h-5 w-16 rounded" style={{ background: 'var(--ac-border)' }} />
            </div>
          </div>
        </div>
        <div className="h-5 w-48 rounded" style={{ background: 'var(--ac-border)' }} />
        <SkeletonTable cols={5} rows={4} />
        <div className="h-5 w-48 rounded" style={{ background: 'var(--ac-border)' }} />
        <SkeletonTable cols={5} rows={3} />
      </div>
    )
  }

  if (path === '/facas') {
    return (
      <div className="p-6 sm:p-8 space-y-5 animate-pulse">
        <SkeletonHeader />
        <SkeletonSearchAndFilters withSelect />
        <SkeletonTable cols={7} rows={7} />
      </div>
    )
  }

  if (path === '/configuracoes') {
    return (
      <div className="p-6 sm:p-8 space-y-5 animate-pulse">
        <SkeletonHeader />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border p-4 space-y-3" style={{ borderColor: 'var(--ac-border)', background: 'var(--ac-card)' }}>
              <div className="h-5 w-40 rounded" style={{ background: 'var(--ac-border)' }} />
              <div className="h-9 w-full rounded-lg" style={{ background: 'var(--ac-border)' }} />
              <div className="h-9 w-32 rounded-lg" style={{ background: 'var(--ac-border)' }} />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 sm:p-8 space-y-5 animate-pulse">
      <SkeletonHeader />
      <SkeletonSearchAndFilters />
      <SkeletonTable cols={6} rows={6} />
      <div className="text-xs" style={{ color: 'var(--ac-muted)' }}>
        Carregando {getRouteLabel(path)}...
      </div>
    </div>
  )
}

function TabPane({
  href,
  cachedData,
  onData,
  active,
  refreshSeq,
}: {
  href: string
  cachedData?: ErpTabData | undefined
  onData?: (href: string, data: ErpTabData) => void
  active: boolean
  refreshSeq: number
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>(
    cachedData ? 'ready' : 'loading'
  )
  const [data, setData] = useState<ErpTabData | null>(cachedData ?? null)
  const [errMsg, setErrMsg] = useState<string>('')

  // Track whether we've completed at least one successful load and which refreshSeq was last fetched.
  // This prevents re-fetching just because the user switched back to this tab.
  const loadedRef = useRef(!!cachedData)
  const lastFetchedSeqRef = useRef(cachedData ? 0 : -1)

  useEffect(() => {
    if (LOG) console.log('[TABS] TabPane mounted', { href, hasCachedData: !!cachedData })
    return () => {
      if (LOG) console.log('[TABS] TabPane unmounted', { href })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!active) return

    // Skip fetch if already loaded and refreshSeq hasn't changed.
    // This means switching back to a visited tab never triggers a re-fetch.
    // Only an explicit refresh (F5 resets the component; refreshTab increments refreshSeq) will fetch again.
    if (loadedRef.current && lastFetchedSeqRef.current === refreshSeq) return

    lastFetchedSeqRef.current = refreshSeq

    let cancelled = false
    async function run() {
      try {
        if (LOG) console.log('[TABS] fetch start', { href })
        // Only show loading skeleton if we have no cached data
        if (!cachedData) {
          setStatus('loading')
          setData(null)
          setErrMsg('')
        } else {
          // Mantém o conteúdo atual enquanto busca em background
          setErrMsg('')
        }

        const d = await getErpTabData(href)
        if (cancelled) return
        loadedRef.current = true
        setData(d)
        setStatus('ready')
        onData?.(href, d)
        if (LOG) console.log('[TABS] fetch success', { href, kind: d.kind })
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Erro ao carregar.'
        if (cancelled) return
        // Only show error if we have no cached data to display
        if (!data) {
          setErrMsg(msg)
          setStatus('error')
        }
        if (LOG) console.log('[TABS] fetch error', { href, msg })
      }
    }

    run()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [href, active, refreshSeq])

  if (status === 'loading') return <TabSkeleton href={href} />
  if (status === 'error') {
    const isAcessoNegado = errMsg.toLowerCase().includes('acesso negado')
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-16 text-center">
        <div
          className="flex items-center justify-center rounded-full size-14"
          style={{ background: isAcessoNegado ? '#fef3c7' : '#fee2e2' }}
        >
          {isAcessoNegado ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-7" style={{ color: '#b45309' }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-7" style={{ color: '#dc2626' }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          )}
        </div>
        <div>
          <p className="font-semibold text-base" style={{ color: isAcessoNegado ? '#b45309' : '#dc2626' }}>
            {isAcessoNegado ? 'Acesso não autorizado' : 'Erro ao carregar'}
          </p>
          <p className="text-sm mt-1" style={{ color: 'var(--ac-muted)' }}>
            {isAcessoNegado
              ? 'Você não tem permissão para acessar este módulo. Fale com um administrador.'
              : errMsg}
          </p>
        </div>
      </div>
    )
  }

  if (!data) return null

  // Permite renderizar componente e manter state interno enquanto a aba estiver aberta.
  switch (data.kind) {
    case 'mp-detalhe':
      return <MPDetalheClient detalhe={data.detalhe} perm={data.perm} permEditarMov={data.permEditarMov} permVerMov={data.permVerMov} />
    case 'materias-primas':
      return <MPClient materiasPrimas={data.materiasPrimas} fornecedores={data.fornecedores} categoriasMateriaPrima={data.categoriasMateriaPrima} perm={data.perm} />
    case 'facas':
      return (
        <FacasClient
          facas={data.facas}
          categorias={data.categorias}
          materiasPrimas={data.materiasPrimas}
          perm={data.perm}
          verPrecoVenda={data.verPrecoVenda}
          verLucro={data.verLucro}
          taxasLucro={data.taxasLucro}
        />
      )
    case 'faca-detalhe':
      return <FacaDetalheClient detalhe={data.detalhe} materiasPrimas={data.materiasPrimas} categorias={data.categorias} perm={data.perm} verPrecoVenda={data.verPrecoVenda} />
    case 'fornecedores':
      return <FornecedoresClient fornecedores={data.fornecedores} perm={data.perm} />
    case 'ordens-compra':
      return <OcClient fila={data.fila} ordens={data.ordens} perm={data.perm} />
    case 'vendas':
      return <VendasClient pedidos={data.pedidos} clientes={data.clientes} facas={data.facas} usuarios={data.usuarios} perm={data.perm} />
    case 'clientes':
      return <ClientesClient clientes={data.clientes} perm={data.perm} />
    case 'usuarios':
      return <UsuariosClient usuarios={data.usuarios} cargos={data.cargos} perm={data.perm} />
    case 'cargos':
      return <CargosClient cargos={data.cargos} perm={data.perm} />
    case 'consumiveis':
      return <ConsumivelClient consumiveis={data.consumiveis} fornecedores={data.fornecedores} categoriasConsumivel={data.categoriasConsumivel} perm={data.perm} />
    case 'configuracoes':
      return (
        <ConfiguracoesClient
          categorias={data.categorias}
          categoriasMateriaPrima={data.categoriasMateriaPrima}
          categoriasConsumivel={data.categoriasConsumivel}
          taxasLucro={data.taxasLucro}
          permTaxasLucro={data.permTaxasLucro}
        />
      )
    case 'metricas-vendas':
      return <MetricasClient initialTab="vendas" vendasData={data.data} />
    case 'metricas-estoque':
      return <MetricasClient initialTab="estoque" estoqueData={data.data} />
    case 'metricas-conciliacao':
      return <MetricasClient initialTab="conciliacao" conciliacaoData={data.data} />
    default:
      return null
  }
}

function Wallpaper() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const hora = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const data = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div
      className="flex h-[calc(100vh-56px)] w-full flex-col items-center justify-center gap-8 select-none"
      style={{ background: 'var(--ac-bg)' }}
    >
      {/* Logo — mais visível e funciona em ambos os temas */}
      <div
        className="pointer-events-none"
        style={{
          filter: 'drop-shadow(0 2px 12px rgba(0,0,0,0.12))',
        }}
      >
        <Image
          src="/images/letreiro.png"
          alt="Alma Campeira"
          width={340}
          height={155}
          style={{ objectFit: 'contain', maxWidth: '55vw' }}
          priority
        />
      </div>

      {/* Relógio + data */}
      <div className="flex flex-col items-center gap-2">
        <span
          className="tabular-nums font-light"
          style={{
            fontSize: 'clamp(2rem, 5vw, 3.75rem)',
            color: 'var(--ac-text)',
            lineHeight: 1,
            letterSpacing: '0.06em',
          }}
        >
          {hora}
        </span>
        <span
          style={{
            fontSize: 'clamp(0.7rem, 1.4vw, 0.85rem)',
            color: 'var(--ac-muted)',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
          }}
        >
          {data}
        </span>
      </div>
    </div>
  )
}

/** Título na aba de detalhe de faca: nome completo até este tamanho; acima, reticências. */
const FACA_TAB_TITLE_MAX = 44

function formatFacaTabLabel(nome: string): string {
  const n = nome.trim()
  if (!n) return 'Faca'
  if (n.length <= FACA_TAB_TITLE_MAX) return n
  return `${n.slice(0, FACA_TAB_TITLE_MAX - 1)}…`
}

const HOLD_MS = 180

type DragState = {
  href: string
  index: number
  startX: number
  currentX: number
  tabWidths: number[]
  tabOffsets: number[]
  dropIndex: number
}

function ErpTabsContent() {
  const { openTabs, activeHref, selectTab, closeTab, reorderTabs, tabRefreshSeq, updateTabLabel } = useErpTabs()

  // Client-side data cache — stale-while-revalidate pattern.
  // Returning to a visited tab shows cached data instantly while refreshing in background.
  const dataCacheRef = useRef(new Map<string, ErpTabData>())

  const handleTabData = useCallback(
    (href: string, data: ErpTabData) => {
      dataCacheRef.current.set(href, data)

      if (data.kind === 'faca-detalhe') {
        const nome = data.detalhe.faca.nome?.trim() || data.detalhe.faca.codigo?.trim() || ''
        updateTabLabel(href, formatFacaTabLabel(nome))
      }
    },
    [updateTabLabel]
  )

  // Track which tabs have been visited at least once — only those get mounted.
  const [visited, setVisited] = useState<Set<string>>(() => new Set([activeHref]))

  useEffect(() => {
    setVisited((prev) => {
      if (prev.has(activeHref)) return prev
      const next = new Set(prev)
      next.add(activeHref)
      return next
    })
  }, [activeHref])

  // ── Background preloader: spiral expansion from active tab ──
  // After the active tab finishes loading, preloads all other open tabs
  // in expanding rings (left, right, left, right…). If the user switches
  // to an unloaded tab mid-process, the preloader cancels, waits for the
  // new active tab to load, and restarts the spiral from there.
  const preloadAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    // Abort any in-flight preload cycle
    preloadAbortRef.current?.abort()
    const controller = new AbortController()
    preloadAbortRef.current = controller
    const signal = controller.signal

    async function preload() {
      // 1. Wait for the active tab to finish loading into cache
      while (!dataCacheRef.current.has(activeHref) && !signal.aborted) {
        await new Promise((r) => setTimeout(r, 100))
      }
      if (signal.aborted) return

      // 2. Build spiral order from active tab index
      const idx = openTabs.findIndex((t) => t.href === activeHref)
      if (idx === -1) return

      const order: number[] = []
      let left = idx - 1
      let right = idx + 1
      while (left >= 0 || right < openTabs.length) {
        if (left >= 0) { order.push(left); left-- }
        if (right < openTabs.length) { order.push(right); right++ }
      }

      // 3. Load tabs one by one in spiral order
      for (const i of order) {
        if (signal.aborted) return
        const tab = openTabs[i]
        if (dataCacheRef.current.has(tab.href)) continue

        try {
          if (LOG) console.log('[TABS] preload start', { href: tab.href })
          const d = await getErpTabData(tab.href)
          if (signal.aborted) return

          dataCacheRef.current.set(tab.href, d)

          if (d.kind === 'faca-detalhe') {
            const nome = d.detalhe.faca.nome?.trim() || d.detalhe.faca.codigo?.trim() || ''
            updateTabLabel(tab.href, formatFacaTabLabel(nome))
          }

          // Mount the component so its state is preserved when user switches to it
          setVisited((prev) => {
            if (prev.has(tab.href)) return prev
            const next = new Set(prev)
            next.add(tab.href)
            return next
          })

          if (LOG) console.log('[TABS] preload done', { href: tab.href })
        } catch {
          if (LOG) console.log('[TABS] preload failed', { href: tab.href })
        }
      }

      // 4. Final sweep — check if any tab was missed (e.g. tabs opened during preload)
      for (const tab of openTabs) {
        if (signal.aborted) return
        if (dataCacheRef.current.has(tab.href)) continue
        try {
          const d = await getErpTabData(tab.href)
          if (signal.aborted) return
          dataCacheRef.current.set(tab.href, d)
          if (d.kind === 'faca-detalhe') {
            const nome = d.detalhe.faca.nome?.trim() || d.detalhe.faca.codigo?.trim() || ''
            updateTabLabel(tab.href, formatFacaTabLabel(nome))
          }
          setVisited((prev) => {
            if (prev.has(tab.href)) return prev
            const next = new Set(prev)
            next.add(tab.href)
            return next
          })
        } catch { /* skip */ }
      }
    }

    preload()

    return () => controller.abort()
    // Re-run whenever activeHref changes (cancels in-flight preload and restarts spiral)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeHref, openTabs, updateTabLabel])

  // Clean up visited set and data cache when tabs are closed
  useEffect(() => {
    const openHrefs = new Set(openTabs.map((t) => t.href))
    setVisited((prev) => {
      let changed = false
      for (const h of prev) {
        if (!openHrefs.has(h)) { changed = true; break }
      }
      if (!changed) return prev
      const next = new Set<string>()
      for (const h of prev) {
        if (openHrefs.has(h)) next.add(h)
        else dataCacheRef.current.delete(h)
      }
      return next
    })
  }, [openTabs])

  const containerRef = useRef<HTMLDivElement>(null)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const didDragRef = useRef(false)

  const clearHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }, [])

  const commitDrag = useCallback(() => {
    const d = dragRef.current
    if (!d) return
    if (d.index !== d.dropIndex) {
      reorderTabs(openTabs[d.index].href, openTabs[d.dropIndex].href)
    }
    dragRef.current = null
    setDrag(null)
  }, [openTabs, reorderTabs])

  const calcDropIndex = useCallback((d: DragState, clientX: number): number => {
    const dx = clientX - d.startX
    const draggedCenter = d.tabOffsets[d.index] + d.tabWidths[d.index] / 2 + dx

    let best = d.index
    let bestDist = Infinity
    for (let i = 0; i < d.tabOffsets.length; i++) {
      const center = d.tabOffsets[i] + d.tabWidths[i] / 2
      const dist = Math.abs(draggedCenter - center)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    }
    return best
  }, [])

  const onPointerDown = useCallback(
    (e: React.PointerEvent, href: string, index: number) => {
      if (e.button !== 0) return
      const closeBtnParent = (e.target as HTMLElement).closest('[data-tab-close]')
      if (closeBtnParent) return

      const startX = e.clientX
      const pointerId = e.pointerId

      clearHold()
      didDragRef.current = false

      holdTimerRef.current = setTimeout(() => {
        holdTimerRef.current = null
        didDragRef.current = true

        const container = containerRef.current
        if (!container) return

        const tabEls = Array.from(container.querySelectorAll('[data-tab-item]')) as HTMLElement[]
        const tabWidths = tabEls.map((el) => el.offsetWidth)
        const tabOffsets = tabEls.map((el) => el.offsetLeft)

        const state: DragState = {
          href,
          index,
          startX,
          currentX: startX,
          tabWidths,
          tabOffsets,
          dropIndex: index,
        }

        dragRef.current = state
        setDrag(state)

        try { container.setPointerCapture(pointerId) } catch { /* ok */ }
      }, HOLD_MS)
    },
    [clearHold]
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = dragRef.current
      if (!d) return

      const dropIndex = calcDropIndex(d, e.clientX)
      const next: DragState = { ...d, currentX: e.clientX, dropIndex }
      dragRef.current = next
      setDrag(next)
    },
    [calcDropIndex]
  )

  const onPointerUp = useCallback(() => {
    clearHold()
    if (dragRef.current) {
      commitDrag()
    }
  }, [clearHold, commitDrag])

  const getTabTransform = useCallback(
    (index: number) => {
      if (!drag) return undefined
      if (index === drag.index) {
        const dx = drag.currentX - drag.startX
        return `translateX(${dx}px)`
      }

      const { index: from, dropIndex: to, tabWidths } = drag
      const w = tabWidths[from]

      if (from < to && index > from && index <= to) return `translateX(${-w - 4}px)`
      if (from > to && index < from && index >= to) return `translateX(${w + 4}px)`

      return undefined
    },
    [drag]
  )

  if (openTabs.length === 0) {
    return <Wallpaper />
  }

  return (
    <div>
      {openTabs.length > 0 && (
        <div
          className="sticky top-0 z-20 w-full border-b"
          style={{
            borderColor: 'var(--ac-border)',
            background: 'color-mix(in srgb, var(--ac-bg) 92%, var(--ac-sidebar) 8%)',
          }}
        >
          <div
            ref={containerRef}
            className="flex items-center gap-1 overflow-x-auto px-2 py-2 sm:px-4"
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            style={{ touchAction: drag ? 'none' : undefined, userSelect: drag ? 'none' : undefined }}
          >
            {openTabs.map((tab, i) => {
              const isActive = tab.href === activeHref
              const tabIcon = getRouteIcon(tab.href)
              const isDragged = drag?.index === i
              const transform = getTabTransform(i)

              return (
                <div
                  key={tab.href}
                  data-tab-item
                  className="flex min-w-0 flex-shrink-0 items-center gap-2 rounded-md border pl-3 pr-1 py-1.5"
                  onMouseDown={(e) => {
                    if (e.button !== 1) return
                    e.preventDefault()
                  }}
                  onAuxClick={(e) => {
                    if (e.button !== 1) return
                    e.preventDefault()
                    closeTab(tab.href)
                  }}
                  onPointerDown={(e) => onPointerDown(e, tab.href, i)}
                  onClick={(e) => {
                    const target = e.target as HTMLElement
                    if (target.closest('[data-tab-close]')) return
                    if (didDragRef.current) return
                    selectTab(tab.href)
                  }}
                  style={{
                    borderColor: isActive ? 'var(--ac-accent)' : 'var(--ac-border)',
                    background: isActive
                      ? 'color-mix(in srgb, var(--ac-accent) 10%, transparent)'
                      : 'color-mix(in srgb, var(--ac-sidebar) 45%, transparent)',
                    transform,
                    transition: isDragged ? 'none' : 'transform 200ms cubic-bezier(.2,.8,.32,1)',
                    zIndex: isDragged ? 50 : undefined,
                    opacity: isDragged ? 0.85 : undefined,
                    cursor: drag ? 'grabbing' : undefined,
                    boxShadow: isDragged ? '0 4px 16px rgba(0,0,0,.18)' : undefined,
                    willChange: drag ? 'transform' : undefined,
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      if (didDragRef.current) return
                      selectTab(tab.href)
                    }}
                    className="flex min-w-0 flex-1 items-center gap-2 self-stretch text-left"
                    style={{ color: isActive ? 'var(--ac-accent)' : 'var(--ac-text)' }}
                    title={tab.label}
                  >
                    {tabIcon ? (
                      <span className="flex-shrink-0" style={{ color: isActive ? 'var(--ac-accent)' : 'var(--ac-muted)' }}>
                        {tabIcon}
                      </span>
                    ) : null}
                    <span
                      className={
                        tab.href.startsWith('/facas/')
                          ? 'truncate max-w-[min(20rem,78vw)] sm:max-w-[min(24rem,55vw)] lg:max-w-[28rem] text-xs sm:text-sm'
                          : 'truncate max-w-[180px] sm:max-w-[220px] text-xs sm:text-sm'
                      }
                    >
                      {tab.label}
                    </span>
                  </button>

                  <button
                    type="button"
                    data-tab-close
                    aria-label={`Fechar aba ${tab.label}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      closeTab(tab.href)
                    }}
                    className="rounded p-1 transition-colors hover:opacity-80"
                    style={{ color: 'var(--ac-muted)' }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-3.5">
                      <path d="M18 6 6 18" />
                      <path d="m6 6 12 12" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div>
        {openTabs.map((tab) => {
          const isActive = tab.href === activeHref
          // Only mount tabs that have been visited at least once.
          // On refresh, only the active tab mounts & fetches data.
          // Switching to another tab mounts it for the first time (lazy).
          if (!visited.has(tab.href)) {
            return isActive ? (
              <div key={tab.href}>
                <TabSkeleton href={tab.href} />
              </div>
            ) : null
          }
          return (
            <div key={tab.href} style={{ display: isActive ? 'block' : 'none' }}>
              <TabPane
                href={tab.href}
                cachedData={dataCacheRef.current.get(tab.href)}
                onData={handleTabData}
                active={isActive}
                refreshSeq={tabRefreshSeq[tab.href] ?? 0}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

type ErpTabsProviderProps = {
  children: ReactNode
}

export function ErpTabsProvider({ children }: ErpTabsProviderProps) {
  const router = useRouter()
  const pathname = usePathname()
  const initialHref = useMemo(() => normalizeHref(pathname), [pathname])
  const initialLabel = useMemo(() => getRouteLabel(initialHref), [initialHref])

  // Estado inicial precisa ser idêntico no servidor e no primeiro paint do cliente (sem localStorage),
  // senão a hidratação quebra. Abas persistidas são aplicadas em useEffect após montar.
  const [openTabs, setOpenTabs] = useState<OpenTab[]>(() => [{ href: initialHref, label: initialLabel }])
  const [activeHref, setActiveHref] = useState<string>(() => initialHref)

  const primeiraRotaRef = useRef<{ href: string; label: string } | null>(null)
  if (primeiraRotaRef.current === null) {
    primeiraRotaRef.current = { href: initialHref, label: initialLabel }
  }

  /** Evita sobrescrever estado na 1ª execução (hidratação de abas ainda roda depois). */
  const pathnameSyncSkippedOnce = useRef(false)

  // Sinal para refetch por aba (usado pelos CRUDs para atualizar só a aba ativa)
  const [tabRefreshSeq, setTabRefreshSeq] = useState<Record<string, number>>({})
  const refreshTab = useCallback((href: string) => {
    const normalizedHref = normalizeHref(href)
    setTabRefreshSeq((prev) => ({ ...prev, [normalizedHref]: (prev[normalizedHref] ?? 0) + 1 }))
  }, [])

  const refreshActiveTab = useCallback(() => {
    if (!activeHref) return
    refreshTab(activeHref)
  }, [activeHref, refreshTab])

  const persist = useCallback((tabs: OpenTab[], active: string) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs))
    localStorage.setItem(ACTIVE_KEY, active)
  }, [])

  // Hidrata abas / aba ativa a partir do localStorage uma vez após o primeiro paint (alinha com SSR).
  useEffect(() => {
    const snap = primeiraRotaRef.current
    if (!snap) return
    const { href: ih, label: il } = snap
    const defaultTab: OpenTab = { href: ih, label: il }
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      persist([defaultTab], ih)
      return
    }
    const storedTabs = parseStoredTabs(raw)
    if (storedTabs.length === 0) {
      setOpenTabs([defaultTab])
      setActiveHref(ih)
      persist([defaultTab], ih)
      return
    }
    setOpenTabs(storedTabs)
    const storedActive = localStorage.getItem(ACTIVE_KEY)
    const normalizedActive = storedActive ? normalizeHref(storedActive) : storedTabs[0]?.href
    if (normalizedActive) setActiveHref(normalizedActive)
    // Não depende de pathname: só hidrata na montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [persist])

  // Voltar / avançar do navegador: URL é a fonte da verdade após a primeira navegação.
  useEffect(() => {
    const normalized = normalizeHref(pathname)
    if (!pathnameSyncSkippedOnce.current) {
      pathnameSyncSkippedOnce.current = true
      return
    }
    setActiveHref(normalized)
    setOpenTabs((prev) => {
      const exists = prev.some((t) => t.href === normalized)
      const next = exists ? prev : [...prev, { href: normalized, label: getRouteLabel(normalized) }]
      persist(next, normalized)
      return next
    })
  }, [pathname, persist])

  const openTab = useCallback(
    (href: string) => {
      const normalizedHref = normalizeHref(href)
      const label = getRouteLabel(normalizedHref)

      setOpenTabs((prev) => {
        const exists = prev.some((t) => t.href === normalizedHref)
        const next = exists ? prev : [...prev, { href: normalizedHref, label }]
        if (LOG) console.log('[TABS] openTab', { href: normalizedHref, nextLen: next.length })
        persist(next, normalizedHref)
        setActiveHref(normalizedHref)
        return next
      })
      router.push(normalizedHref)
    },
    [persist, router]
  )

  const selectTab = useCallback(
    (href: string) => {
      const normalizedHref = normalizeHref(href)
      const label = getRouteLabel(normalizedHref)
      if (LOG) console.log('[TABS] selectTab', { href: normalizedHref })
      setOpenTabs((prev) => {
        const exists = prev.some((t) => t.href === normalizedHref)
        const next = exists ? prev : [...prev, { href: normalizedHref, label }]
        persist(next, normalizedHref)
        return next
      })
      setActiveHref(normalizedHref)
      router.push(normalizedHref)
    },
    [persist, router]
  )

  const closeTab = useCallback(
    (href: string) => {
      const normalizedHref = normalizeHref(href)
      const pathAtClose = normalizeHref(pathname)
      setOpenTabs((prev) => {
        const remaining = prev.filter((t) => t.href !== normalizedHref)
        const closingActive = pathAtClose === normalizedHref
        const nextActive = remaining[remaining.length - 1]?.href ?? ''
        const dest = nextActive || ERP_FALLBACK_HREF
        if (LOG) console.log('[TABS] closeTab', { href: normalizedHref, remaining: remaining.length })
        if (closingActive) {
          setActiveHref(dest)
          persist(remaining, dest)
          queueMicrotask(() => router.push(dest))
        } else {
          persist(remaining, pathAtClose)
        }
        return remaining
      })
    },
    [persist, pathname, router]
  )

  const reorderTabs = useCallback(
    (fromHref: string, toHref: string) => {
      const fromNorm = normalizeHref(fromHref)
      const toNorm = normalizeHref(toHref)
      if (fromNorm === toNorm) return

      setOpenTabs((prev) => {
        const fromIndex = prev.findIndex((t) => t.href === fromNorm)
        const toIndex = prev.findIndex((t) => t.href === toNorm)
        if (fromIndex < 0 || toIndex < 0) return prev

        const next = [...prev]
        const [moved] = next.splice(fromIndex, 1)
        next.splice(toIndex, 0, moved)

        if (LOG) console.log('[TABS] reorderTabs', { fromNorm, toNorm })
        persist(next, activeHref)
        return next
      })
    },
    [activeHref, persist]
  )

  const updateTabLabel = useCallback(
    (href: string, label: string) => {
      const normalizedHref = normalizeHref(href)
      setOpenTabs((prev) => {
        const idx = prev.findIndex((t) => t.href === normalizedHref)
        if (idx < 0) return prev
        if (prev[idx].label === label) return prev
        const next = [...prev]
        next[idx] = { ...next[idx], label }
        persist(next, activeHref)
        return next
      })
    },
    [persist, activeHref]
  )

  const value: ErpTabsContextValue = useMemo(
    () => ({
      openTabs,
      activeHref,
      openTab,
      selectTab,
      closeTab,
      reorderTabs,
      updateTabLabel,
      tabRefreshSeq,
      refreshTab,
      refreshActiveTab,
    }),
    [
      openTabs,
      activeHref,
      openTab,
      selectTab,
      closeTab,
      reorderTabs,
      updateTabLabel,
      tabRefreshSeq,
      refreshTab,
      refreshActiveTab,
    ]
  )

  return <ErpTabsContext.Provider value={value}>{children}</ErpTabsContext.Provider>
}

export function ErpTabs() {
  return <ErpTabsContent />
}
