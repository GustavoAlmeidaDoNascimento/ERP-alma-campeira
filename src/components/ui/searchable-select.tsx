'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

export type SearchableSelectOption = { value: string; label: string }

function normalize(s: string) {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

type Props = {
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  disabled?: boolean
  loading?: boolean
  emptyMessage?: string
  className?: string
  inputClassName?: string
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = 'Pesquisar…',
  disabled,
  loading,
  emptyMessage = 'Nenhum resultado',
  className = '',
  inputClassName = '',
}: Props) {
  const id = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)

  const selectedLabel = useMemo(() => options.find((o) => o.value === value)?.label ?? '', [options, value])

  useEffect(() => {
    if (!open) setQuery(selectedLabel)
  }, [open, selectedLabel])

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return options
    return options.filter((o) => {
      const hay = normalize(o.label)
      return hay.includes(q)
    })
  }, [options, query])

  useEffect(() => {
    setHighlight(0)
  }, [query, open])

  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector(`[data-idx="${highlight}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlight, open])

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const pick = useCallback(
    (v: string, label: string) => {
      onChange(v)
      setQuery(label)
      setOpen(false)
    },
    [onChange]
  )

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        setQuery(selectedLabel)
      }
      return
    }
    if (disabled || loading) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (open) setHighlight((h) => Math.max(h - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      if (open && filtered[highlight]) {
        e.preventDefault()
        const o = filtered[highlight]
        pick(o.value, o.label)
      }
      return
    }
    if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  const showList = open && !disabled && !loading

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${id}-listbox`}
        aria-autocomplete="list"
        disabled={disabled || loading}
        value={open ? query : selectedLabel}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value
          setQuery(v)
          setOpen(true)
          if (value) onChange('')
        }}
        onFocus={() => {
          setQuery(selectedLabel)
          setOpen(true)
        }}
        onKeyDown={onInputKeyDown}
        className={`w-full mt-1 px-3 py-2 rounded-lg text-sm outline-none transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ac-muted)_35%,transparent)] focus-visible:ring-offset-0 ${inputClassName}`}
        style={{
          background: 'var(--ac-bg)',
          border: '1px solid var(--ac-border)',
          color: 'var(--ac-text)',
        }}
      />

      {loading && (
        <p className="mt-1 text-xs" style={{ color: 'var(--ac-muted)' }}>
          Carregando…
        </p>
      )}

      {showList && (
        <ul
          id={`${id}-listbox`}
          ref={listRef}
          role="listbox"
          className="absolute z-[60] mt-1 max-h-60 w-full overflow-auto rounded-lg border py-1 shadow-lg sm:max-h-72"
          style={{
            background: 'var(--ac-card)',
            borderColor: 'var(--ac-border)',
          }}
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm" style={{ color: 'var(--ac-muted)' }}>
              {emptyMessage}
            </li>
          ) : (
            filtered.map((o, idx) => (
              <li key={o.value} role="presentation">
                <button
                  type="button"
                  data-idx={idx}
                  role="option"
                  aria-selected={value === o.value}
                  className="flex w-full px-3 py-2 text-left text-sm transition-colors"
                  style={{
                    background: highlight === idx ? 'color-mix(in srgb, var(--ac-border) 45%, transparent)' : 'transparent',
                    color: 'var(--ac-text)',
                  }}
                  onMouseEnter={() => setHighlight(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o.value, o.label)}
                >
                  {o.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
