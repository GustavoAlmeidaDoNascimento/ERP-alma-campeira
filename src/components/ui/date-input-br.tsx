'use client'

import { type CSSProperties, useEffect, useRef, useState } from 'react'
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
  withPicker?: boolean
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
  withPicker = true,
}: Props) {
  const [texto, setTexto] = useState(() => isoParaBR(value))
  const comLabel = Boolean(label)
  const pickerRef = useRef<HTMLInputElement>(null)

  function abrirPicker() {
    const el = pickerRef.current
    if (!el) return
    type WithShowPicker = HTMLInputElement & { showPicker?: () => void }
    const elx = el as WithShowPicker
    if (typeof elx.showPicker === 'function') {
      try { elx.showPicker(); return } catch { /* fallback */ }
    }
    el.focus()
    el.click()
  }

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

  const textInput = (
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
              paddingRight: withPicker ? '34px' : undefined,
              ...style,
            }
          : { paddingRight: withPicker ? '34px' : undefined, ...style }
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

  const inputComPicker = withPicker ? (
    <div className="relative">
      {textInput}
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value || ''}
        onChange={(e) => {
          onChange(e.target.value)
          setTexto(isoParaBR(e.target.value))
        }}
        disabled={disabled}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
      <button
        type="button"
        onClick={abrirPicker}
        disabled={disabled}
        tabIndex={-1}
        aria-label="Abrir calendário"
        title="Abrir calendário"
        className="absolute top-1/2 -translate-y-1/2 right-2 p-1 rounded transition-colors disabled:cursor-not-allowed disabled:opacity-50"
        style={{ color: 'var(--ac-muted)', background: 'transparent', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </button>
    </div>
  ) : textInput

  if (!comLabel) return inputComPicker

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>
        {label}
      </label>
      {inputComPicker}
    </div>
  )
}
