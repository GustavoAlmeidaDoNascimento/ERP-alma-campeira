'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { DateInputBR } from '@/components/ui/date-input-br'
import { Button } from '@/components/ui/button'
import { criarBoleto, atualizarBoleto, type BoletoInput, type ParcelaInput } from '@/lib/actions/boletos'
import type { Boleto, BoletoTipo, Cliente, Fornecedor } from '@/types'

type UsuarioMin = { id: string; nome: string }

type Props = {
  open: boolean
  onClose: () => void
  editando: Boleto | null
  tipoInicial: BoletoTipo
  clientes: Cliente[]
  fornecedores: Fornecedor[]
  usuarios: UsuarioMin[]
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
  return new Date().toISOString().slice(0, 10)
}

function somarMeses(isoDate: string, meses: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const data = new Date(y, (m - 1) + meses, d)
  const yyyy = data.getFullYear()
  const mm = String(data.getMonth() + 1).padStart(2, '0')
  const dd = String(data.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

type Linha = {
  numero: number
  vencimento: string
  valor: string
  pago: boolean
  pago_em: string
  valor_pago: string
  parcelaId?: string
}

function linhasVazias(qtd: number, base: string, valorTotal: number): Linha[] {
  const vCada = valorTotal > 0 ? Number((valorTotal / qtd).toFixed(2)) : 0
  // Ajusta a última parcela pra fechar o total exato
  let acumulado = 0
  return Array.from({ length: qtd }, (_, i) => {
    const ult = i === qtd - 1
    const v = ult ? Math.max(0, Number((valorTotal - acumulado).toFixed(2))) : vCada
    acumulado += v
    return {
      numero: i + 1,
      vencimento: somarMeses(base, i + 1),
      valor: v > 0 ? String(v.toFixed(2)) : '',
      pago: false,
      pago_em: '',
      valor_pago: '',
    }
  })
}

export function BoletoModal({
  open, onClose, editando, tipoInicial,
  clientes, fornecedores, usuarios, onSaved,
}: Props) {
  const [tipo, setTipo] = useState<BoletoTipo>(tipoInicial)
  const [contraparteNome, setContraparteNome] = useState('')
  const [cnpjCpf, setCnpjCpf] = useState('')
  const [clienteId, setClienteId] = useState<string>('')
  const [fornecedorId, setFornecedorId] = useState<string>('')
  const [vendedorId, setVendedorId] = useState<string>('')
  const [unidades, setUnidades] = useState<string>('')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [valorTotal, setValorTotal] = useState<string>('')
  const [emitidoEm, setEmitidoEm] = useState<string>(hoje())
  const [observacao, setObservacao] = useState('')
  const [parcelas, setParcelas] = useState<Linha[]>(() => linhasVazias(1, hoje(), 0))
  const [qtdParcelas, setQtdParcelas] = useState<number>(1)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    if (!open) return
    if (editando) {
      setTipo(editando.tipo)
      setContraparteNome(editando.contraparte_nome)
      setCnpjCpf(editando.cnpj_cpf ?? '')
      setClienteId(editando.cliente_id ?? '')
      setFornecedorId(editando.fornecedor_id ?? '')
      setVendedorId(editando.vendedor_id ?? '')
      setUnidades(editando.unidades ? String(editando.unidades) : '')
      setNumeroDocumento(editando.numero_documento ?? '')
      setValorTotal(String(editando.valor_total ?? ''))
      setEmitidoEm(editando.emitido_em ?? hoje())
      setObservacao(editando.observacao ?? '')
      const lin: Linha[] = editando.parcelas.map((p) => ({
        numero: p.numero,
        vencimento: p.vencimento,
        valor: String(p.valor ?? ''),
        pago: !!p.pago_em,
        pago_em: p.pago_em ?? '',
        valor_pago: p.valor_pago != null ? String(p.valor_pago) : '',
        parcelaId: p.id,
      }))
      setParcelas(lin)
      setQtdParcelas(lin.length)
    } else {
      setTipo(tipoInicial)
      setContraparteNome('')
      setCnpjCpf('')
      setClienteId('')
      setFornecedorId('')
      setVendedorId('')
      setUnidades('')
      setNumeroDocumento('')
      setValorTotal('')
      setEmitidoEm(hoje())
      setObservacao('')
      setQtdParcelas(1)
      setParcelas(linhasVazias(1, hoje(), 0))
    }
    setErro('')
  }, [open, editando, tipoInicial])

  function trocarTipo(novo: BoletoTipo) {
    setTipo(novo)
    if (novo === 'entrada') {
      setFornecedorId('')
    } else {
      setClienteId('')
      setVendedorId('')
    }
  }

  function aplicarParcelar(n: number) {
    setQtdParcelas(n)
    const total = Number(valorTotal.replace(',', '.'))
    const base = emitidoEm || hoje()
    setParcelas(linhasVazias(n, base, Number.isFinite(total) ? total : 0))
  }

  function distribuirValor(novoTotal: string) {
    setValorTotal(novoTotal)
    const total = Number(novoTotal.replace(',', '.'))
    if (!Number.isFinite(total)) return
    setParcelas((prev) => {
      const n = prev.length
      if (n === 0) return prev
      const vCada = total > 0 ? Number((total / n).toFixed(2)) : 0
      let acumulado = 0
      return prev.map((l, i) => {
        const ult = i === n - 1
        const v = ult ? Math.max(0, Number((total - acumulado).toFixed(2))) : vCada
        acumulado += v
        return { ...l, valor: v > 0 ? String(v.toFixed(2)) : '' }
      })
    })
  }

  function atualizarLinha(idx: number, patch: Partial<Linha>) {
    setParcelas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  const somaParcelas = useMemo(
    () => parcelas.reduce((s, p) => s + (Number(p.valor.replace(',', '.')) || 0), 0),
    [parcelas],
  )

  function selecionarCliente(id: string) {
    setClienteId(id)
    const c = clientes.find((x) => x.id === id)
    if (c) {
      setContraparteNome(c.nome)
      setCnpjCpf(c.documento ?? '')
    } else {
      setContraparteNome('')
      setCnpjCpf('')
    }
  }
  function selecionarFornecedor(id: string) {
    setFornecedorId(id)
    const f = fornecedores.find((x) => x.id === id)
    if (f) {
      setContraparteNome(f.nome)
      setCnpjCpf(f.documento ?? '')
    } else {
      setContraparteNome('')
      setCnpjCpf('')
    }
  }

  async function salvar() {
    if (isEntrada && !clienteId) { setErro('Selecione um cliente.'); return }
    if (!isEntrada && !fornecedorId) { setErro('Selecione um fornecedor.'); return }
    const total = Number(valorTotal.replace(',', '.'))
    if (!Number.isFinite(total) || total < 0) { setErro('Valor total inválido.'); return }
    if (parcelas.length === 0) { setErro('Adicione ao menos uma parcela.'); return }

    const parcelasInput: ParcelaInput[] = parcelas.map((p) => ({
      numero: p.numero,
      vencimento: p.vencimento,
      valor: Number(p.valor.replace(',', '.')) || 0,
      pago_em: p.pago ? (p.pago_em || hoje()) : null,
      valor_pago: p.pago
        ? (p.valor_pago ? Number(p.valor_pago.replace(',', '.')) : Number(p.valor.replace(',', '.')) || 0)
        : null,
    }))

    const input: BoletoInput = {
      tipo,
      contraparte_nome: contraparteNome,
      cnpj_cpf: cnpjCpf || null,
      cliente_id: tipo === 'entrada' ? (clienteId || null) : null,
      fornecedor_id: tipo === 'saida' ? (fornecedorId || null) : null,
      vendedor_id: tipo === 'entrada' ? (vendedorId || null) : null,
      unidades: unidades ? Number(unidades) : null,
      numero_documento: numeroDocumento || null,
      valor_total: total,
      emitido_em: emitidoEm || null,
      observacao: observacao || null,
      parcelas: parcelasInput,
    }

    setErro(''); setLoading(true)
    try {
      if (editando) await atualizarBoleto(editando.id, input)
      else await criarBoleto(input)
      onClose()
      onSaved?.()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  const isEntrada = tipo === 'entrada'
  const linkCriar = isEntrada ? '/clientes' : '/fornecedores'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        editando
          ? (isEntrada ? 'Editar boleto a receber' : 'Editar pagamento')
          : (isEntrada ? 'Novo boleto a receber' : 'Novo pagamento (saída)')
      }
      width="780px"
    >
      <div className="flex flex-col gap-4">
        {/* Tipo */}
        <div className="flex gap-2">
          {(['saida', 'entrada'] as const).map((t) => {
            const ativo = tipo === t
            return (
              <button
                key={t}
                type="button"
                onClick={() => trocarTipo(t)}
                disabled={!!editando}
                className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: ativo ? 'var(--ac-accent)' : 'var(--ac-card)',
                  color: ativo ? 'white' : 'var(--ac-text)',
                  border: '1px solid var(--ac-border)',
                }}
              >
                {t === 'saida' ? 'Saída (a pagar)' : 'Entrada (a receber)'}
              </button>
            )
          })}
        </div>

        {/* Vínculo: cliente/fornecedor */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>
                {isEntrada ? 'Cliente' : 'Fornecedor'}
              </label>
              <Link href={linkCriar} target="_blank" className="text-xs underline" style={{ color: 'var(--ac-accent)' }}>
                + Criar cadastro
              </Link>
            </div>
            {isEntrada ? (
              <select
                value={clienteId}
                onChange={(e) => selecionarCliente(e.target.value)}
                className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
                style={{ ...inputStyle, ...selectChevron }}
              >
                <option value="">— Selecione —</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            ) : (
              <select
                value={fornecedorId}
                onChange={(e) => selecionarFornecedor(e.target.value)}
                className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
                style={{ ...inputStyle, ...selectChevron }}
              >
                <option value="">— Selecione —</option>
                {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            )}
          </div>

          {isEntrada && (
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>Vendedor</label>
              <select
                value={vendedorId}
                onChange={(e) => setVendedorId(e.target.value)}
                className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
                style={{ ...inputStyle, ...selectChevron }}
              >
                <option value="">—</option>
                {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
          )}
        </div>

        <Input
          id="b-cnpj"
          label="CNPJ / CPF"
          value={cnpjCpf}
          onChange={(e) => setCnpjCpf(e.target.value)}
          placeholder="Preenchido ao selecionar o cadastro"
        />

        {/* Campos extras */}
        <div className={`grid grid-cols-1 gap-3 ${isEntrada ? 'sm:grid-cols-3' : 'sm:grid-cols-1'}`}>
          {isEntrada && (
            <>
              <Input
                id="b-numero"
                label="Número(s) NF / pedido"
                value={numeroDocumento}
                onChange={(e) => setNumeroDocumento(e.target.value)}
                placeholder="Ex.: 469/470/471"
              />
              <Input
                id="b-un"
                label="UN (unidades)"
                type="number"
                min="1"
                step="1"
                value={unidades}
                onChange={(e) => setUnidades(e.target.value)}
              />
            </>
          )}
          <DateInputBR
            id="b-emitido"
            label={isEntrada ? 'Emitido em' : 'Data'}
            value={emitidoEm}
            onChange={setEmitidoEm}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="b-total"
            label="Valor total (R$) *"
            type="number"
            step="0.01"
            min="0"
            value={valorTotal}
            onChange={(e) => distribuirValor(e.target.value)}
            placeholder="0,00"
          />
          <Input
            id="b-parcelas"
            label="Parcelar em (x)"
            type="number"
            min="1"
            step="1"
            value={String(qtdParcelas)}
            onChange={(e) => {
              const n = Math.max(1, Math.floor(Number(e.target.value) || 1))
              aplicarParcelar(n)
            }}
          />
        </div>

        {/* Tabela de parcelas */}
        <div
          className="shrink-0 rounded-lg"
          style={{ border: '1px solid var(--ac-border)' }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--ac-bg)' }}>
                <th className="px-3 py-2 text-left text-xs uppercase font-semibold" style={{ color: 'var(--ac-muted)' }}>#</th>
                <th className="px-3 py-2 text-left text-xs uppercase font-semibold" style={{ color: 'var(--ac-muted)' }}>Vencimento</th>
                <th className="px-3 py-2 text-right text-xs uppercase font-semibold" style={{ color: 'var(--ac-muted)' }}>Valor</th>
                <th className="px-3 py-2 text-center text-xs uppercase font-semibold" style={{ color: 'var(--ac-muted)' }}>Pago</th>
                <th className="px-3 py-2 text-left text-xs uppercase font-semibold" style={{ color: 'var(--ac-muted)' }}>Data pgto</th>
              </tr>
            </thead>
            <tbody>
              {parcelas.map((p, i) => (
                <tr key={i} style={{ borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined }}>
                  <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--ac-muted)' }}>{p.numero}</td>
                  <td className="px-3 py-2">
                    <DateInputBR
                      value={p.vencimento}
                      onChange={(iso) => atualizarLinha(i, { vencimento: iso })}
                      className="rounded px-2 py-1 text-sm outline-none w-full"
                      style={inputStyle}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={p.valor}
                      onChange={(e) => atualizarLinha(i, { valor: e.target.value })}
                      className="rounded px-2 py-1 text-sm outline-none w-full text-right"
                      style={inputStyle}
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={p.pago}
                      onChange={(e) => atualizarLinha(i, {
                        pago: e.target.checked,
                        pago_em: e.target.checked ? (p.pago_em || hoje()) : '',
                      })}
                      className="size-4"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <DateInputBR
                      value={p.pago_em}
                      onChange={(iso) => atualizarLinha(i, { pago_em: iso })}
                      disabled={!p.pago}
                      className="rounded px-2 py-1 text-sm outline-none w-full disabled:opacity-50"
                      style={inputStyle}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: 'var(--ac-bg)', borderTop: '1px solid var(--ac-border)' }}>
                <td colSpan={2} className="px-3 py-2 text-right text-xs font-semibold" style={{ color: 'var(--ac-muted)' }}>
                  Soma das parcelas:
                </td>
                <td className="px-3 py-2 text-right font-semibold" style={{
                  color: Math.abs(somaParcelas - (Number(valorTotal.replace(',', '.')) || 0)) < 0.005
                    ? '#15803d'
                    : '#b91c1c'
                }}>
                  R$ {somaParcelas.toFixed(2)}
                </td>
                <td colSpan={2}></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>Observação</label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            rows={2}
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-y"
            style={inputStyle}
            placeholder="Opcional"
          />
        </div>

        {erro && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>{erro}</p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button loading={loading} onClick={salvar}>{editando ? 'Salvar alterações' : 'Registrar boleto'}</Button>
        </div>
      </div>
    </Modal>
  )
}
