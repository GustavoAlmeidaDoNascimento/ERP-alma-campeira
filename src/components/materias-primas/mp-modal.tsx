'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { criarMateriaPrima, atualizarMateriaPrima } from '@/lib/actions/materias-primas'
import type { MateriaPrima, Fornecedor } from '@/types'

type Props = {
  open: boolean
  onClose: () => void
  fornecedores: Fornecedor[]
  editando?: MateriaPrima | null
  onSaved?: () => void
}

type Form = {
  nome: string
  fornecedor_id: string
  preco_custo: string
  estoque_atual: string
  estoque_minimo: string
}

const formVazio: Form = {
  nome: '',
  fornecedor_id: '',
  preco_custo: '',
  estoque_atual: '0',
  estoque_minimo: '0',
}

export function MPModal({ open, onClose, fornecedores, editando, onSaved }: Props) {
  const [form, setForm] = useState<Form>(formVazio)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (editando) {
      setForm({
        nome: editando.nome,
        fornecedor_id: editando.fornecedor_id ?? '',
        preco_custo: String(editando.preco_custo),
        estoque_atual: String(editando.estoque_atual),
        estoque_minimo: String(editando.estoque_minimo),
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
    if (!form.preco_custo || isNaN(Number(form.preco_custo))) { setErro('Preço de custo inválido.'); return }

    setLoading(true)
    try {
      const payload = {
        nome: form.nome,
        fornecedor_id: form.fornecedor_id || null,
        preco_custo: parseFloat(form.preco_custo),
        estoque_atual: parseFloat(form.estoque_atual) || 0,
        estoque_minimo: parseFloat(form.estoque_minimo) || 0,
      }

      if (editando) {
        await atualizarMateriaPrima(editando.id, payload)
      } else {
        await criarMateriaPrima(payload)
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
      title={editando ? `Editar — ${editando.codigo}` : 'Nova Matéria-Prima'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          id="nome"
          label="Nome *"
          placeholder="Ex: Lâmina Aço Inox 420"
          value={form.nome}
          onChange={(e) => set('nome', e.target.value)}
        />

        <Select
          id="fornecedor"
          label="Fornecedor"
          value={form.fornecedor_id}
          onChange={(e) => set('fornecedor_id', e.target.value)}
        >
          <option value="">— Sem fornecedor —</option>
          {fornecedores.map((f) => (
            <option key={f.id} value={f.id}>{f.nome}</option>
          ))}
        </Select>

        <div className="grid grid-cols-3 gap-3">
          <Input
            id="preco_custo"
            label="Preço de Custo (R$) *"
            type="number"
            min="0"
            step="0.01"
            placeholder="0,00"
            value={form.preco_custo}
            onChange={(e) => set('preco_custo', e.target.value)}
          />
          <Input
            id="estoque_atual"
            label="Estoque Atual"
            type="number"
            min="0"
            step="0.001"
            value={form.estoque_atual}
            onChange={(e) => set('estoque_atual', e.target.value)}
          />
          <Input
            id="estoque_minimo"
            label="Estoque Mínimo"
            type="number"
            min="0"
            step="0.001"
            value={form.estoque_minimo}
            onChange={(e) => set('estoque_minimo', e.target.value)}
          />
        </div>

        {erro && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {editando ? 'Salvar alterações' : 'Criar matéria-prima'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
