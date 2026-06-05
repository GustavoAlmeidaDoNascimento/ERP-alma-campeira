// Skeletons por rota — usados tanto em `loading.tsx` (navegação inicial)
// quanto como `fallback` do <Suspense> dentro do page.tsx (re-render com
// novas searchParams). Manter os dois em sincronia.

import {
  TablePageSkeleton,
  OcPageSkeleton,
  MetricasSkeleton,
  DashboardSkeleton,
  DetailPageSkeleton,
} from './page-skeleton'

export function FacaDetalheSkeleton() {
  return <DetailPageSkeleton />
}

export function MateriaPrimaDetalheSkeleton() {
  return <DetailPageSkeleton />
}

export function ClientesSkeleton() {
  return (
    <TablePageSkeleton
      titleWidth={120}
      buttonWidth={150}
      searchWidth={384}
      columns={[
        { width: 220 },
        { width: 160 },
        { width: 110 },
        { width: 200 },
        { width: 220 },
        { width: 80, align: 'right' },
      ]}
      rows={8}
    />
  )
}

export function FornecedoresSkeleton() {
  return (
    <TablePageSkeleton
      titleWidth={150}
      buttonWidth={170}
      searchWidth={384}
      columns={[
        { width: 220 },
        { width: 160 },
        { width: 180 },
        { width: 140 },
        { width: 200 },
        { width: 140 },
        { width: 80, align: 'right' },
      ]}
      rows={8}
    />
  )
}

export function CargosSkeleton() {
  return (
    <TablePageSkeleton
      titleWidth={100}
      buttonWidth={140}
      searchWidth={320}
      columns={[
        { width: 200 },
        { width: 320 },
        { width: 120 },
        { width: 80, align: 'right' },
      ]}
      rows={6}
    />
  )
}

export function UsuariosSkeleton() {
  return (
    <TablePageSkeleton
      titleWidth={130}
      buttonWidth={160}
      searchWidth={320}
      columns={[
        { width: 220 },
        { width: 240 },
        { width: 160 },
        { width: 100 },
        { width: 140 },
        { width: 80, align: 'right' },
      ]}
      rows={6}
    />
  )
}

export function MateriasPrimasSkeleton() {
  return (
    <TablePageSkeleton
      titleWidth={180}
      buttonWidth={170}
      searchWidth={384}
      columns={[
        { width: 64 },
        { width: 140 },
        { width: 260 },
        { width: 160 },
        { width: 180 },
        { width: 80, align: 'right' },
      ]}
      rows={8}
    />
  )
}

export function ConsumiveisSkeleton() {
  return (
    <TablePageSkeleton
      titleWidth={160}
      buttonWidth={170}
      searchWidth={384}
      columns={[
        { width: 64 },
        { width: 140 },
        { width: 260 },
        { width: 160 },
        { width: 180 },
        { width: 80, align: 'right' },
      ]}
      rows={8}
    />
  )
}

export function FacasSkeleton() {
  return (
    <TablePageSkeleton
      titleWidth={90}
      buttonWidth={150}
      searchWidth={384}
      columns={[
        { width: 64 },
        { width: 140 },
        { width: 240 },
        { width: 150 },
        { width: 110 },
        { width: 110, align: 'right' },
        { width: 80, align: 'right' },
      ]}
      rows={8}
    />
  )
}

export function OrcamentosSkeleton() {
  return (
    <TablePageSkeleton
      titleWidth={140}
      buttonWidth={170}
      searchWidth={384}
      filters={3}
      columns={[
        { width: 100 },
        { width: 200 },
        { width: 110 },
        { width: 120 },
        { width: 110, align: 'right' },
        { width: 80, align: 'right' },
      ]}
      rows={8}
    />
  )
}

export function VendasSkeleton() {
  return (
    <TablePageSkeleton
      titleWidth={110}
      buttonWidth={160}
      searchWidth={384}
      filters={3}
      columns={[
        { width: 100 },
        { width: 200 },
        { width: 110 },
        { width: 120 },
        { width: 110, align: 'right' },
        { width: 80, align: 'right' },
      ]}
      rows={8}
    />
  )
}

export function BoletosSkeleton() {
  return (
    <TablePageSkeleton
      titleWidth={110}
      buttonWidth={160}
      searchWidth={384}
      filters={3}
      columns={[
        { width: 100 },
        { width: 220 },
        { width: 140 },
        { width: 120 },
        { width: 110, align: 'right' },
        { width: 100, align: 'right' },
        { width: 80, align: 'right' },
      ]}
      rows={8}
    />
  )
}

export function GastosSkeleton() {
  return (
    <TablePageSkeleton
      titleWidth={110}
      buttonWidth={150}
      searchWidth={384}
      filters={2}
      columns={[
        { width: 100 },
        { width: 130 },
        { width: 240 },
        { width: 110, align: 'right' },
        { width: 130 },
        { width: 130 },
        { width: 140 },
        { width: 80, align: 'right' },
      ]}
      rows={8}
    />
  )
}

export function MovimentacaoSkeleton() {
  return (
    <TablePageSkeleton
      titleWidth={150}
      buttonWidth={170}
      searchWidth={384}
      filters={3}
      columns={[
        { width: 100 },
        { width: 110 },
        { width: 260 },
        { width: 130 },
        { width: 130 },
        { width: 110, align: 'right' },
        { width: 80, align: 'right' },
      ]}
      rows={8}
    />
  )
}

export function OrdensCompraSkeleton() {
  return <OcPageSkeleton />
}

export function ConfiguracoesSkeleton() {
  return <DashboardSkeleton titleWidth={220} cards={6} />
}

export function MetricasPageSkeleton() {
  return <MetricasSkeleton />
}
