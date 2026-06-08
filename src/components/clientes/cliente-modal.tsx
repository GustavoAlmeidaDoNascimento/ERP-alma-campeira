'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { criarCliente, atualizarCliente } from '@/lib/actions/clientes'
import { TIPOS_CLIENTE } from '@/types'
import type { Cliente, TipoDocumento } from '@/types'
import { apenasDigitos, formatarCep, formatarCnpj, formatarCpf } from '@/lib/br/documento'
import { buscarEnderecoPorCep } from '@/lib/br/viacep'
import { buscarEmpresaPorCnpj } from '@/lib/br/cnpj'
import { SIGLAS_UF, INDICADORES_IE } from '@/lib/br/constants'
import { validarCamposObrigatoriosCliente } from '@/lib/br/validar-cadastro-parceiro'

type Props = {
  open: boolean
  onClose: () => void
  editando: Cliente | null
  onSaved?: () => void
}

const ESTADOS_BR = SIGLAS_UF

const inputStyle = {
  background: 'var(--ac-card)',
  border: '1px solid var(--ac-border)',
  color: 'var(--ac-text)',
}

function tipoDocDeCliente(c: Cliente): TipoDocumento {
  return c.tipo_documento === 'cpf' ? 'cpf' : 'cnpj'
}

export function ClienteModal({ open, onClose, editando, onSaved }: Props) {
  const [nome, setNome] = useState('')
  const [tipo, setTipo] = useState<string>('Lojista')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumento>('cnpj')
  const [documento, setDocumento] = useState('')
  const [cep, setCep] = useState('')
  const [logradouro, setLogradouro] = useState('')
  const [numero, setNumero] = useState('')
  const [complemento, setComplemento] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [ie, setIe] = useState('')
  const [indicadorIe, setIndicadorIe] = useState<number>(9)
  const [codigoIbge, setCodigoIbge] = useState('')
  const [loading, setLoading] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!open) return
    if (editando) {
      const td = tipoDocDeCliente(editando)
      const doc = editando.documento ?? ''
      setNome(editando.nome)
      setTipo(editando.tipo)
      setTelefone(editando.telefone ?? '')
      setEmail(editando.email ?? '')
      setTipoDocumento(td)
      setDocumento(td === 'cpf' ? formatarCpf(doc) : formatarCnpj(doc))
      setCep(formatarCep(editando.cep ?? ''))
      setLogradouro(editando.logradouro ?? '')
      setNumero(editando.numero ?? '')
      setComplemento(editando.complemento ?? '')
      setBairro(editando.bairro ?? '')
      setCidade(editando.cidade ?? '')
      setEstado(editando.estado || 'RS')
      setRazaoSocial(editando.razao_social ?? '')
      setIe(editando.ie ?? '')
      setIndicadorIe(editando.indicador_ie ?? 9)
      setCodigoIbge(editando.codigo_municipio_ibge ?? '')
    } else {
      setNome('')
      setTipo('Lojista')
      setTelefone('')
      setEmail('')
      setTipoDocumento('cnpj')
      setDocumento('')
      setCep('')
      setLogradouro('')
      setNumero('')
      setComplemento('')
      setBairro('')
      setCidade('')
      setEstado('RS')
      setRazaoSocial('')
      setIe('')
      setIndicadorIe(9)
      setCodigoIbge('')
    }
    setErro('')
  }, [open, editando])

  function onTipoDocumentoChange(t: TipoDocumento) {
    const d = apenasDigitos(documento)
    setTipoDocumento(t)
    setDocumento(t === 'cpf' ? formatarCpf(d) : formatarCnpj(d))
  }

  function onDocumentoInput(v: string) {
    const d = apenasDigitos(v)
    setDocumento(tipoDocumento === 'cpf' ? formatarCpf(d) : formatarCnpj(d))
  }

  function onCepInput(v: string) {
    setCep(formatarCep(v))
  }

  async function handleBuscarCep() {
    setErro('')
    const limpo = apenasDigitos(cep)
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
      setLogradouro((prev) => end.logradouro || prev)
      setComplemento((prev) => end.complemento || prev)
      setBairro((prev) => end.bairro || prev)
      setCidade((prev) => end.cidade || prev)
      setEstado((prev) => end.uf || prev)
      if (end.ibge) setCodigoIbge(end.ibge)
    } catch {
      setErro('Não foi possível consultar o CEP. Tente novamente.')
    } finally {
      setBuscandoCep(false)
    }
  }

  async function handleBuscarCnpj() {
    setErro('')
    if (tipoDocumento !== 'cnpj') {
      setErro('Selecione o tipo CNPJ para usar a busca.')
      return
    }
    const limpo = apenasDigitos(documento)
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
      setNome((prev) => prev || emp.nome_fantasia || emp.razao_social)
      setRazaoSocial((prev) => emp.razao_social || prev)
      setTelefone((prev) => prev || emp.telefone)
      setEmail((prev) => prev || emp.email)
      if (emp.cep) setCep(formatarCep(emp.cep))
      setLogradouro((prev) => emp.logradouro || prev)
      setNumero((prev) => emp.numero || prev)
      setComplemento((prev) => emp.complemento || prev)
      setBairro((prev) => emp.bairro || prev)
      setCidade((prev) => emp.cidade || prev)
      setEstado((prev) => emp.uf || prev)
      if (emp.ibge) setCodigoIbge(emp.ibge)
    } catch {
      setErro('Não foi possível consultar o CNPJ. Tente novamente.')
    } finally {
      setBuscandoCnpj(false)
    }
  }

  async function salvar(e?: React.FormEvent) {
    e?.preventDefault()
    setErro('')
    try {
      validarCamposObrigatoriosCliente({
        nome,
        tipo,
        indicador_ie: indicadorIe,
        telefone,
        email,
        tipo_documento: tipoDocumento,
        documento,
        cep,
        logradouro,
        numero,
        complemento,
        bairro,
        cidade,
        uf: estado,
        razao_social: razaoSocial,
        ie,
        codigo_municipio_ibge: codigoIbge,
      })
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Preencha todos os campos obrigatórios.')
      return
    }
    setLoading(true)
    try {
      const input = {
        nome,
        tipo,
        telefone,
        email,
        tipo_documento: tipoDocumento,
        documento,
        cep,
        logradouro,
        numero,
        complemento,
        bairro,
        cidade,
        estado,
        razao_social: razaoSocial,
        ie,
        indicador_ie: indicadorIe,
        codigo_municipio_ibge: codigoIbge,
      }
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
    <Modal open={open} onClose={onClose} title={editando ? 'Editar cliente' : 'Novo cliente'} width="640px">
      <form
        onSubmit={(e) => void salvar(e)}
        className="flex flex-col gap-4 max-h-[min(72vh,560px)] overflow-y-auto"
      >
        <Input
          id="cli-nome"
          label="Nome *"
          required
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Razão social ou nome completo"
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>Tipo de cliente *</label>
          <select
            required
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
            style={{
              ...inputStyle,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%236b7280' stroke-width='2' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '16px', paddingRight: '36px',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ac-accent)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ac-border)' }}
          >
            {TIPOS_CLIENTE.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>Documento *</label>
            <select
              required
              value={tipoDocumento}
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
              id="cli-documento"
              label={tipoDocumento === 'cpf' ? 'CPF *' : 'CNPJ *'}
              required
              placeholder={tipoDocumento === 'cpf' ? '000.000.000-00' : '00.000.000/0000-00'}
              value={documento}
              onChange={(e) => onDocumentoInput(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>

        {tipoDocumento === 'cnpj' && (
          <div className="flex justify-end -mt-2">
            <Button type="button" variant="secondary" loading={buscandoCnpj} onClick={handleBuscarCnpj}>
              Buscar pelo CNPJ
            </Button>
          </div>
        )}

        {tipoDocumento === 'cnpj' && (
          <div className="grid grid-cols-1 gap-3">
            <Input
              id="cli-razao-social"
              label="Razão Social *"
              required
              placeholder="Nome jurídico (se diferente do nome fantasia acima)"
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
            />
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="cli-ie"
            label="Inscrição Estadual *"
            required
            placeholder="ISENTO ou número"
            value={ie}
            onChange={(e) => setIe(e.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cli-ind-ie" className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>Indicador IE *</label>
            <select
              id="cli-ind-ie"
              required
              value={indicadorIe}
              onChange={(e) => setIndicadorIe(Number(e.target.value))}
              className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
              style={{
                ...inputStyle,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%236b7280' stroke-width='2' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '16px', paddingRight: '36px',
              }}
            >
              {INDICADORES_IE.map((i) => (
                <option key={i.codigo} value={i.codigo}>{i.codigo} — {i.descricao}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            id="cli-tel"
            label="Telefone *"
            required
            type="tel"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value.replace(/[^\d\s()\-+]/g, ''))}
            placeholder="(51) 99999-9999"
          />
          <Input
            id="cli-email"
            label="E-mail *"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contato@empresa.com"
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
                id="cli-cep"
                label="CEP *"
                required
                placeholder="00000-000"
                value={cep}
                onChange={(e) => onCepInput(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <Button type="button" variant="secondary" loading={buscandoCep} onClick={handleBuscarCep} className="shrink-0 w-full sm:w-auto">
              Buscar pelo CEP
            </Button>
          </div>
          <Input
            id="cli-logradouro"
            label="Logradouro (rua) *"
            required
            placeholder="Rua, avenida..."
            value={logradouro}
            onChange={(e) => setLogradouro(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="cli-numero"
              label="Número *"
              required
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="123"
            />
            <Input
              id="cli-complemento"
              label="Complemento"
              value={complemento}
              onChange={(e) => setComplemento(e.target.value)}
              placeholder="Sala, bloco..."
            />
          </div>
          <Input
            id="cli-bairro"
            label="Bairro *"
            required
            value={bairro}
            onChange={(e) => setBairro(e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="cli-cidade"
              label="Cidade *"
              required
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Porto Alegre"
            />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cli-uf" className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>UF *</label>
              <select
                id="cli-uf"
                required
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
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
            id="cli-ibge"
            label="Código IBGE do município *"
            placeholder="7 dígitos (preenchido ao buscar CEP)"
            value={codigoIbge}
            onChange={(e) => setCodigoIbge(e.target.value.replace(/\D/g, '').slice(0, 7))}
            inputMode="numeric"
            required
          />
        </div>

        {erro && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>{erro}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{editando ? 'Salvar' : 'Criar cliente'}</Button>
        </div>
      </form>
    </Modal>
  )
}
