import { MetricasClient } from '@/components/metricas/metricas-client'

export const metadata = { title: 'Métricas de Estoque — Alma Campeira' }

export default function MetricasEstoquePage() {
  return (
    <div data-nav-content-ready="Métricas de Estoque">
      <MetricasClient initialTab="estoque" />
    </div>
  )
}
