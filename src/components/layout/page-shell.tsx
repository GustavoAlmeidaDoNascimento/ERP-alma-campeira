import { PageSkeleton } from '@/components/ui/page-skeleton'

export function PageShellTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex items-center justify-between px-8 py-6" style={{ borderBottom: '1px solid var(--ac-border)' }}>
      <div>
        <h1 data-nav-page-title={title} className="text-2xl font-bold" style={{ color: 'var(--ac-text)' }}>{title}</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--ac-muted)' }}>{subtitle}</p>
      </div>
    </div>
  )
}

/**
 * Fallback genérico para Suspense. Páginas devem preferir passar um skeleton
 * específico (ex: TablePageSkeleton com as colunas reais) para o swap visual
 * ficar imperceptível.
 */
export function PageShellFallback() {
  return <PageSkeleton />
}
