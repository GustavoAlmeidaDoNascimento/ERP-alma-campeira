'use client'

type KpiCardProps = {
  label: string
  value: string
  detail?: string
  accent?: string
}

export function KpiCard({ label, value, detail, accent }: KpiCardProps) {
  return (
    <div
      className="rounded-xl border p-4 space-y-1"
      style={{ borderColor: 'var(--ac-border)', background: 'var(--ac-card)' }}
    >
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
        {label}
      </p>
      <p className="text-2xl font-bold" style={{ color: accent ?? 'var(--ac-text)' }}>
        {value}
      </p>
      {detail && (
        <p className="text-xs" style={{ color: 'var(--ac-muted)' }}>
          {detail}
        </p>
      )}
    </div>
  )
}
