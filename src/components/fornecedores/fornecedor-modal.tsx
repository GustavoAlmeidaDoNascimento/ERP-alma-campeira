'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { criarFornecedor, atualizarFornecedor } from '@/lib/actions/fornecedores'
import type { Fornecedor, TipoDocumento } from '@/types'
import { apenasDigitos, formatarCep, formatarCnpj, formatarCpf } from '@/lib/br/documento'
import { buscarEnderecoPorCep } from '@/lib/br/viacep'
import { buscarEmpresaPorCnpj } from '@/lib/br/cnpj'
import { SIGLAS_UF } from '@/lib/br/constants'
import { validarCamposObrigatoriosFornecedor } from '@/lib/br/validar-cadastro-parceiro'

type Props = {
  open: boolean
  onClose: () => void
  editando?: Fornecedor | null
  onSaved?: () => void
}

const ESTADOS_BR = SIGLAS_UF

const inputStyle = {
  background: 'var(--ac-card)',
  border: '1px solid var(--ac-border)',
  color: 'var(--ac-text)',
}

type Form = {
  nome: string
  telefone: string
  email: string
  tipo_documento: TipoDocumento
  documento: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  razao_social: string
  ie: string
  codigo_municipio_ibge: string
}

const formVazio: Form = {
  nome: '',
  telefone: '',
  email: '',
  tipo_documento: 'cnpj',
  documento: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: 'RS',
  razao_social: '',
  ie: '',
  codigo_municipio_ibge: '',
}

function tipoDocDeFornecedor(f: Fornecedor): TipoDocumento {
  return f.tipo_documento === 'cpf' ? 'cpf' : 'cnpj'
}

export function FornecedorModal({ open, onClose, editando, onSaved }: Props) {
  const [form, setForm] = useState<Form>(formVazio)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)

  useEffect(() => {
    if (editando) {
      const tipo = tipoDocDeFornecedor(editando)
      const doc = editando.documento ?? ''
      setForm({
        nome: editando.nome,
        telefone: editando.telefone ?? '',
        email: editando.email ?? '',
        tipo_documento: tipo,
        documento: tipo === 'cpf' ? formatarCpf(doc) : formatarCnpj(doc),
        cep: formatarCep(editando.cep ?? ''),
        logradouro: editando.logradouro ?? '',
        numero: editando.numero ?? '',
        complemento: editando.complemento ?? '',
        bairro: editando.bairro ?? '',
        cidade: editando.cidade ?? '',
        uf: editando.uf || 'RS',
        razao_social: editando.razao_social ?? '',
        ie: editando.ie ?? '',
        codigo_municipio_ibge: editando.codigo_municipio_ibge ?? '',
      })
    } else {
      setForm(formVazio)
    }
    setErro('')
  }, [editando, open])

  function set(field: keyof Form, value: string) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function onTipoDocumentoChange(tipo: TipoDocumento) {
    setForm((f) => {
      const d = apenasDigitos(f.documento)
      return {
        ...f,
        tipo_documento: tipo,
        documento: tipo === 'cpf' ? formatarCpf(d) : formatarCnpj(d),
      }
    })
  }

  function onDocumentoInput(v: string) {
    const tipo = form.tipo_documento
    const d = apenasDigitos(v)
    set('documento', tipo === 'cpf' ? formatarCpf(d) : formatarCnpj(d))
  }

  function onCepInput(v: string) {
    set('cep', formatarCep(v))
  }

  async function handleBuscarCep() {
    setErro('')
    const limpo = apenasDigitos(form.cep)
    if (limpo.length !== 8) {
      setErro('Informe um CEP com 8 dígitos.')
      return
    }
    setBuscandoCep(true)
    try {
      const end = await buscarEnderecoPorCep(limpo)
      if (!end) {
        setErro('CEP não encontrado. Verifique o número ou preencha o endereço manualmente.')
        return
      }
      setForm((f) => ({
        ...f,
        logradouro: end.logradouro || f.logradouro,
        complemento: end.complemento || f.complemento,
        bairro: end.bairro || f.bairro,
        cidade: end.cidade || f.cidade,
        uf: end.uf || f.uf,
        codigo_municipio_ibge: end.ibge || f.codigo_municipio_ibge,
      }))
    } catch {
      setErro('Não foi possível consultar o CEP. Tente novamente.')
    } finally {
      setBuscandoCep(false)
    }
  }

  async function handleBuscarCnpj() {
    setErro('')
    if (form.tipo_documento !== 'cnpj') {
      setErro('Selecione o tipo CNPJ para usar a busca.')
      return
    }
    const limpo = apenasDigitos(form.documento)
    if (limpo.length !== 14) {
      setErro('Informe um CNPJ com 14 dígitos.')
      return
    }
    setBuscandoCnpj(true)
    try {
      const emp = await buscarEmpresaPorCnpj(limpo)
      if (!emp) {
        setErro('CNPJ não encontrado na BrasilAPI. Verifique o número ou preencha manualmente.')
        return
      }
      setForm((f) => ({
        ...f,
        nome: f.nome || emp.nome_fantasia || emp.razao_social,
        razao_social: emp.razao_social || f.razao_social,
        telefone: f.telefone || emp.telefone,
        email: f.email || emp.email,
        cep: emp.cep ? formatarCep(emp.cep) : f.cep,
        logradouro: emp.logradouro || f.logradouro,
        numero: emp.numero || f.numero,
        complemento: emp.complemento || f.complemento,
        bairro: emp.bairro || f.bairro,
        cidade: emp.cidade || f.cidade,
        uf: emp.uf || f.uf,
        codigo_municipio_ibge: emp.ibge || f.codigo_municipio_ibge,
      }))
    } catch {
      setErro('Não foi possível consultar o CNPJ. Tente novamente.')
    } finally {
      setBuscandoCnpj(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    try {
      validarCamposObrigatoriosFornecedor(form)
    } catch (err: unknown) {
      setErro(err instanceof Error ? err.message : 'Preencha todos os campos obrigatórios.')
      return
    }

    setLoading(true)
    try {
      const payload = {
        nome: form.nome,
        telefone: form.telefone,
        email: form.email,
        tipo_documento: form.tipo_documento,
        documento: form.documento,
        cep: form.cep,
        logradouro: form.logradouro,
        numero: form.numero,
        complemento: form.complemento,
        bairro: form.bairro,
        cidade: form.cidade,
        uf: form.uf,
        razao_social: form.razao_social,
        ie: form.ie,
        codigo_municipio_ibge: form.codigo_municipio_ibge,
      }
      if (editando) {
        await atualizarFornecedor(editando.id, payload)
      } else {
        await criarFornecedor(payload)
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
    <Modal open={open} onClose={onClose} title={editando ? `Editar — ${editando.nome}` : 'Novo Fornecedor'} width="640px">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto px-6 py-4 max-h-[min(72vh,560px)]">
        <Input
          id="nome"
          label="Nome *"
          required
          placeholder="Ex: Sergio Rodrigues"
          value={form.nome}
          onChange={(e) => set('nome', e.target.value)}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>Documento *</label>
            <select
              required
              value={form.tipo_documento}
              onChange={(e) => onTipoDocumentoChange(e.target.value as TipoDocumento)}
              className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
              style={{
                ...inputStyle,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%236b7280' stroke-width='2' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '16px', paddingRight: '36px',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ac-accent)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ac-border)' }}
            >
              <option value="cnpj">CNPJ (padrão)</option>
              <option value="cpf">CPF</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <Input
              id="documento"
              label={form.tipo_documento === 'cpf' ? 'CPF *' : 'CNPJ *'}
              required
              placeholder={form.tipo_documento === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'}
              value={form.documento}
              onChange={(e) => onDocumentoInput(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        {form.tipo_documento === 'cnpj' && (
          <div className="flex justify-end -mt-2">
            <Button type="button" variant="secondary" loading={buscandoCnpj} onClick={handleBuscarCnpj}>
              Buscar pelo CNPJ
            </Button>
          </div>
        )}

        {form.tipo_documento === 'cnpj' && (
          <Input
            id="forn-razao-social"
            label="Razão Social *"
            required
            placeholder="Nome jurídico (se diferente do nome fantasia acima)"
            value={form.razao_social}
            onChange={(e) => set('razao_social', e.target.value)}
          />
        )}

        <Input
          id="forn-ie"
          label="Inscrição Estadual"
          placeholder="ISENTO ou número"
          value={form.ie}
          onChange={(e) => set('ie', e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            id="telefone"
            label="Telefone *"
            required
            type="tel"
            placeholder="(51) 99999-0000"
            value={form.telefone}
            onChange={(e) => {
              const v = e.target.value.replace(/[^\d\s()\-+]/g, '')
              set('telefone', v)
            }}
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

        <div
          className="rounded-lg p-3 flex flex-col gap-3"
          style={{ border: '1px solid var(--ac-border)', background: 'var(--ac-bg)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Endereço</p>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1 min-w-0">
              <Input
                id="cep"
                label="CEP *"
                required
                placeholder="00000-000"
                value={form.cep}
                onChange={(e) => onCepInput(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <Button type="button" variant="secondary" loading={buscandoCep} onClick={handleBuscarCep} className="shrink-0 w-full sm:w-auto">
              Buscar pelo CEP
            </Button>
          </div>
          <Input
            id="logradouro"
            label="Logradouro (rua) *"
            required
            placeholder="Rua, avenida..."
            value={form.logradouro}
            onChange={(e) => set('logradouro', e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="numero"
              label="Número *"
              required
              placeholder="123"
              value={form.numero}
              onChange={(e) => set('numero', e.target.value)}
            />
            <Input
              id="complemento"
              label="Complemento"
              placeholder="Sala, bloco..."
              value={form.complemento}
              onChange={(e) => set('complemento', e.target.value)}
            />
          </div>
          <Input
            id="bairro"
            label="Bairro *"
            required
            value={form.bairro}
            onChange={(e) => set('bairro', e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="cidade"
              label="Cidade *"
              required
              value={form.cidade}
              onChange={(e) => set('cidade', e.target.value)}
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="uf" className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>UF *</label>
              <select
                id="uf"
                required
                value={form.uf}
                onChange={(e) => set('uf', e.target.value)}
                className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
                style={{
                  ...inputStyle,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%236b7280' stroke-width='2' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '16px', paddingRight: '36px',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ac-accent)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ac-border)' }}
              >
                {ESTADOS_BR.map((uf) => (
                  <option key={uf} value={uf}>{uf}</option>
                ))}
              </select>
            </div>
          </div>
          <Input
            id="codigo_municipio_ibge"
            label="Código IBGE do município *"
            placeholder="7 dígitos (preenchido ao buscar CEP)"
            value={form.codigo_municipio_ibge}
            onChange={(e) => set('codigo_municipio_ibge', e.target.value.replace(/\D/g, '').slice(0, 7))}
            inputMode="numeric"
            required
          />
        </div>

        {erro && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1 pb-1">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>
            {editando ? 'Salvar alterações' : 'Criar fornecedor'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
