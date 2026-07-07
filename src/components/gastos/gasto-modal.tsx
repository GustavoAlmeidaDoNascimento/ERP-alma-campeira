'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { criarGasto, atualizarGasto } from '@/lib/actions/gastos'
import { TipoGastoInput } from './tipo-gasto-input'
import { useTiposGasto } from '@/lib/query/hooks'
import { useResourceRefresh } from '@/lib/realtime/client'
import { FORMAS_PAGAMENTO } from '@/types'
import type { FormaPagamento, Gasto, TipoGasto } from '@/types'

type Props = {
  open: boolean
  onClose: () => void
  editando: Gasto | null
  usuarios: { id: string; nome: string }[]
  usuarioLogadoId: string | null
  perm: { criar: boolean; deletar: boolean }
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

export function GastoModal({ open, onClose, editando, usuarios, usuarioLogadoId, perm, onSaved }: Props) {
  const { refreshResources } = useResourceRefresh()
  const { data: tipos = [] } = useTiposGasto()
  const [tipo, setTipo] = useState<TipoGasto>('')
  const [descricao, setDescricao] = useState('')
  const [valor, setValor] = useState<string>('')
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('pix')
  const [dataGasto, setDataGasto] = useState<string>(hoje())
  const [observacao, setObservacao] = useState('')
  const [usuarioId, setUsuarioId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  const vinculadoOC = !!editando?.ordem_compra_id

  useEffect(() => {
    if (!open) return
    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) return

      if (editando) {
        setTipo(editando.tipo)
        setDescricao(editando.descricao)
        setValor(String(editando.valor ?? ''))
        setFormaPagamento(editando.forma_pagamento)
        setDataGasto(editando.data_gasto.slice(0, 10))
        setObservacao(editando.observacao ?? '')
        setUsuarioId(editando.usuario_id ?? '')
      } else {
        setTipo('')
        setDescricao('')
        setValor('')
        setFormaPagamento('pix')
        setDataGasto(hoje())
        setObservacao('')
        // Padrão: usuário logado se ele estiver na lista de ativos.
        const defaultId = usuarioLogadoId && usuarios.some((u) => u.id === usuarioLogadoId)
          ? usuarioLogadoId
          : ''
        setUsuarioId(defaultId)
      }
      setErro('')
    })

    return () => {
      cancelled = true
    }
  }, [open, editando, usuarioLogadoId, usuarios])

  function refreshTipos() {
    void refreshResources(['tipos_gasto'])
  }

  async function salvar() {
    if (!tipo.trim()) { setErro('Selecione o tipo de gasto.'); return }
    if (!descricao.trim()) { setErro('Descrição é obrigatória.'); return }
    const v = Number(valor.replace(',', '.'))
    if (!Number.isFinite(v) || v <= 0) { setErro('Informe um valor maior que zero.'); return }
    if (!dataGasto) { setErro('Informe a data do gasto.'); return }
    if (!usuarioId) { setErro('Selecione quem está registrando.'); return }

    setErro('')
    setLoading(true)
    try {
      const input = {
        tipo,
        descricao,
        valor: v,
        forma_pagamento: formaPagamento,
        data_gasto: dataGasto,
        observacao,
        ordem_compra_id: editando?.ordem_compra_id ?? null,
        usuario_id: usuarioId,
      }
      if (editando) await atualizarGasto(editando.id, input)
      else await criarGasto(input)
      onClose()
      onSaved?.()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editando ? 'Editar gasto' : 'Registrar gasto'} width="560px">
      <div className="flex flex-col gap-4 max-h-[min(72vh,560px)] overflow-y-auto">
        {vinculadoOC && (
          <div
            className="rounded-lg px-3 py-2 text-xs"
            style={{ background: 'var(--ac-bg)', border: '1px solid var(--ac-border)', color: 'var(--ac-muted)' }}
          >
            Este gasto foi gerado automaticamente pelo pagamento da OC{' '}
            <strong style={{ color: 'var(--ac-text)' }}>{editando?.ordem_compra?.codigo ?? ''}</strong>.
            O tipo e o valor não podem ser alterados.
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>Tipo *</label>
            <TipoGastoInput
              value={tipo}
              onChange={setTipo}
              tipos={tipos}
              disabled={vinculadoOC}
              podeCriar={perm.criar}
              podeRemover={perm.deletar}
              onTagsChanged={refreshTipos}
            />
          </div>

          <Input
            id="g-data"
            label="Data *"
            type="date"
            value={dataGasto}
            onChange={(e) => setDataGasto(e.target.value)}
          />
        </div>

        <Input
          id="g-descricao"
          label="Descrição *"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Com o que foi gasto / como foi gasto"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="g-valor"
            label="Valor (R$) *"
            type="number"
            step="0.01"
            min="0.01"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
            disabled={vinculadoOC}
          />

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>Forma de pagamento *</label>
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
          <Button loading={loading} onClick={salvar}>{editando ? 'Salvar alterações' : 'Registrar gasto'}</Button>
        </div>
      </div>
    </Modal>
  )
}
