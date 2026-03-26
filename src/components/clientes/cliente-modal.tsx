'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { criarCliente, atualizarCliente } from '@/lib/actions/clientes'
import { TIPOS_CLIENTE } from '@/types'
import type { Cliente } from '@/types'

type Props = {
  open: boolean
  onClose: () => void
  editando: Cliente | null
  onSaved?: () => void
}

const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

type InputProps = {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}

const inputStyle = {
  background: 'var(--ac-card)',
  border: '1px solid var(--ac-border)',
  color: 'var(--ac-text)',
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
        style={inputStyle}
        onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ac-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--ac-accent) 20%, transparent)' }}
        onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ac-border)'; e.currentTarget.style.boxShadow = 'none' }}
      />
    </div>
  )
}

export function ClienteModal({ open, onClose, editando, onSaved }: Props) {
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<string>('Lojista')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('RS')
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (open) {
      setNome(editando?.nome ?? '')
      setTipo(editando?.tipo ?? 'Lojista')
      setTelefone(editando?.telefone ?? '')
      setEmail(editando?.email ?? '')
      setCidade(editando?.cidade ?? '')
      setEstado(editando?.estado ?? 'RS')
      setErro('')
    }
  }, [open, editando])

  async function salvar() {
    if (!nome.trim()) { setErro('Nome é obrigatório.'); return }
    setErro(''); setLoading(true)
    try {
      const input = { nome, tipo, telefone, email, cidade, estado }
      if (editando) await atualizarCliente(editando.id, input)
      else await criarCliente(input)
      onClose()
      onSaved?.()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editando ? 'Editar cliente' : 'Novo cliente'}>
      <div className="flex flex-col gap-4">

        <Input label="Nome" value={nome} onChange={setNome} placeholder="Razão social ou nome completo" />

        {/* Tipo */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Tipo</label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
            style={{
              ...inputStyle,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%236b7280' stroke-width='2' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '16px', paddingRight: '36px',
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--ac-accent)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--ac-border)'}
          >
            {TIPOS_CLIENTE.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Telefone" value={telefone} onChange={setTelefone} placeholder="(51) 99999-9999" />
          <Input label="E-mail" value={email} onChange={setEmail} placeholder="contato@empresa.com" type="email" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Cidade" value={cidade} onChange={setCidade} placeholder="Porto Alegre" />

          {/* Estado */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Estado</label>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
              style={{
                ...inputStyle,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%236b7280' stroke-width='2' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '16px', paddingRight: '36px',
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'var(--ac-accent)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'var(--ac-border)'}
            >
              <option value="">—</option>
              {ESTADOS_BR.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
            </select>
          </div>
        </div>

        {erro && <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>{erro}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button loading={loading} onClick={salvar}>{editando ? 'Salvar' : 'Criar cliente'}</Button>
        </div>
      </div>
    </Modal>
  )
}
