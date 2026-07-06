/**
 * Wrapper simples para medir latência de Server Actions / queries em dev.
 *
 * Uso: `return withTiming('getMatériasPrimas', () => prisma.materiaPrima.findMany())`
 *
 * Em produção é no-op (zero overhead). Em dev imprime a latência no stdout
 * com indicador visual quando passa de 100ms (alvo p95 da Fase 3 do plano).
 */

const ENABLED = process.env.NODE_ENV !== 'production'
const SLOW_MS = 100

export async function withTiming<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!ENABLED) return fn()
  const start = performance.now()
  try {
    return await fn()
  } finally {
    const ms = Math.round(performance.now() - start)
    const marker = ms > SLOW_MS ? '🐌' : '⚡'
    // eslint-disable-next-line no-console
    console.log(`[PERF] ${marker} ${label} ${ms}ms`)
  }
}
