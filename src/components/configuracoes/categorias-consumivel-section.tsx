'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import {
  criarCategoriaConsumivel,
  atualizarCategoriaConsumivel,
  deletarCategoriaConsumivel,
} from '@/lib/actions/categorias-consumivel'
import type { CategoriaConsumivelDB } from '@/types'
import { useCategoriasConsumivel } from '@/lib/query/hooks'
import { useResourceRefresh } from '@/lib/realtime/client'

type Props = {
  categorias: CategoriaConsumivelDB[]
}

export function CategoriasConsumivelSection({ categorias }: Props) {
  const { data: categoriasAtuais = categorias } = useCategoriasConsumivel({ initialData: categorias })
  const { refreshResources } = useResourceRefresh()
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<CategoriaConsumivelDB | null>(null)
  const [deletando, setDeletando] = useState<CategoriaConsumivelDB | null>(null)
  const [nome, setNome] = useState('')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [erroDelete, setErroDelete] = useState('')

  function abrirNova() {
    setEditando(null)
    setNome('')
    setErro('')
    setModalAberto(true)
  }

  function abrirEditar(cat: CategoriaConsumivelDB) {
    setEditando(cat)
    setNome(cat.nome)
    setErro('')
    setModalAberto(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!nome.trim()) {
      setErro('Nome é obrigatório.')
      return
    }

    setLoading(true)
    try {
      if (editando) await atualizarCategoriaConsumivel(editando.id, { nome: nome.trim() })
      else await criarCategoriaConsumivel({ nome: nome.trim() })
      setModalAberto(false)
      await refreshResources(['categorias_consumivel'], { refreshRoute: true })
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
      await deletarCategoriaConsumivel(deletando.id)
      setDeletando(null)
      await refreshResources(['categorias_consumivel'], { refreshRoute: true })
    } catch (e: unknown) {
      setErroDelete(e instanceof Error ? e.message : 'Erro ao excluir.')
    } finally {
      setLoadingDelete(false)
    }
  }

  return (
    <>
      <div
        id="categorias-consumivel"
        className="scroll-mt-24 rounded-xl p-5 sm:p-6 shadow-sm"
        style={{
          background: 'var(--ac-card)',
          border: '1px solid var(--ac-border)',
          boxShadow: '0 1px 3px color-mix(in srgb, var(--ac-text) 6%, transparent)',
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between mb-5">
          <div>
            <h2 className="font-semibold text-lg" style={{ color: 'var(--ac-text)' }}>
              Categorias de Consumíveis
            </h2>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: 'var(--ac-muted)' }}>
              Gerencie os tipos usados no cadastro de consumíveis
            </p>
          </div>
          <Button onClick={abrirNova} variant="secondary">Nova categoria</Button>
        </div>

        {categoriasAtuais.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--ac-muted)' }}>
            Nenhuma categoria cadastrada.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {categoriasAtuais.map((cat) => (
              <div
                key={cat.id}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2"
                style={{ border: '1px solid var(--ac-border)', background: 'var(--ac-bg)' }}
              >
                <span className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>{cat.nome}</span>
                <button
                  onClick={() => abrirEditar(cat)}
                  className="p-1 rounded-md transition-colors"
                  style={{ color: 'var(--ac-muted)' }}
                  title="Editar"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-3.5">
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => { setDeletando(cat); setErroDelete('') }}
                  className="p-1 rounded-md transition-colors"
                  style={{ color: 'var(--ac-muted)' }}
                  title="Excluir"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-3.5">
                    <path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal open={modalAberto} onClose={() => setModalAberto(false)} title={editando ? 'Editar categoria' : 'Nova categoria'}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>Nome *</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: EPI"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
              style={{ background: 'var(--ac-bg)', border: '1px solid var(--ac-border)', color: 'var(--ac-text)' }}
            />
          </div>
          {erro && <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>{erro}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button type="submit" loading={loading}>{editando ? 'Salvar alterações' : 'Criar categoria'}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!deletando} onClose={() => setDeletando(null)} title="Excluir categoria">
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--ac-text)' }}>
            Tem certeza que deseja excluir a categoria <strong>{deletando?.nome}</strong>?
          </p>
          {erroDelete && <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>{erroDelete}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeletando(null)}>Cancelar</Button>
            <Button variant="danger" loading={loadingDelete} onClick={confirmarDelete}>Excluir</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
