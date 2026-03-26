'use client'

import { useMemo, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { criarCategoriaFaca, atualizarCategoriaFaca, deletarCategoriaFaca } from '@/lib/actions/categorias-faca'
import {
  inferirCorBaseParaEdicao,
  paletaCategoriaDeCorBase,
  type PaletaCategoria,
} from '@/lib/categoria-faca-paleta'
import type { CategoriaFacaDB } from '@/types'
import { useErpTabs } from '@/components/layout/erp-tabs'

type FormCat = {
  nome: string
  corBase: string
}

const PRESET_CORES = [
  '#991b1b',
  '#dc2626',
  '#ef4444',
  '#f97316',
  '#ea580c',
  '#fb923c',
  '#ca8a04',
  '#f59e0b',
  '#facc15',
  '#65a30d',
  '#16a34a',
  '#22c55e',
  '#059669',
  '#0d9488',
  '#06b6d4',
  '#0284c7',
  '#0ea5e9',
  '#3b82f6',
  '#2563eb',
  '#1d4ed8',
  '#4f46e5',
  '#6366f1',
  '#8b5cf6',
  '#7c3aed',
  '#a855f7',
  '#c026d3',
  '#db2777',
  '#ec4899',
  '#be123c',
  '#334155',
  '#64748b',
  '#94a3b8',
  '#111827',
] as const

const formVazio: FormCat = {
  nome: '',
  corBase: '#2563eb',
}

function CategoriaBadgePreview({ nome, paleta }: { nome: string; paleta: PaletaCategoria }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
      style={{
        color: paleta.cor_texto,
        background: paleta.cor_fundo,
        border: `1px solid ${paleta.cor_borda}`,
      }}
    >
      {nome || 'Preview'}
    </span>
  )
}

type Props = {
  categorias: CategoriaFacaDB[]
}

export function CategoriasFacaSection({ categorias }: Props) {
  const { refreshActiveTab } = useErpTabs()
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<CategoriaFacaDB | null>(null)
  const [deletando, setDeletando] = useState<CategoriaFacaDB | null>(null)
  const [form, setForm] = useState<FormCat>(formVazio)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [erroDelete, setErroDelete] = useState('')

  const corBaseUi = useMemo(() => {
    const raw = form.corBase.trim()
    const base = raw.startsWith('#') ? raw : `#${raw}`
    return /^#[0-9a-fA-F]{6}$/.test(base) ? base.toLowerCase() : '#2563eb'
  }, [form.corBase])

  const paletaPreview = useMemo(() => paletaCategoriaDeCorBase(corBaseUi), [corBaseUi])

  function set(field: keyof FormCat, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function abrirNova() {
    setEditando(null)
    setForm(formVazio)
    setErro('')
    setModalAberto(true)
  }

  function abrirEditar(cat: CategoriaFacaDB) {
    setEditando(cat)
    setForm({
      nome: cat.nome,
      corBase: inferirCorBaseParaEdicao(cat),
    })
    setErro('')
    setModalAberto(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!form.nome.trim()) { setErro('Nome é obrigatório.'); return }
    const base = form.corBase.trim().startsWith('#') ? form.corBase.trim() : `#${form.corBase.trim()}`
    if (!/^#[0-9a-fA-F]{6}$/.test(base)) { setErro('Escolha uma cor válida.'); return }

    const paleta = paletaCategoriaDeCorBase(base)
    const payload = { nome: form.nome.trim(), ...paleta }

    setLoading(true)
    try {
      if (editando) {
        await atualizarCategoriaFaca(editando.id, payload)
      } else {
        await criarCategoriaFaca(payload)
      }
      setModalAberto(false)
      refreshActiveTab()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  async function confirmarDelete() {
    if (!deletando) return
    setErroDelete('')
    setLoadingDelete(true)
    try {
      await deletarCategoriaFaca(deletando.id)
      setDeletando(null)
      refreshActiveTab()
    } catch (e: unknown) {
      setErroDelete(e instanceof Error ? e.message : 'Erro ao excluir.')
    } finally {
      setLoadingDelete(false)
    }
  }

  return (
    <>
      <div
        id="categorias-faca"
        className="rounded-xl p-6"
        style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)' }}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-semibold text-base" style={{ color: 'var(--ac-text)' }}>
              Categorias de Facas
            </h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--ac-muted)' }}>
              Gerencie as categorias e suas cores de exibição
            </p>
          </div>
          <Button onClick={abrirNova} variant="secondary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-3.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nova categoria
          </Button>
        </div>

        {categorias.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--ac-muted)' }}>
            Nenhuma categoria cadastrada.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            {categorias.map((cat, i) => (
              <div
                key={cat.id}
                className="flex items-center gap-4 px-4 py-3 rounded-lg"
                style={{
                  background: i % 2 === 0 ? 'var(--ac-bg)' : 'transparent',
                  border: '1px solid transparent',
                }}
              >
                {/* Badge preview */}
                <span
                  className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold flex-shrink-0"
                  style={{
                    color: cat.cor_texto,
                    background: cat.cor_fundo,
                    border: `1px solid ${cat.cor_borda}`,
                  }}
                >
                  {cat.nome}
                </span>

                <div className="ml-auto flex items-center">
                  <div
                    title="Cor da categoria"
                    className="size-7 rounded-full flex-shrink-0 shadow-inner"
                    style={{
                      background: inferirCorBaseParaEdicao(cat),
                      border: '2px solid var(--ac-border)',
                    }}
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => abrirEditar(cat)}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--ac-muted)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ac-border)'; e.currentTarget.style.color = 'var(--ac-text)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ac-muted)' }}
                    title="Editar"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => { setDeletando(cat); setErroDelete('') }}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--ac-muted)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ac-muted)' }}
                    title="Excluir"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal add/edit */}
      <Modal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? 'Editar categoria' : 'Nova categoria'}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Nome */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>Nome *</label>
            <input
              type="text"
              value={form.nome}
              onChange={(e) => set('nome', e.target.value)}
              placeholder="Ex: Colecionador"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
              style={{ background: 'var(--ac-bg)', border: '1px solid var(--ac-border)', color: 'var(--ac-text)' }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ac-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--ac-accent) 20%, transparent)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ac-border)'; e.currentTarget.style.boxShadow = 'none' }}
            />
          </div>

          {/* Uma cor: o sistema monta texto, fundo e borda automaticamente */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>Cor da categoria</label>
            <p className="text-xs" style={{ color: 'var(--ac-muted)' }}>
              Escolha uma cor. O badge usa automaticamente tons claros para o fundo, escuro para o texto e uma borda harmoniosa.
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESET_CORES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  title={hex}
                  onClick={() => set('corBase', hex)}
                  className="size-9 rounded-lg border-2 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2"
                  style={{
                    background: hex,
                    borderColor: corBaseUi === hex.toLowerCase() ? 'var(--ac-accent)' : 'var(--ac-border)',
                    boxShadow: corBaseUi === hex.toLowerCase() ? '0 0 0 2px color-mix(in srgb, var(--ac-accent) 35%, transparent)' : undefined,
                  }}
                />
              ))}
              <label className="relative size-9 rounded-lg overflow-hidden border-2 flex-shrink-0 cursor-pointer" style={{ borderColor: 'var(--ac-border)' }}>
                <span className="sr-only">Outra cor</span>
                <input
                  type="color"
                  value={corBaseUi}
                  onChange={(e) => set('corBase', e.target.value)}
                  className="absolute inset-0 w-[150%] h-[150%] -translate-x-1/4 -translate-y-1/4 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Preview */}
          <div
            className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-lg"
            style={{ background: 'var(--ac-bg)', border: '1px solid var(--ac-border)' }}
          >
            <span className="text-xs font-medium shrink-0" style={{ color: 'var(--ac-muted)' }}>Preview</span>
            <CategoriaBadgePreview nome={form.nome} paleta={paletaPreview} />
          </div>

          {erro && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>
              {erro}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button type="submit" loading={loading}>
              {editando ? 'Salvar alterações' : 'Criar categoria'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal delete */}
      <Modal open={!!deletando} onClose={() => setDeletando(null)} title="Excluir categoria">
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--ac-text)' }}>
            Tem certeza que deseja excluir a categoria <strong>{deletando?.nome}</strong>? As facas que usam essa categoria não serão excluídas, mas perderão o estilo de cor.
          </p>
          {erroDelete && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>{erroDelete}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeletando(null)}>Cancelar</Button>
            <Button variant="danger" loading={loadingDelete} onClick={confirmarDelete}>Excluir</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
