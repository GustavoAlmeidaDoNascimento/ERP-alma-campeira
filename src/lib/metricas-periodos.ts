export type DateRange = { desde: string; ate: string }

/** Padrão: últimos 30 dias (de hoje - 30 até hoje, inclusive) */
export function defaultDateRange(): DateRange {
  const ate = new Date()
  const desde = new Date()
  desde.setDate(desde.getDate() - 30)
  return {
    desde: desde.toISOString().split('T')[0],
    ate: ate.toISOString().split('T')[0],
  }
}
