'use client'

import { type CSSProperties, useEffect, useState } from 'react'
import { brParaIso, isoParaBR, mascararDataBR } from '@/lib/utils/datas'

type Props = {
  id?: string
  label?: string
  value: string
  onChange: (iso: string) => void
  disabled?: boolean
  className?: string
  style?: CSSProperties
  placeholder?: string
}

export function DateInputBR({
  id,
  label,
  value,
  onChange,
  disabled,
  className = '',
  style,
  placeholder = 'dd/mm/aaaa',
}: Props) {
  const [texto, setTexto] = useState(() => isoParaBR(value))
  const comLabel = Boolean(label)

  useEffect(() => {
    setTexto(isoParaBR(value))
  }, [value])

  function commit(next: string) {
    const trimmed = next.trim()
    if (!trimmed) {
      onChange('')
      setTexto('')
      return
    }
    const iso = brParaIso(trimmed)
    if (iso) {
      onChange(iso)
      setTexto(isoParaBR(iso))
    } else {
      setTexto(isoParaBR(value))
    }
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    commit(texto)
    if (comLabel) {
      e.currentTarget.style.borderColor = 'var(--ac-border)'
      e.currentTarget.style.boxShadow = 'none'
    }
  }

  const input = (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      disabled={disabled}
      placeholder={placeholder}
      value={texto}
      onChange={(e) => setTexto(mascararDataBR(e.target.value))}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit(texto)
          ;(e.target as HTMLInputElement).blur()
        }
      }}
      className={
        comLabel
          ? `w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all ${className}`
          : className
      }
      style={
        comLabel
          ? {
              background: 'var(--ac-card)',
              border: '1px solid var(--ac-border)',
              color: 'var(--ac-text)',
              ...style,
            }
          : style
      }
      onFocus={
        comLabel
          ? (e) => {
              e.currentTarget.style.borderColor = 'var(--ac-accent)'
              e.currentTarget.style.boxShadow =
                '0 0 0 3px color-mix(in srgb, var(--ac-accent) 20%, transparent)'
            }
          : undefined
      }
    />
  )

  if (!comLabel) return input

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>
        {label}
      </label>
      {input}
    </div>
  )
}
