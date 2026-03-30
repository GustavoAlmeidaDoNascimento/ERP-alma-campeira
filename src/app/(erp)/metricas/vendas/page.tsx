import { MetricasClient } from '@/components/metricas/metricas-client'

export const metadata = { title: 'Métricas de Vendas — Alma Campeira' }

export default function MetricasVendasPage() {
  return (
    <div data-nav-content-ready="Métricas de Vendas">
      <MetricasClient initialTab="vendas" />
    </div>
  )
}
