export type PeriodoId = 'este_mes' | 'mes_passado' | '30d' | '60d' | '90d' | '1ano' | 'tudo'

export const PERIODOS: { id: PeriodoId; label: string }[] = [
  { id: 'este_mes', label: 'Este mês' },
  { id: 'mes_passado', label: 'Mês passado' },
  { id: '30d', label: '30 dias' },
  { id: '60d', label: '60 dias' },
  { id: '90d', label: '90 dias' },
  { id: '1ano', label: '1 ano' },
  { id: 'tudo', label: 'Todo o tempo' },
]
