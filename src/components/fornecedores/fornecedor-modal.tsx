'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { criarFornecedor, atualizarFornecedor } from '@/lib/actions/fornecedores'
import type { Fornecedor } from '@/types'

type Props = {
  open: boolean
  onClose: () => void
  editando?: Fornecedor | null
  onSaved?: () => void
}

type Form = { nome: string; telefone: string; email: string }

const formVazio: Form = { nome: '', telefone: '', email: '' }

export function FornecedorModal({ open, onClose, editando, onSaved }: Props) {
  const [form, setForm] = useState<Form>(formVazio)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (editando) {
      setForm({
        nome: editando.nome,
        telefone: editando.telefone ?? '',
        email: editando.email ?? '',
      })
    } else {
      setForm(formVazio)
    }
    setErro('')
  }, [editando, open])

  function set(field: keyof Form, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!form.nome.trim()) { setErro('Nome é obrigatório.'); return }

    setLoading(true)
    try {
      if (editando) {
        await atualizarFornecedor(editando.id, form)
      } else {
        await criarFornecedor(form)
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
    <Modal open={open} onClose={onClose} title={editando ? `Editar — ${editando.nome}` : 'Novo Fornecedor'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          id="nome"
          label="Nome *"
          placeholder="Ex: Sergio Rodrigues"
          value={form.nome}
          onChange={(e) => set('nome', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="telefone"
            label="Telefone"
            placeholder="(51) 99999-0000"
            value={form.telefone}
            onChange={(e) => set('telefone', e.target.value)}
          />
          <Input
            id="email"
            label="E-mail"
            type="email"
            placeholder="contato@fornecedor.com"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </div>

        {erro && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>
            {editando ? 'Salvar alterações' : 'Criar fornecedor'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
