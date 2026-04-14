'use client'

import { colunasPermissaoModulo } from '@/lib/permissoes'
import { MODULOS } from '@/types'
import type { ModuloKey } from '@/types'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }
type Permissoes = Record<ModuloKey, Perm>

type Props = {
  value: Permissoes
  onChange: (value: Permissoes) => void
  readonly?: boolean
}

const COLS: { key: keyof Perm; label: string }[] = [
  { key: 'ver',    label: 'Ver' },
  { key: 'criar',  label: 'Criar' },
  { key: 'editar', label: 'Editar' },
  { key: 'deletar', label: 'Excluir' },
]

function Toggle({ checked, onChange, disabled, title }: { checked: boolean; onChange: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onChange}
      className="flex items-center justify-center size-7 rounded-md transition-all mx-auto"
      style={{
        background: checked ? 'color-mix(in srgb, var(--ac-accent) 15%, transparent)' : 'var(--ac-bg)',
        border: `1.5px solid ${checked ? 'var(--ac-accent)' : 'var(--ac-border)'}`,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      }}
      title={title ?? (checked ? 'Permitido — clique para bloquear' : 'Bloqueado — clique para permitir')}
    >
      {checked ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-3.5"
          style={{ color: 'var(--ac-accent)' }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-3.5"
          style={{ color: 'var(--ac-muted)', opacity: 0.4 }}>
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      )}
    </button>
  )
}

export function PermissoesGrid({ value, onChange, readonly = false }: Props) {
  function toggle(modulo: ModuloKey, col: keyof Perm) {
    const activeCols = colunasPermissaoModulo(modulo)
    if (!activeCols.includes(col as 'ver' | 'criar' | 'editar' | 'deletar')) return

    const perm = value[modulo]

    if (modulo === 'lucro') {
      const newVer = !perm.ver
      onChange({
        ...value,
        [modulo]: { ver: newVer, criar: false, editar: false, deletar: false },
      })
      return
    }

    if (modulo === 'taxas_lucro' || modulo === 'preco_venda') {
      if (col === 'ver') {
        const newVer = !perm.ver
        onChange({
          ...value,
          [modulo]: { ver: newVer, criar: false, editar: newVer ? perm.editar : false, deletar: false },
        })
        return
      }
      if (col === 'editar') {
        const newEdit = !perm.editar
        onChange({
          ...value,
          [modulo]: { ver: newEdit ? true : perm.ver, criar: false, editar: newEdit, deletar: false },
        })
        return
      }
      return
    }

    const newVal = !perm[col]
    const ver = col === 'ver' ? newVal : (newVal ? true : perm.ver)
    const others = col === 'ver' && !newVal
      ? { criar: false, editar: false, deletar: false }
      : { criar: perm.criar, editar: perm.editar, deletar: perm.deletar }

    onChange({
      ...value,
      [modulo]: { ...others, ver, [col]: newVal },
    })
  }

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
            <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
              Módulo
            </th>
            {COLS.map((c) => (
              <th key={c.key} className="text-center px-3 py-2.5 font-semibold text-xs uppercase tracking-wide w-20" style={{ color: 'var(--ac-muted)' }}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {MODULOS.map((m, i) => {
            const perm = value[m.key]
            const activeCols = colunasPermissaoModulo(m.key)
            return (
              <tr
                key={m.key}
                style={{
                  borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined,
                  background: 'var(--ac-card)',
                }}
              >
                <td className="px-4 py-2.5 font-medium text-sm" style={{ color: 'var(--ac-text)' }}>
                  {m.label}
                </td>
                {COLS.map((c) => {
                  const inModule = activeCols.includes(c.key as 'ver' | 'criar' | 'editar' | 'deletar')
                  if (!inModule) {
                    return (
                      <td key={c.key} className="px-3 py-2.5 text-center">
                        <span className="text-xs tabular-nums" style={{ color: 'var(--ac-muted)', opacity: 0.45 }}>—</span>
                      </td>
                    )
                  }
                  // Só exige 'ver' habilitado se 'ver' for uma coluna válida desse módulo.
                  const needVer = c.key !== 'ver' && !perm.ver && activeCols.includes('ver')
                  const toggleTitle = readonly
                    ? 'Somente leitura'
                    : needVer
                    ? 'Habilite "Ver" primeiro'
                    : undefined
                  return (
                    <td key={c.key} className="px-3 py-2.5 text-center">
                      <Toggle
                        checked={perm[c.key]}
                        onChange={() => toggle(m.key, c.key)}
                        disabled={readonly || needVer}
                        title={toggleTitle}
                      />
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
