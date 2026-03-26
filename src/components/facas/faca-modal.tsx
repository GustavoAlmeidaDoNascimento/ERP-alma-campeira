'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { salvarFacaComFoto } from '@/lib/actions/facas'
import type { Faca, CategoriaFacaDB } from '@/types'
import { getOptimizedSupabaseImageUrl } from '@/lib/supabase/optimized-image'

type Props = {
  open: boolean
  onClose: () => void
  editando?: Faca | null
  categorias: CategoriaFacaDB[]
  onSaved?: () => void
}

type Form = {
  nome: string
  categoria: string
  preco_venda: string
  estoque_atual: string
  estoque_minimo: string
}

export function FacaModal({ open, onClose, editando, categorias, onSaved }: Props) {
  const defaultCategoria = categorias[0]?.nome ?? ''
  const [form, setForm] = useState<Form>({ nome: '', categoria: defaultCategoria, preco_venda: '', estoque_atual: '0', estoque_minimo: '0' })
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string>('')

  const fotoPreviewAtual = editando?.foto_url
    ? getOptimizedSupabaseImageUrl(editando.foto_url, { width: 120, height: 120, quality: 70, resize: 'cover', fallbackUrl: '' })
    : ''

  useEffect(() => {
    if (editando) {
      setForm({
        nome: editando.nome,
        categoria: editando.categoria,
        preco_venda: String(editando.preco_venda),
        estoque_atual: String(editando.estoque_atual),
        estoque_minimo: String(editando.estoque_minimo),
      })
    } else {
      setForm({ nome: '', categoria: categorias[0]?.nome ?? '', preco_venda: '', estoque_atual: '0', estoque_minimo: '0' })
    }
    setErro('')
    setFotoFile(null)
    setFotoPreview('')
  }, [editando, open, categorias])

  useEffect(() => {
    return () => {
      if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    }
  }, [fotoPreview])

  function set(field: keyof Form, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (!form.nome.trim()) { setErro('Nome é obrigatório.'); return }
    if (!form.preco_venda || isNaN(Number(form.preco_venda))) { setErro('Preço de venda inválido.'); return }

    setLoading(true)
    try {
      const payload = {
        nome: form.nome,
        categoria: form.categoria,
        preco_venda: parseFloat(form.preco_venda),
        estoque_atual: parseInt(form.estoque_atual) || 0,
        estoque_minimo: parseInt(form.estoque_minimo) || 0,
      }

      const fd = new FormData()
      if (editando?.id) fd.append('id', editando.id)
      fd.append('nome', payload.nome)
      fd.append('categoria', payload.categoria)
      fd.append('preco_venda', String(payload.preco_venda))
      fd.append('estoque_atual', String(payload.estoque_atual))
      fd.append('estoque_minimo', String(payload.estoque_minimo))
      if (fotoFile) fd.append('foto', fotoFile, fotoFile.name)

      await salvarFacaComFoto(fd)
      onClose()
      onSaved?.()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editando ? `Editar — ${editando.codigo}` : 'Nova Faca'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          id="nome"
          label="Nome *"
          placeholder="Ex: Faca Gauchesca Clássica"
          value={form.nome}
          onChange={(e) => set('nome', e.target.value)}
        />

        {/* Categoria com link para gerenciar */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="categoria" className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>
              Categoria *
            </label>
            <Link
              href="/configuracoes#categorias-faca"
              onClick={onClose}
              className="flex items-center gap-1 text-xs font-medium transition-colors"
              style={{ color: 'var(--ac-muted)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--ac-accent)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--ac-muted)')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-3.5">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Gerenciar categorias
            </Link>
          </div>
          <select
            id="categoria"
            value={form.categoria}
            onChange={(e) => set('categoria', e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all appearance-none"
            style={{
              background: 'var(--ac-card)',
              border: '1px solid var(--ac-border)',
              color: 'var(--ac-text)',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%236b7280' stroke-width='2' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 10px center',
              backgroundSize: '16px',
              paddingRight: '36px',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ac-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--ac-accent) 20%, transparent)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ac-border)'; e.currentTarget.style.boxShadow = 'none' }}
          >
            {categorias.map((c) => (
              <option key={c.id} value={c.nome}>{c.nome}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input
            id="preco_venda"
            label="Preço de Venda (R$) *"
            type="number"
            min="0"
            step="0.01"
            placeholder="0,00"
            value={form.preco_venda}
            onChange={(e) => set('preco_venda', e.target.value)}
          />
          <Input
            id="estoque_atual"
            label="Estoque Atual"
            type="number"
            min="0"
            value={form.estoque_atual}
            onChange={(e) => set('estoque_atual', e.target.value)}
          />
          <Input
            id="estoque_minimo"
            label="Estoque Mínimo"
            type="number"
            min="0"
            value={form.estoque_minimo}
            onChange={(e) => set('estoque_minimo', e.target.value)}
          />
        </div>

        {/* Foto (opcional) */}
        <div className="flex items-start gap-3">
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              border: '1px solid var(--ac-border)',
              background: 'linear-gradient(135deg, rgba(250, 204, 21, 0.18), rgba(250, 204, 21, 0.06))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {fotoPreview ? (
              <img
                src={fotoPreview}
                alt="Prévia da foto"
                width={64}
                height={64}
                style={{ objectFit: 'cover', borderRadius: 12 }}
              />
            ) : fotoPreviewAtual ? (
              <img
                src={fotoPreviewAtual}
                alt="Foto atual da faca"
                width={64}
                height={64}
                style={{ objectFit: 'cover', borderRadius: 12 }}
              />
            ) : (
              {/* Placeholder da foto: fundo suave + logo em amarelo */}
              <div
                aria-hidden="true"
                style={{
                  width: 40,
                  height: 40,
                  background: '#facc15',
                  WebkitMaskImage: "url('/images/logo.png')",
                  WebkitMaskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  WebkitMaskSize: 'contain',
                  maskImage: "url('/images/logo.png')",
                  maskRepeat: 'no-repeat',
                  maskPosition: 'center',
                  maskSize: 'contain',
                }}
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5" style={{ flex: 1 }}>
            <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>Foto da faca</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null
                setFotoFile(file)
                if (file) setFotoPreview(URL.createObjectURL(file))
                else setFotoPreview('')
              }}
              className="w-full"
            />
            <p className="text-xs" style={{ color: 'var(--ac-muted)' }}>
              Opcional. Se selecionar uma foto, ela substitui a anterior.
            </p>
          </div>
        </div>

        {erro && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>
            {editando ? 'Salvar alterações' : 'Criar faca'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
