'use client'

import { useEffect, useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { salvarEmpresa, type EmpresaInput } from '@/lib/actions/empresa'
import { apenasDigitos, formatarCep, formatarCnpj } from '@/lib/br/documento'
import { buscarEnderecoPorCep } from '@/lib/br/viacep'
import { SIGLAS_UF, REGIMES_TRIBUTARIOS } from '@/lib/br/constants'
import type { Empresa } from '@/types'

type Props = {
  empresa: Empresa | null
  podeEditar: boolean
}

const inputStyle = {
  background: 'var(--ac-card)',
  border: '1px solid var(--ac-border)',
  color: 'var(--ac-text)',
}

export function EmpresaSection({ empresa, podeEditar }: Props) {
  const [razaoSocial, setRazaoSocial] = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [ie, setIe] = useState('')
  const [im, setIm] = useState('')
  const [crt, setCrt] = useState<number>(1)
  const [cep, setCep] = useState('')
  const [logradouro, setLogradouro] = useState('')
  const [numero, setNumero] = useState('')
  const [complemento, setComplemento] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [uf, setUf] = useState('')
  const [ibge, setIbge] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [buscandoCep, setBuscandoCep] = useState(false)

  useEffect(() => {
    if (!empresa) return
    setRazaoSocial(empresa.razao_social ?? '')
    setNomeFantasia(empresa.nome_fantasia ?? '')
    setCnpj(formatarCnpj(empresa.cnpj ?? ''))
    setIe(empresa.ie ?? '')
    setIm(empresa.im ?? '')
    setCrt(empresa.crt ?? 1)
    setCep(formatarCep(empresa.cep ?? ''))
    setLogradouro(empresa.logradouro ?? '')
    setNumero(empresa.numero ?? '')
    setComplemento(empresa.complemento ?? '')
    setBairro(empresa.bairro ?? '')
    setCidade(empresa.cidade ?? '')
    setUf(empresa.uf ?? '')
    setIbge(empresa.codigo_municipio_ibge ?? '')
    setTelefone(empresa.telefone ?? '')
    setEmail(empresa.email ?? '')
  }, [empresa])

  async function handleBuscarCep() {
    setErro(null)
    const limpo = apenasDigitos(cep)
    if (limpo.length !== 8) {
      setErro('Informe um CEP com 8 dígitos.')
      return
    }
    setBuscandoCep(true)
    try {
      const end = await buscarEnderecoPorCep(limpo)
      if (!end) {
        setErro('CEP não encontrado.')
        return
      }
      setLogradouro((p) => end.logradouro || p)
      setComplemento((p) => end.complemento || p)
      setBairro((p) => end.bairro || p)
      setCidade((p) => end.cidade || p)
      setUf((p) => end.uf || p)
      if (end.ibge) setIbge(end.ibge)
    } catch {
      setErro('Falha ao consultar o CEP.')
    } finally {
      setBuscandoCep(false)
    }
  }

  function handleSalvar() {
    setMsg(null)
    setErro(null)
    const input: EmpresaInput = {
      razao_social: razaoSocial,
      nome_fantasia: nomeFantasia,
      cnpj,
      ie,
      im,
      crt,
      cep,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      uf,
      codigo_municipio_ibge: ibge,
      telefone,
      email,
    }
    startTransition(async () => {
      try {
        await salvarEmpresa(input)
        setMsg('Dados da empresa salvos.')
      } catch (e: unknown) {
        setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
      }
    })
  }

  return (
    <div
      id="config-empresa"
      className="scroll-mt-24 rounded-xl p-5 sm:p-6 shadow-sm"
      style={{
        background: 'var(--ac-card)',
        border: '1px solid var(--ac-border)',
        boxShadow: '0 1px 3px color-mix(in srgb, var(--ac-text) 6%, transparent)',
      }}
    >
      <div className="mb-5 sm:mb-6">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--ac-text)' }}>
          Dados da Empresa (Emitente NF-e)
        </h2>
        <p className="text-sm mt-1 leading-relaxed max-w-2xl" style={{ color: 'var(--ac-muted)' }}>
          Esses dados serão usados quando o sistema passar a emitir NF-e. Por enquanto, são apenas armazenados.
          {!podeEditar && ' Você pode visualizar; apenas quem tem permissão de edição altera os dados.'}
        </p>
      </div>

      <fieldset disabled={!podeEditar || pending} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input id="emp-razao" label="Razão Social *" value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} />
          <Input id="emp-fantasia" label="Nome Fantasia" value={nomeFantasia} onChange={(e) => setNomeFantasia(e.target.value)} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            id="emp-cnpj"
            label="CNPJ *"
            placeholder="00.000.000/0000-00"
            value={cnpj}
            onChange={(e) => setCnpj(formatarCnpj(apenasDigitos(e.target.value)))}
          />
          <Input id="emp-ie" label="Inscrição Estadual" placeholder="ISENTO ou número" value={ie} onChange={(e) => setIe(e.target.value)} />
          <Input id="emp-im" label="Inscrição Municipal" value={im} onChange={(e) => setIm(e.target.value)} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>Regime Tributário (CRT)</label>
          <select
            value={crt}
            onChange={(e) => setCrt(Number(e.target.value))}
            className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
            style={{
              ...inputStyle,
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%236b7280' stroke-width='2' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '16px', paddingRight: '36px',
            }}
          >
            {REGIMES_TRIBUTARIOS.map((r) => (
              <option key={r.codigo} value={r.codigo}>{r.codigo} — {r.descricao}</option>
            ))}
          </select>
        </div>

        <div
          className="rounded-lg p-3 flex flex-col gap-3"
          style={{ border: '1px solid var(--ac-border)', background: 'var(--ac-bg)' }}
        >
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Endereço</p>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1 min-w-0">
              <Input
                id="emp-cep"
                label="CEP"
                placeholder="00000-000"
                value={cep}
                onChange={(e) => setCep(formatarCep(e.target.value))}
                inputMode="numeric"
              />
            </div>
            <Button type="button" variant="secondary" loading={buscandoCep} onClick={handleBuscarCep} className="shrink-0 w-full sm:w-auto">
              Buscar pelo CEP
            </Button>
          </div>
          <Input id="emp-logradouro" label="Logradouro" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input id="emp-numero" label="Número" value={numero} onChange={(e) => setNumero(e.target.value)} />
            <Input id="emp-complemento" label="Complemento" value={complemento} onChange={(e) => setComplemento(e.target.value)} />
          </div>
          <Input id="emp-bairro" label="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input id="emp-cidade" label="Cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>UF</label>
              <select
                value={uf}
                onChange={(e) => setUf(e.target.value)}
                className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
                style={{
                  ...inputStyle,
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%236b7280' stroke-width='2' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', backgroundSize: '16px', paddingRight: '36px',
                }}
              >
                <option value="">—</option>
                {SIGLAS_UF.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <Input
              id="emp-ibge"
              label="Código IBGE (município)"
              placeholder="7 dígitos"
              value={ibge}
              onChange={(e) => setIbge(e.target.value.replace(/\D/g, '').slice(0, 7))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input id="emp-tel" label="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          <Input id="emp-email" label="E-mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        {podeEditar && (
          <div className="flex items-center gap-3 flex-wrap">
            <Button type="button" onClick={handleSalvar} loading={pending}>Salvar dados da empresa</Button>
            {msg && <span className="text-sm" style={{ color: '#15803d' }}>{msg}</span>}
          </div>
        )}
        {erro && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>{erro}</p>
        )}
      </fieldset>
    </div>
  )
}
