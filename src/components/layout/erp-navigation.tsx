import type { ReactNode } from 'react'

export type NavItem = {
  href: string
  label: string
  available: boolean
  icon: ReactNode
}

export type NavSection = {
  label: string
  items: NavItem[]
}

const iconMP = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-[18px]">
    <path d="M4 8h16" />
    <path d="M6 8V6.8a1.8 1.8 0 0 1 1.8-1.8h8.4A1.8 1.8 0 0 1 18 6.8V8" />
    <rect x="5" y="8" width="14" height="11" rx="2" />
    <path d="M9 12h6" />
    <path d="M9 15h4" />
  </svg>
)

const iconFaca = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">
    <path d="M3 22 L7 18" />
    <path d="M6 14 L10 18" />
    <path d="M8 16 L20 4" />
    <path d="M9 17 C12 14 17 9 20 4 L21 5" />
  </svg>
)

const iconFornecedor = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-[18px]">
    <rect x="1" y="3" width="15" height="13" rx="1" />
    <path d="M16 8h4l3 5v3h-7V8z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
)

const iconOC = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-[18px]">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
)

const iconVendas = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-[18px]">
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </svg>
)

const iconClientes = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-[18px]">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const iconUsuarios = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-[18px]">
    <circle cx="12" cy="8" r="4" />
    <path d="M20 21a8 8 0 1 0-16 0" />
  </svg>
)

const iconCargos = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
)

const iconConfiguracoes = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-[18px]">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

export const sections: NavSection[] = [
  {
    label: 'Estoque',
    items: [
      { href: '/materias-primas', label: 'Matérias-Primas', available: true, icon: iconMP },
      { href: '/facas', label: 'Facas', available: true, icon: iconFaca },
    ],
  },
  {
    label: 'Compras',
    items: [
      { href: '/fornecedores', label: 'Fornecedores', available: true, icon: iconFornecedor },
      { href: '/ordens-compra', label: 'Ordens de Compra', available: true, icon: iconOC },
    ],
  },
  {
    label: 'Vendas',
    items: [
      { href: '/vendas', label: 'Vendas', available: true, icon: iconVendas },
      { href: '/clientes', label: 'Clientes', available: true, icon: iconClientes },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { href: '/usuarios', label: 'Usuários', available: true, icon: iconUsuarios },
      { href: '/cargos', label: 'Cargos', available: true, icon: iconCargos },
    ],
  },
]

const extraRouteLabels: Record<string, string> = {
  '/configuracoes': 'Configurações',
}

const routeLabelMap = sections.reduce<Record<string, string>>((acc, section) => {
  section.items.forEach((item) => {
    acc[item.href] = item.label
  })
  return acc
}, extraRouteLabels)

export function normalizePath(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname
}

export function getRouteLabel(pathname: string) {
  const normalized = normalizePath(pathname)
  return routeLabelMap[normalized] ?? 'Página'
}

const extraRouteIcons: Record<string, ReactNode> = {
  '/configuracoes': iconConfiguracoes,
}

const routeIconMap = sections.reduce<Record<string, ReactNode>>((acc, section) => {
  section.items.forEach((item) => {
    acc[item.href] = item.icon
  })
  return acc
}, extraRouteIcons)

export function getRouteIcon(hrefOrPathname: string) {
  const [pathOnly] = hrefOrPathname.split('?')
  const normalized = normalizePath(pathOnly || '/')
  return routeIconMap[normalized] ?? null
}
