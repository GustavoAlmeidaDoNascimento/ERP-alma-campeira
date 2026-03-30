import { MetricasClient } from '@/components/metricas/metricas-client'

export const metadata = { title: 'Métricas — Alma Campeira' }

export default function MetricasPage() {
  return (
    <div data-nav-content-ready="Métricas">
      <MetricasClient />
    </div>
  )
}
