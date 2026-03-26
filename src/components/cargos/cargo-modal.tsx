'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PermissoesGrid } from './permissoes-grid'
import { criarCargo, atualizarCargo } from '@/lib/actions/cargos'
import { permissoesVazias, permissoesFromArray } from '@/lib/permissoes'
import { CORES_CARGO } from '@/types'
import type { Cargo, ModuloKey } from '@/types'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }

type Props = {
  open: boolean
  onClose: () => void
  editando?: Cargo | null
  onSaved?: () => void
}

export function CargoModal({ open, onClose, editando, onSaved }: Props) {
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [cor, setCor] = useState('#7c3aed')
  const [permissoes, setPermissoes] = useState<Record<ModuloKey, Perm>>(permissoesVazias())
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (editando) {
      setNome(editando.nome)
      setDescricao(editando.descricao ?? '')
      setCor(editando.cor)
      setPermissoes(permissoesFromArray(editando.permissoes))
    } else {
      setNome('')
      setDescricao('')
      setCor('#7c3aed')
      setPermissoes(permissoesVazias())
    }
    setErro('')
  }, [editando, open])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!nome.trim()) { setErro('Nome é obrigatório.'); return }

    setLoading(true)
    try {
      const payload = { nome, descricao, cor, permissoes }
      if (editando) {
        await atualizarCargo(editando.id, payload)
      } else {
        await criarCargo(payload)
      }
      onClose()
      onSaved?.()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? `Editar cargo — ${editando.nome}` : 'Novo Cargo'}
      width="680px"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="nome"
            label="Nome *"
            placeholder="Ex: Supervisor"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Input
            id="descricao"
            label="Descrição"
            placeholder="Breve descrição do cargo"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
          />
        </div>

        {/* Cor */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>Cor</label>
          <div className="flex items-center gap-2 flex-wrap">
            {CORES_CARGO.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCor(c.value)}
                title={c.label}
                className="size-7 rounded-full transition-all flex items-center justify-center"
                style={{
                  background: c.value,
                  outline: cor === c.value ? `3px solid ${c.value}` : 'none',
                  outlineOffset: '2px',
                  transform: cor === c.value ? 'scale(1.2)' : 'scale(1)',
                }}
              >
                {cor === c.value && (
                  <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} className="size-3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Matriz de permissões */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>Permissões</label>
          <p className="text-xs mb-1" style={{ color: 'var(--ac-muted)' }}>
            Habilitar Criar, Editar ou Excluir automaticamente habilita Ver. Desabilitar Ver bloqueia todos.
          </p>
          <PermissoesGrid value={permissoes} onChange={setPermissoes} />
        </div>

        {erro && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>
            {editando ? 'Salvar alterações' : 'Criar cargo'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
