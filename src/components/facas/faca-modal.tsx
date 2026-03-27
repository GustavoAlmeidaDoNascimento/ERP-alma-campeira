'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { salvarFacaComFoto, getFacaBOM } from '@/lib/actions/facas'
import type { Faca, CategoriaFacaDB, MateriaPrima, FacaMateriaPrima } from '@/types'
import { getOptimizedSupabaseImageUrl } from '@/lib/supabase/optimized-image'

type Props = {
  open: boolean
  onClose: () => void
  editando?: Faca | null
  categorias: CategoriaFacaDB[]
  materiasPrimas: MateriaPrima[]
  onSaved?: () => void
}

type Form = {
  nome: string
  categoria: string
  preco_venda: string
  estoque_atual: string
  estoque_minimo: string
}

type BomItem = {
  materia_prima_id: string
  quantidade: string
}

export function FacaModal({ open, onClose, editando, categorias, materiasPrimas, onSaved }: Props) {
  const defaultCategoria = categorias[0]?.nome ?? ''
  const [form, setForm] = useState<Form>({ nome: '', categoria: defaultCategoria, preco_venda: '', estoque_atual: '0', estoque_minimo: '0' })
  const [bomItens, setBomItens] = useState<BomItem[]>([])
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingBom, setLoadingBom] = useState(false)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string>('')
  const [fotoDragActive, setFotoDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [fotoLightboxOpen, setFotoLightboxOpen] = useState(false)
  const [fotoLightboxSrc, setFotoLightboxSrc] = useState<string>('')

  const fotoPreviewAtual = editando?.foto_url
    ? getOptimizedSupabaseImageUrl(editando.foto_url, { width: 120, height: 120, quality: 70, resize: 'cover', fallbackUrl: '' })
    : ''

  // Carregar BOM ao editar
  const carregarBOM = useCallback(async (facaId: string) => {
    setLoadingBom(true)
    try {
      const bom: FacaMateriaPrima[] = await getFacaBOM(facaId)
      setBomItens(bom.map((b) => ({
        materia_prima_id: b.materia_prima_id,
        quantidade: String(b.quantidade),
      })))
    } catch {
      setBomItens([])
    } finally {
      setLoadingBom(false)
    }
  }, [])

  useEffect(() => {
    if (editando) {
      setForm({
        nome: editando.nome,
        categoria: editando.categoria,
        preco_venda: String(editando.preco_venda),
        estoque_atual: String(editando.estoque_atual),
        estoque_minimo: String(editando.estoque_minimo),
      })
      carregarBOM(editando.id)
    } else {
      setForm({ nome: '', categoria: categorias[0]?.nome ?? '', preco_venda: '', estoque_atual: '0', estoque_minimo: '0' })
      setBomItens([])
    }
    setErro('')
    setFotoFile(null)
    setFotoPreview('')
  }, [editando, open, categorias, carregarBOM])

  useEffect(() => {
    return () => {
      if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    }
  }, [fotoPreview])

  function setFotoFromFile(file: File | null) {
    setFotoFile(file)
    if (file) setFotoPreview(URL.createObjectURL(file))
    else setFotoPreview('')
  }

  function openFotoLightbox(src: string) {
    setFotoLightboxSrc(src)
    setFotoLightboxOpen(true)
  }

  function closeFotoLightbox() {
    setFotoLightboxOpen(false)
    setFotoLightboxSrc('')
  }

  function set(field: keyof Form, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  // BOM helpers
  function adicionarBomItem() {
    setBomItens((prev) => [...prev, { materia_prima_id: '', quantidade: '1' }])
  }

  function removerBomItem(index: number) {
    setBomItens((prev) => prev.filter((_, i) => i !== index))
  }

  function atualizarBomItem(index: number, field: keyof BomItem, value: string) {
    setBomItens((prev) => prev.map((item, i) => i === index ? { ...item, [field]: value } : item))
  }

  // MPs já selecionadas (para filtrar dos dropdowns)
  function mpsSelecionadas(excluirIndex: number): Set<string> {
    const set = new Set<string>()
    bomItens.forEach((item, i) => {
      if (i !== excluirIndex && item.materia_prima_id) set.add(item.materia_prima_id)
    })
    return set
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')

    if (!form.nome.trim()) { setErro('Nome é obrigatório.'); return }
    if (!form.preco_venda || isNaN(Number(form.preco_venda))) { setErro('Preço de venda inválido.'); return }

    // Validar BOM
    if (bomItens.length === 0) { setErro('Adicione pelo menos 1 matéria-prima.'); return }
    for (const item of bomItens) {
      if (!item.materia_prima_id) { setErro('Selecione a matéria-prima em todos os itens.'); return }
      if (!item.quantidade || isNaN(Number(item.quantidade)) || Number(item.quantidade) <= 0) {
        setErro('Quantidade deve ser maior que 0 em todos os itens.'); return
      }
    }

    setLoading(true)
    try {
      const fd = new FormData()
      if (editando?.id) fd.append('id', editando.id)
      fd.append('nome', form.nome)
      fd.append('categoria', form.categoria)
      fd.append('preco_venda', String(parseFloat(form.preco_venda)))
      fd.append('estoque_atual', String(parseInt(form.estoque_atual) || 0))
      fd.append('estoque_minimo', String(parseInt(form.estoque_minimo) || 0))
      if (fotoFile) fd.append('foto', fotoFile, fotoFile.name)

      // BOM como JSON
      fd.append('bom', JSON.stringify(bomItens.map((i) => ({
        materia_prima_id: i.materia_prima_id,
        quantidade: parseFloat(i.quantidade),
      }))))

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
    <Modal open={open} onClose={onClose} title={editando ? `Editar — ${editando.codigo}` : 'Nova Faca'} width="640px">
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

        {/* ========== SEÇÃO BOM (Matérias-Primas) ========== */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>
              Matérias-Primas *
            </label>
            <button
              type="button"
              onClick={adicionarBomItem}
              className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md transition-colors"
              style={{ color: 'var(--ac-accent)', background: 'color-mix(in srgb, var(--ac-accent) 10%, transparent)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'color-mix(in srgb, var(--ac-accent) 18%, transparent)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'color-mix(in srgb, var(--ac-accent) 10%, transparent)')}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-3.5">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Adicionar
            </button>
          </div>

          {loadingBom ? (
            <div className="text-xs py-3 text-center" style={{ color: 'var(--ac-muted)' }}>Carregando matérias-primas...</div>
          ) : bomItens.length === 0 ? (
            <div
              className="text-xs py-4 text-center rounded-lg"
              style={{ color: 'var(--ac-muted)', background: 'var(--ac-bg)', border: '1px dashed var(--ac-border)' }}
            >
              Nenhuma matéria-prima adicionada. Clique em &quot;Adicionar&quot; acima.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {bomItens.map((item, idx) => {
                const selecionadas = mpsSelecionadas(idx)
                const disponiveis = materiasPrimas.filter((mp) => !selecionadas.has(mp.id))

                return (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={item.materia_prima_id}
                      onChange={(e) => atualizarBomItem(idx, 'materia_prima_id', e.target.value)}
                      className="flex-1 rounded-lg px-3 py-2 text-sm outline-none transition-all appearance-none"
                      style={{
                        background: 'var(--ac-card)',
                        border: '1px solid var(--ac-border)',
                        color: 'var(--ac-text)',
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%236b7280' stroke-width='2' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                        backgroundRepeat: 'no-repeat',
                        backgroundPosition: 'right 8px center',
                        backgroundSize: '14px',
                        paddingRight: '30px',
                      }}
                    >
                      <option value="">Selecione...</option>
                      {disponiveis.map((mp) => (
                        <option key={mp.id} value={mp.id}>
                          {mp.codigo} — {mp.nome}
                        </option>
                      ))}
                      {/* Se o item já selecionado não está em disponiveis (porque foi selecionado antes), inclui-lo */}
                      {item.materia_prima_id && !disponiveis.some((mp) => mp.id === item.materia_prima_id) && (() => {
                        const mp = materiasPrimas.find((m) => m.id === item.materia_prima_id)
                        return mp ? <option key={mp.id} value={mp.id}>{mp.codigo} — {mp.nome}</option> : null
                      })()}
                    </select>

                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      placeholder="Qtd"
                      value={item.quantidade}
                      onChange={(e) => atualizarBomItem(idx, 'quantidade', e.target.value)}
                      className="w-20 rounded-lg px-2 py-2 text-sm text-center outline-none transition-all"
                      style={{
                        background: 'var(--ac-card)',
                        border: '1px solid var(--ac-border)',
                        color: 'var(--ac-text)',
                      }}
                      onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ac-accent)' }}
                      onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ac-border)' }}
                    />

                    <button
                      type="button"
                      onClick={() => removerBomItem(idx)}
                      className="p-1.5 rounded-lg transition-colors flex-shrink-0"
                      style={{ color: 'var(--ac-muted)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ac-muted)' }}
                      title="Remover"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4">
                        <path d="M18 6 6 18" />
                        <path d="m6 6 12 12" />
                      </svg>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Foto (opcional) */}
        <div className="flex items-start gap-3">
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              border: '1px solid var(--ac-border)',
              background: (fotoPreview || fotoPreviewAtual)
                ? 'transparent'
                : 'linear-gradient(135deg, rgba(250, 204, 21, 0.18), rgba(250, 204, 21, 0.06))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {(() => {
              const src = fotoPreview || fotoPreviewAtual
              if (src) {
                return (
                  <button
                    type="button"
                    onClick={() => openFotoLightbox(src)}
                    style={{
                      width: '100%',
                      height: '100%',
                      border: 'none',
                      padding: 0,
                      borderRadius: 12,
                      background: 'transparent',
                      cursor: 'zoom-in',
                    }}
                    aria-label="Expandir foto da faca"
                  >
                    <img
                      src={src}
                      alt="Foto da faca"
                      width={64}
                      height={64}
                      style={{ objectFit: 'cover', borderRadius: 12 }}
                    />
                  </button>
                )
              }

              return (
                <img
                  src="/images/favicon-yellow.png"
                  alt="Sem foto"
                  width={28}
                  height={28}
                  style={{ objectFit: 'contain' }}
                />
              )
            })()}
          </div>

          <div className="flex flex-col gap-1.5" style={{ flex: 1 }}>
            <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>
              Foto da faca (opcional)
            </label>

            <div
              role="button"
              tabIndex={0}
              aria-label="Arraste e solte uma imagem ou clique para selecionar"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
              }}
              onDragEnter={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setFotoDragActive(true)
              }}
              onDragOver={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setFotoDragActive(true)
              }}
              onDragLeave={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setFotoDragActive(false)
              }}
              onDrop={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setFotoDragActive(false)
                const file = e.dataTransfer.files?.[0] ?? null
                setFotoFromFile(file)
              }}
              style={{
                borderRadius: 14,
                border: `2px dashed ${fotoDragActive ? 'var(--ac-accent)' : 'var(--ac-border)'}`,
                background: fotoDragActive
                  ? 'color-mix(in srgb, var(--ac-accent) 14%, transparent)'
                  : 'var(--ac-card)',
                padding: '14px 12px',
                cursor: 'pointer',
                transition: 'transform 150ms ease, border-color 150ms ease, background 150ms ease, box-shadow 150ms ease',
                transform: fotoDragActive ? 'scale(1.01)' : 'scale(1)',
                boxShadow: fotoDragActive
                  ? '0 0 0 3px color-mix(in srgb, var(--ac-accent) 18%, transparent)'
                  : 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                textAlign: 'center',
                gap: 8,
                userSelect: 'none',
              }}
              className="hover:scale-[1.01]"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null
                  setFotoFromFile(file)
                }}
              />

              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
                className="size-5"
                style={{ color: fotoDragActive ? 'var(--ac-accent)' : 'var(--ac-muted)' }}
              >
                <path d="M12 16V4" strokeLinecap="round" />
                <path d="M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M20 16v4H4v-4" strokeLinecap="round" />
              </svg>

              <div className="text-sm font-semibold" style={{ color: 'var(--ac-text)' }}>
                {fotoDragActive ? 'Solte a imagem aqui' : 'Arraste uma imagem aqui ou clique para selecionar'}
              </div>

              <div className="text-xs" style={{ color: 'var(--ac-muted)' }}>
                PNG, JPG ou WEBP. A imagem substitui a anterior.
              </div>
            </div>
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

      <Modal open={fotoLightboxOpen} onClose={closeFotoLightbox} title="Foto da faca" width="520px">
        <div className="flex flex-col gap-3">
          <div
            style={{
              width: '100%',
              border: '1px solid var(--ac-border)',
              borderRadius: 14,
              overflow: 'hidden',
              background: 'var(--ac-card)',
            }}
          >
            {fotoLightboxSrc ? (
              <img
                src={fotoLightboxSrc}
                alt="Foto da faca"
                style={{ width: '100%', height: 'auto', display: 'block' }}
              />
            ) : null}
          </div>
          <p className="text-xs" style={{ color: 'var(--ac-muted)' }}>
            Clique fora ou use &quot;Fechar&quot; para voltar.
          </p>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={closeFotoLightbox}>Fechar</Button>
          </div>
        </div>
      </Modal>
    </Modal>
  )
}
