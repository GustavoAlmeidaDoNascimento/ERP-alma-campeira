'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { criarTipoGasto, deletarTipoGasto } from '@/lib/actions/tipos-gasto'
import { capitalizarTipoGasto, metaTipoGasto, type TipoGastoDB } from '@/types'

type Props = {
  id?: string
  value: string
  onChange: (nome: string) => void
  tipos: TipoGastoDB[]
  disabled?: boolean
  podeCriar?: boolean
  podeRemover?: boolean
  /** Chamado após criar/remover uma tag, para revalidar a lista. */
  onTagsChanged?: () => void
}

/** Normaliza para comparar sem caixa/acento (detecta duplicatas). */
function normalizar(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
}

const inputStyle = {
  background: 'var(--ac-card)',
  border: '1px solid var(--ac-border)',
  color: 'var(--ac-text)',
}

/**
 * Campo de tipo de gasto no formato de "tag": o usuário digita e vê as tags
 * existentes filtradas; pode adicionar uma tag nova (que fica disponível para
 * todos) ou remover uma tag (os gastos que a usavam passam a ser "Outros").
 * Toda primeira letra é capitalizada para manter o padrão e evitar duplicatas.
 */
export function TipoGastoInput({
  id: idProp,
  value,
  onChange,
  tipos,
  disabled,
  podeCriar = true,
  podeRemover = true,
  onTagsChanged,
}: Props) {
  const genId = useId()
  const id = idProp ?? genId
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState('')
  const [confirmandoId, setConfirmandoId] = useState<string | null>(null)

  const alvo = normalizar(value)

  const filtrados = useMemo(() => {
    const q = alvo
    const base = q ? tipos.filter((t) => normalizar(t.nome).includes(q)) : tipos
    return [...base].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }, [tipos, alvo])

  const existeExato = useMemo(
    () => tipos.some((t) => normalizar(t.nome) === alvo),
    [tipos, alvo]
  )

  const podeAdicionar = podeCriar && alvo.length > 0 && !existeExato
  const totalItens = filtrados.length + (podeAdicionar ? 1 : 0)
  const highlightSafe = totalItens === 0 ? 0 : Math.min(highlight, totalItens - 1)

  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false)
        setConfirmandoId(null)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  function selecionar(nome: string) {
    onChange(nome)
    setOpen(false)
    setConfirmandoId(null)
  }

  async function adicionar() {
    if (busy) return
    setErro('')
    setBusy(true)
    try {
      const criada = await criarTipoGasto(value)
      onChange(criada.nome)
      onTagsChanged?.()
      setOpen(false)
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao adicionar tipo de gasto.')
    } finally {
      setBusy(false)
    }
  }

  async function remover(tag: TipoGastoDB) {
    if (busy) return
    setErro('')
    setBusy(true)
    try {
      await deletarTipoGasto(tag.id)
      if (normalizar(value) === normalizar(tag.nome)) onChange('')
      onTagsChanged?.()
      setConfirmandoId(null)
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao remover tipo de gasto.')
    } finally {
      setBusy(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') {
      if (open) {
        e.preventDefault()
        e.stopPropagation()
        setOpen(false)
        setConfirmandoId(null)
      }
      return
    }
    if (disabled) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      else setHighlight((h) => Math.min(h + 1, Math.max(0, totalItens - 1)))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (open) setHighlight((h) => Math.max(h - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      if (!open) return
      e.preventDefault()
      if (highlightSafe < filtrados.length) {
        const t = filtrados[highlightSafe]
        if (t) selecionar(t.nome)
      } else if (podeAdicionar) {
        void adicionar()
      }
    }
  }

  const showList = open && !disabled

  return (
    <div ref={rootRef} className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={showList}
        aria-controls={`${id}-listbox`}
        aria-autocomplete="list"
        disabled={disabled}
        value={value}
        placeholder="Digite ou selecione um tipo"
        onChange={(e) => {
          onChange(capitalizarTipoGasto(e.target.value))
          setHighlight(0)
          setOpen(true)
          setErro('')
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="w-full px-3 py-2.5 rounded-lg text-sm outline-none transition-all disabled:opacity-60"
        style={inputStyle}
      />

      {erro && (
        <p className="mt-1 text-xs" style={{ color: '#dc2626' }}>{erro}</p>
      )}

      {showList && (
        <ul
          id={`${id}-listbox`}
          ref={listRef}
          role="listbox"
          className="absolute left-0 top-full z-[60] mt-1 w-full max-h-60 overflow-auto rounded-lg py-1 shadow-lg"
          style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)' }}
        >
          {filtrados.map((t, idx) => {
            const meta = metaTipoGasto(t.nome)
            const confirmando = confirmandoId === t.id
            return (
              <li key={t.id} role="presentation">
                {confirmando ? (
                  <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs" style={{ color: 'var(--ac-text)' }}>
                    <span className="min-w-0 flex-1">
                      Remover <strong>{t.nome}</strong>? Os gastos viram “Outros”.
                    </span>
                    <button
                      type="button"
                      disabled={busy}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => remover(t)}
                      className="rounded-md px-2 py-1 font-semibold"
                      style={{ color: '#dc2626', background: '#fee2e2' }}
                    >
                      Remover
                    </button>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setConfirmandoId(null)}
                      className="rounded-md px-2 py-1"
                      style={{ color: 'var(--ac-muted)' }}
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <div
                    className="flex items-center gap-2 px-3 py-2 text-sm"
                    style={{
                      background:
                        highlightSafe === idx ? 'color-mix(in srgb, var(--ac-border) 45%, transparent)' : 'transparent',
                    }}
                    onMouseEnter={() => setHighlight(idx)}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={normalizar(value) === normalizar(t.nome)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selecionar(t.nome)}
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      style={{ color: 'var(--ac-text)' }}
                    >
                      <span className="size-2.5 shrink-0 rounded-full" style={{ background: meta.color }} />
                      <span className="min-w-0 flex-1 truncate">{t.nome}</span>
                    </button>
                    {podeRemover && !t.sistema && (
                      <button
                        type="button"
                        title="Remover tipo"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => setConfirmandoId(t.id)}
                        className="shrink-0 rounded-md p-1 transition-colors"
                        style={{ color: 'var(--ac-muted)' }}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-3.5">
                          <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
              </li>
            )
          })}

          {podeAdicionar && (
            <li role="presentation">
              <button
                type="button"
                disabled={busy}
                onMouseDown={(e) => e.preventDefault()}
                onClick={adicionar}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium"
                style={{
                  color: 'var(--ac-accent)',
                  background:
                    highlightSafe === filtrados.length ? 'color-mix(in srgb, var(--ac-border) 45%, transparent)' : 'transparent',
                }}
                onMouseEnter={() => setHighlight(filtrados.length)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4 shrink-0">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span className="min-w-0 flex-1 truncate">Adicionar “{value}”</span>
              </button>
            </li>
          )}

          {filtrados.length === 0 && !podeAdicionar && (
            <li className="px-3 py-2 text-sm" style={{ color: 'var(--ac-muted)' }}>
              {value ? 'Nenhum tipo encontrado.' : 'Nenhum tipo cadastrado.'}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
