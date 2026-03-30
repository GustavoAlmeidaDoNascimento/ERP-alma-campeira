'use client'

type BarHorizontalProps = {
  percentage: number
  color?: string
  height?: number
}

export function BarHorizontal({ percentage, color = 'var(--ac-accent)', height = 8 }: BarHorizontalProps) {
  const clamped = Math.max(0, Math.min(100, percentage))
  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ height, background: 'color-mix(in srgb, var(--ac-border) 50%, transparent)' }}
    >
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${clamped}%`, background: color }}
      />
    </div>
  )
}
