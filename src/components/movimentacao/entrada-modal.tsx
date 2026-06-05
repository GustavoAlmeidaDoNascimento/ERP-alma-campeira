'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { criarEntrada, atualizarEntrada } from '@/lib/actions/entradas'
import { CATEGORIAS_ENTRADA, FORMAS_PAGAMENTO } from '@/types'
import type { Entrada, FormaPagamento } from '@/types'

type Props = {
  open: boolean
  onClose: () => void
  editando: Entrada | null
  usuarios: { id: string; nome: string }[]
  usuarioLogadoId: string | null
  onSaved?: () => void
}

const inputStyle = {
  background: 'var(--ac-card)',
  border: '1px solid var(--ac-border)',
  color: 'var(--ac-text)',
}

const selectChevron = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%236b7280' stroke-width='2' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat' as const,
  backgroundPosition: 'right 10px center',
  backgroundSize: '16px',
  paddingRight: '36px',
}

function hoje() {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

export function EntradaModal({ open, onClose, editando, usuarios, usuarioLogadoId, onSaved }: Props) {
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState<string>('')
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('pix')
  const [dataEntrada, setDataEntrada] = useState<string>(hoje())
  const [categoria, setCategoria] = useState('')
  const [observacao, setObservacao] = useState('')
  const [usuarioId, setUsuarioId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!open) return
    if (editando) {
      setDescricao(editando.descricao)
      setValor(String(editando.valor ?? ''))
      setFormaPagamento(editando.forma_pagamento)
      setDataEntrada(editando.data_entrada.slice(0, 10))
      setCategoria(editando.categoria ?? '')
      setObservacao(editando.observacao ?? '')
      setUsuarioId(editando.usuario_id ?? '')
    } else {
      setDescricao('')
      setValor('')
      setFormaPagamento('pix')
      setDataEntrada(hoje())
      setCategoria('')
      setObservacao('')
      const defaultId = usuarioLogadoId && usuarios.some((u) => u.id === usuarioLogadoId)
        ? usuarioLogadoId
        : ''
      setUsuarioId(defaultId)
    }
    setErro('')
  }, [open, editando, usuarioLogadoId, usuarios])

  async function salvar() {
    if (!descricao.trim()) { setErro('Descrição é obrigatória.'); return }
    const v = Number(valor.replace(',', '.'))
    if (!Number.isFinite(v) || v <= 0) { setErro('Informe um valor maior que zero.'); return }
    if (!dataEntrada) { setErro('Informe a data da entrada.'); return }
    if (!usuarioId) { setErro('Selecione quem está registrando.'); return }

    setErro('')
    setLoading(true)
    try {
      const input = {
        descricao,
        valor: v,
        forma_pagamento: formaPagamento,
        data_entrada: dataEntrada,
        categoria,
        observacao,
        usuario_id: usuarioId,
      }
      if (editando) await atualizarEntrada(editando.id, input)
      else await criarEntrada(input)
      onClose()
      onSaved?.()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editando ? 'Editar entrada' : 'Registrar entrada'} width="560px">
      <div className="flex flex-col gap-4 max-h-[min(72vh,560px)] overflow-y-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>Categoria</label>
            <input
              list="categorias-entrada"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ex.: Venda avulsa, Serviço…"
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
              style={inputStyle}
            />
            <datalist id="categorias-entrada">
              {CATEGORIAS_ENTRADA.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <Input
            id="e-data"
            label="Data *"
            type="date"
            value={dataEntrada}
            onChange={(e) => setDataEntrada(e.target.value)}
          />
        </div>

        <Input
          id="e-descricao"
          label="Descrição *"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="De onde veio essa entrada"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="e-valor"
            label="Valor (R$) *"
            type="number"
            step="0.01"
            min="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>Forma de recebimento *</label>
            <select
              value={formaPagamento}
              onChange={(e) => setFormaPagamento(e.target.value as FormaPagamento)}
              className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
              style={{ ...inputStyle, ...selectChevron }}
            >
              {(Object.keys(FORMAS_PAGAMENTO) as FormaPagamento[]).map((f) => (
                <option key={f} value={f}>{FORMAS_PAGAMENTO[f].label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>Quem está registrando *</label>
          <select
            value={usuarioId}
            onChange={(e) => setUsuarioId(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
            style={{ ...inputStyle, ...selectChevron }}
          >
            <option value="">Selecione um usuário</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>Observação</label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={3}
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all resize-y"
            style={inputStyle}
            placeholder="Informações adicionais (opcional)"
          />
        </div>

        {erro && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>{erro}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button loading={loading} onClick={salvar}>{editando ? 'Salvar alterações' : 'Registrar entrada'}</Button>
        </div>
      </div>
    </Modal>
  )
}
