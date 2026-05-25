// Skeletons de página — espelham fielmente o chrome real (px-8 py-6 header,
// busca, tabela com bordas idênticas) para que o swap entre fallback e
// conteúdo final seja imperceptível, criando a sensação de "tudo instantâneo".

type SkeletonBoxProps = {
  className?: string
  width?: number | string
  height?: number | string
  rounded?: string
  style?: React.CSSProperties
}

function Box({ className = '', width, height, rounded = 'rounded', style }: SkeletonBoxProps) {
  return (
    <div
      className={`${rounded} ${className}`}
      style={{
        background: 'var(--ac-border)',
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
    />
  )
}

type Column = {
  /** largura em px da célula da coluna (skeleton) */
  width: number
  /** alinhar à direita (ações, valores) */
  align?: 'left' | 'right'
}

export type TablePageSkeletonProps = {
  /** largura aproximada do título em px (deve casar com o título real) */
  titleWidth?: number
  /** largura do botão à direita (0 = sem botão) */
  buttonWidth?: number
  /** largura da barra de busca (0 = sem busca) */
  searchWidth?: number
  /** colunas da tabela */
  columns?: Column[]
  /** quantas linhas de skeleton */
  rows?: number
  /** filtros extras acima da tabela (chips, selects) */
  filters?: number
}

/**
 * Skeleton genérico de página com tabela — usado por clientes, fornecedores,
 * cargos, materias-primas, facas, consumiveis, usuarios, vendas, orçamentos,
 * boletos, gastos. Parametrizado para casar com as colunas reais.
 */
export function TablePageSkeleton({
  titleWidth = 160,
  buttonWidth = 140,
  searchWidth = 320,
  columns = [
    { width: 140 },
    { width: 100 },
    { width: 120 },
    { width: 100 },
    { width: 80, align: 'right' },
  ],
  rows = 8,
  filters = 0,
}: TablePageSkeletonProps = {}) {
  return (
    <div className="animate-pulse" data-skeleton="table-page">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 sm:px-8 py-6"
        style={{ borderBottom: '1px solid var(--ac-border)' }}
      >
        <div className="space-y-2">
          <Box width={titleWidth} height={24} rounded="rounded-md" />
          <Box width={Math.max(80, Math.floor(titleWidth * 0.6))} height={12} />
        </div>
        {buttonWidth > 0 && <Box width={buttonWidth} height={36} rounded="rounded-lg" />}
      </div>

      {/* Busca */}
      {searchWidth > 0 && (
        <div className="px-4 sm:px-8 py-4">
          <Box width={searchWidth} height={38} rounded="rounded-lg" style={{ maxWidth: '100%' }} />
        </div>
      )}

      {/* Filtros (chips/selects) */}
      {filters > 0 && (
        <div className="px-4 sm:px-8 pb-2 flex flex-wrap gap-2">
          {Array.from({ length: filters }).map((_, i) => (
            <Box key={i} width={110 + (i * 23) % 60} height={28} rounded="rounded-full" />
          ))}
        </div>
      )}

      {/* Tabela */}
      <div className="px-4 sm:px-8 pb-8">
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--ac-border)' }}
        >
          {/* Header da tabela */}
          <div
            className="flex items-center gap-4 px-4 py-3"
            style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}
          >
            {columns.map((c, i) => (
              <div
                key={i}
                className={c.align === 'right' ? 'ml-auto' : ''}
                style={{ width: c.width }}
              >
                <Box width={Math.min(c.width, 70)} height={10} />
              </div>
            ))}
          </div>

          {/* Linhas */}
          {Array.from({ length: rows }).map((_, ri) => (
            <div
              key={ri}
              className="flex items-center gap-4 px-4 py-3.5"
              style={{
                background: 'var(--ac-card)',
                borderTop: ri > 0 ? '1px solid var(--ac-border)' : undefined,
              }}
            >
              {columns.map((c, ci) => {
                // Variar largura da célula para parecer dados reais
                const cellW = Math.max(40, c.width - 20 - ((ri * 17 + ci * 11) % 40))
                return (
                  <div
                    key={ci}
                    className={c.align === 'right' ? 'ml-auto' : ''}
                    style={{ width: c.width }}
                  >
                    <Box width={cellW} height={12} />
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Skeleton de página dashboard/configurações — cards empilhados.
 */
export function DashboardSkeleton({
  titleWidth = 200,
  cards = 4,
}: { titleWidth?: number; cards?: number } = {}) {
  return (
    <div className="animate-pulse" data-skeleton="dashboard">
      <div
        className="px-4 sm:px-8 py-6"
        style={{ borderBottom: '1px solid var(--ac-border)' }}
      >
        <div className="space-y-2">
          <Box width={titleWidth} height={24} rounded="rounded-md" />
          <Box width={Math.max(120, Math.floor(titleWidth * 0.7))} height={12} />
        </div>
      </div>
      <div className="px-4 sm:px-8 py-6 space-y-4">
        {Array.from({ length: cards }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-5 space-y-3"
            style={{ border: '1px solid var(--ac-border)', background: 'var(--ac-card)' }}
          >
            <Box width={180 + (i * 37) % 100} height={16} rounded="rounded-md" />
            <Box width="100%" height={10} style={{ maxWidth: 480 }} />
            <div className="flex gap-2 pt-1">
              <Box width={120} height={32} rounded="rounded-lg" />
              <Box width={90} height={32} rounded="rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Skeleton para a página de Métricas/Relatórios — KPIs em grid + gráfico.
 */
export function MetricasSkeleton() {
  return (
    <div
      className="w-full min-w-0 max-w-full overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8 space-y-5 mx-auto animate-pulse"
      data-skeleton="metricas"
    >
      <header className="space-y-2 max-w-3xl">
        <Box width={90} height={10} />
        <Box width={320} height={28} rounded="rounded-md" />
        <Box width={420} height={12} />
      </header>

      {/* Filtros de período */}
      <div className="flex flex-wrap gap-2">
        <Box width={150} height={36} rounded="rounded-lg" />
        <Box width={150} height={36} rounded="rounded-lg" />
        <Box width={110} height={36} rounded="rounded-lg" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: 'color-mix(in srgb, var(--ac-border) 40%, transparent)' }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Box key={i} width={120} height={32} rounded="rounded-md" />
        ))}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-4 space-y-2"
            style={{ border: '1px solid var(--ac-border)', background: 'var(--ac-card)' }}
          >
            <Box width={90} height={10} />
            <Box width={130} height={22} rounded="rounded-md" />
            <Box width={70} height={10} />
          </div>
        ))}
      </div>

      {/* Gráfico */}
      <div
        className="rounded-xl p-5"
        style={{ border: '1px solid var(--ac-border)', background: 'var(--ac-card)', height: 320 }}
      >
        <Box width={180} height={14} rounded="rounded-md" />
        <div className="mt-6 flex items-end gap-3 h-56">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex-1"
              style={{
                background: 'var(--ac-border)',
                height: `${30 + (i * 27) % 70}%`,
                borderRadius: 4,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Skeleton para Ordens de Compra — header + tabs + tabela com filtros de período.
 */
export function OcPageSkeleton() {
  return (
    <div className="animate-pulse" data-skeleton="oc">
      <div
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-4 sm:px-8 py-6"
        style={{ borderBottom: '1px solid var(--ac-border)' }}
      >
        <div className="space-y-2">
          <Box width={220} height={24} rounded="rounded-md" />
          <Box width={180} height={12} />
        </div>
        <Box width={200} height={36} rounded="rounded-lg" />
      </div>

      {/* Tabs */}
      <div className="px-4 sm:px-8 pt-5">
        <div className="flex gap-1 p-1 rounded-lg w-fit" style={{ background: 'color-mix(in srgb, var(--ac-border) 40%, transparent)' }}>
          <Box width={160} height={30} rounded="rounded-md" />
          <Box width={160} height={30} rounded="rounded-md" />
        </div>
      </div>

      {/* Conteúdo da aba (fila) */}
      <div className="px-4 sm:px-8 py-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Box width={60} height={12} />
          <Box width={130} height={28} rounded="rounded" />
          <Box width={30} height={12} />
          <Box width={130} height={28} rounded="rounded" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-4 flex items-center gap-4"
            style={{ border: '1px solid var(--ac-border)', background: 'var(--ac-card)' }}
          >
            <Box width={50} height={50} rounded="rounded-lg" />
            <div className="flex-1 space-y-2">
              <Box width={220 + (i * 33) % 80} height={14} rounded="rounded-md" />
              <Box width={160 + (i * 19) % 60} height={11} />
            </div>
            <Box width={90} height={20} rounded="rounded-full" />
            <Box width={70} height={28} rounded="rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Skeleton para páginas de detalhe (faca/[id], materia-prima/[id]).
 * Header com botão de voltar + foto + dados, depois cards/abas.
 */
export function DetailPageSkeleton() {
  return (
    <div className="animate-pulse" data-skeleton="detail">
      <div
        className="flex items-center gap-3 px-4 sm:px-8 py-4"
        style={{ borderBottom: '1px solid var(--ac-border)' }}
      >
        <Box width={32} height={32} rounded="rounded-lg" />
        <Box width={180} height={20} rounded="rounded-md" />
      </div>

      <div className="px-4 sm:px-8 py-6 grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        <div className="space-y-4">
          <Box width="100%" height={260} rounded="rounded-xl" />
          <Box width={140} height={32} rounded="rounded-lg" />
        </div>
        <div className="space-y-4">
          <div
            className="rounded-xl p-5 space-y-3"
            style={{ border: '1px solid var(--ac-border)', background: 'var(--ac-card)' }}
          >
            <Box width={160} height={14} />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Box width={80} height={10} />
                  <Box width={140} height={14} />
                </div>
              ))}
            </div>
          </div>
          <div
            className="rounded-xl p-5 space-y-3"
            style={{ border: '1px solid var(--ac-border)', background: 'var(--ac-card)' }}
          >
            <Box width={200} height={14} />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Box width={40} height={40} rounded="rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Box width={`${50 + (i * 13) % 30}%`} height={12} />
                  <Box width={`${30 + (i * 11) % 25}%`} height={10} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Fallback genérico — manter para compatibilidade com código antigo.
 * Novos usos devem preferir o skeleton específico de cada página.
 */
export function PageSkeleton() {
  return <TablePageSkeleton />
}
