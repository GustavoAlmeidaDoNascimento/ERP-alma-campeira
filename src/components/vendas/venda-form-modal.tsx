'use client'

import { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { criarVenda, atualizarVenda } from '@/lib/actions/vendas'
import { STATUS_PEDIDO } from '@/types'
import type { Pedido, Cliente, Faca, StatusPedido } from '@/types'

type Props = {
  open: boolean
  onClose: () => void
  editando: Pedido | null
  clientes: Cliente[]
  facas: Faca[]
}

type ItemForm = {
  faca_id: string
  quantidade: number
  preco_unitario: number
}

function today() {
  return new Date().toISOString().split('T')[0]
}

export function VendaFormModal({ open, onClose, editando, clientes, facas }: Props) {
  const [clienteId, setClienteId] = useState('')
  const [dataPedido, setDataPedido] = useState(today())
  const [status, setStatus] = useState<StatusPedido>('em_espera')
  const [observacao, setObservacao] = useState('')
  const [itens, setItens] = useState<ItemForm[]>([{ faca_id: '', quantidade: 1, preco_unitario: 0 }])
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!open) return
    setErro('')
    if (editando) {
      setClienteId(editando.cliente_id ?? '')
      setDataPedido(editando.data_pedido)
      setStatus(editando.status)
      setObservacao(editando.observacao ?? '')
      setItens(
        editando.itens && editando.itens.length > 0
          ? editando.itens.map((i) => ({
              faca_id: i.faca_id,
              quantidade: i.quantidade,
              preco_unitario: i.preco_unitario,
            }))
          : [{ faca_id: '', quantidade: 1, preco_unitario: 0 }]
      )
    } else {
      setClienteId('')
      setDataPedido(today())
      setStatus('em_espera')
      setObservacao('')
      setItens([{ faca_id: '', quantidade: 1, preco_unitario: 0 }])
    }
  }, [open, editando])

  const total = useMemo(
    () => itens.reduce((s, i) => s + (i.quantidade || 0) * (i.preco_unitario || 0), 0),
    [itens]
  )

  function addItem() {
    setItens((prev) => [...prev, { faca_id: '', quantidade: 1, preco_unitario: 0 }])
  }

  function removeItem(idx: number) {
    setItens((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof ItemForm, value: string | number) {
    setItens((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], [field]: value }
      // Auto-fill preco_unitario when selecting faca
      if (field === 'faca_id') {
        const faca = facas.find((f) => f.id === value)
        if (faca) next[idx].preco_unitario = faca.preco_venda
      }
      return next
    })
  }

  async function salvar() {
    const itensValidos = itens.filter((i) => i.faca_id)
    if (itensValidos.length === 0) { setErro('Adicione ao menos um item com faca selecionada.'); return }
    setErro(''); setLoading(true)
    try {
      const input = {
        cliente_id: clienteId || null,
        data_pedido: dataPedido,
        status,
        observacao,
        itens: itensValidos,
      }
      if (editando) await atualizarVenda(editando.id, input)
      else await criarVenda(input)
      onClose()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  const selectStyle: React.CSSProperties = {
    background: 'var(--ac-card)',
    border: '1px solid var(--ac-border)',
    color: 'var(--ac-text)',
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%236b7280' stroke-width='2' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 8px center',
    backgroundSize: '16px',
    paddingRight: '32px',
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--ac-card)',
    border: '1px solid var(--ac-border)',
    color: 'var(--ac-text)',
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? `Editar venda ${editando.codigo}` : 'Nova venda'}
      width="700px"
    >
      <div className="flex flex-col gap-5">

        {/* Linha 1: Cliente + Data + Status */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Cliente</label>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
              style={selectStyle}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--ac-accent)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--ac-border)'}
            >
              <option value="">— Sem cliente —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Data da venda</label>
            <input
              type="date"
              value={dataPedido}
              onChange={(e) => setDataPedido(e.target.value)}
              className="px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
              style={inputStyle}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--ac-accent)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--ac-border)'}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusPedido)}
              className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
              style={selectStyle}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--ac-accent)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--ac-border)'}
            >
              <option value="em_espera">{STATUS_PEDIDO.em_espera.label}</option>
              <option value="em_producao">{STATUS_PEDIDO.em_producao.label}</option>
              <option value="entregue">{STATUS_PEDIDO.entregue.label}</option>
            </select>
          </div>
        </div>

        {/* Observação */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Observação</label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Prazo de entrega, condições especiais..."
            rows={2}
            className="px-3 py-2.5 rounded-lg text-sm outline-none transition-all resize-none"
            style={inputStyle}
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--ac-accent)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--ac-border)'}
          />
        </div>

        {/* Itens */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Itens da venda</label>
            <button
              onClick={addItem}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
              style={{ color: 'var(--ac-accent)', background: 'color-mix(in srgb, var(--ac-accent) 12%, transparent)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--ac-accent) 20%, transparent)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'color-mix(in srgb, var(--ac-accent) 12%, transparent)' }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-3.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Adicionar item
            </button>
          </div>

          {/* Header */}
          <div className="grid gap-2 text-xs font-semibold uppercase tracking-wide px-1"
            style={{ gridTemplateColumns: '1fr 80px 110px 90px 32px', color: 'var(--ac-muted)' }}>
            <span>Faca</span>
            <span className="text-center">Qtd</span>
            <span className="text-right">Preço unit.</span>
            <span className="text-right">Subtotal</span>
            <span></span>
          </div>

          <div className="flex flex-col gap-1.5">
            {itens.map((item, idx) => {
              const subtotal = (item.quantidade || 0) * (item.preco_unitario || 0)
              return (
                <div key={idx} className="grid gap-2 items-center"
                  style={{ gridTemplateColumns: '1fr 80px 110px 90px 32px' }}>
                  {/* Faca */}
                  <select
                    value={item.faca_id}
                    onChange={(e) => updateItem(idx, 'faca_id', e.target.value)}
                    className="px-2.5 py-2 rounded-lg text-sm outline-none appearance-none"
                    style={selectStyle}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'var(--ac-accent)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'var(--ac-border)'}
                  >
                    <option value="">Selecionar faca...</option>
                    {facas.map((f) => (
                      <option key={f.id} value={f.id}>{f.codigo} — {f.nome}</option>
                    ))}
                  </select>

                  {/* Quantidade */}
                  <input
                    type="number"
                    min={1}
                    value={item.quantidade}
                    onChange={(e) => updateItem(idx, 'quantidade', parseInt(e.target.value) || 1)}
                    className="px-2.5 py-2 rounded-lg text-sm outline-none text-center tabular-nums"
                    style={inputStyle}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'var(--ac-accent)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'var(--ac-border)'}
                  />

                  {/* Preço unitário */}
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.preco_unitario}
                    onChange={(e) => updateItem(idx, 'preco_unitario', parseFloat(e.target.value) || 0)}
                    className="px-2.5 py-2 rounded-lg text-sm outline-none text-right tabular-nums"
                    style={inputStyle}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'var(--ac-accent)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'var(--ac-border)'}
                  />

                  {/* Subtotal */}
                  <span className="text-right text-sm tabular-nums font-medium" style={{ color: 'var(--ac-text)' }}>
                    {subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>

                  {/* Remove */}
                  <button
                    onClick={() => removeItem(idx)}
                    disabled={itens.length <= 1}
                    className="p-1 rounded-lg transition-colors flex items-center justify-center"
                    style={{ color: itens.length <= 1 ? 'var(--ac-border)' : 'var(--ac-muted)' }}
                    onMouseEnter={(e) => { if (itens.length > 1) { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626' } }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = itens.length <= 1 ? 'var(--ac-border)' : 'var(--ac-muted)' }}
                    title="Remover item"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>

          {/* Total */}
          <div className="flex justify-end pt-2 mt-1" style={{ borderTop: '1px solid var(--ac-border)' }}>
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Total</span>
              <span className="text-xl font-bold" style={{ color: 'var(--ac-accent)' }}>
                {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>
        </div>

        {erro && <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>{erro}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button loading={loading} onClick={salvar}>{editando ? 'Salvar' : 'Criar venda'}</Button>
        </div>
      </div>
    </Modal>
  )
}
