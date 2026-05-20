'use client'

import { useState, type ReactNode } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { avancarStatus, marcarEntregue } from '@/lib/actions/vendas'
import { STATUS_PEDIDO } from '@/types'
import type { Pedido, PedidoClienteJoin, StatusPedido } from '@/types'
import { gerarPdfVendaSemValor } from '@/components/vendas/venda-sem-valor-pdf'
import { getOptimizedSupabaseImageUrl } from '@/lib/supabase/optimized-image'
import { formatarDocumento } from '@/lib/br/documento'

function fmtDataHora(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function fmtCep(v: string | null | undefined) {
  if (!v?.trim()) return ''
  const d = v.replace(/\D/g, '')
  if (d.length === 8) return `${d.slice(0, 5)}-${d.slice(5)}`
  return v.trim()
}

function clienteTemContatoOuEndereco(c: PedidoClienteJoin) {
  return !!(
    c.telefone?.trim()
    || c.email?.trim()
    || c.cep?.trim()
    || c.logradouro?.trim()
    || c.numero?.trim()
    || c.bairro?.trim()
    || c.complemento?.trim()
    || (c.cidade?.trim() && c.estado?.trim())
    || (c.cidade?.trim() && !c.estado?.trim())
    || (c.estado?.trim() && !c.cidade?.trim())
  )
}

/** Endereço formatado ou null quando não há nada a exibir */
function textoEnderecoCliente(c: PedidoClienteJoin): string | null {
  const cep = fmtCep(c.cep)
  const rua = [c.logradouro?.trim(), c.numero?.trim()].filter(Boolean).join(', ')
  const comp = c.complemento?.trim()
  const bai = c.bairro?.trim()
  const cidadeUf =
    c.cidade && c.estado
      ? `${c.cidade}/${c.estado}`
      : c.cidade || c.estado || ''

  const line1 = [cep, rua].filter(Boolean).join(' · ')
  const line2 = [comp, bai].filter(Boolean).join(' · ')
  const blocos = [line1, line2, cidadeUf.trim()].filter((s) => s.length > 0)
  if (blocos.length === 0) return null
  return blocos.join('\n')
}

function DetailMeta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
      <span className="text-xs font-semibold shrink-0 sm:w-36 tabular-nums" style={{ color: 'var(--ac-muted)' }}>{label}</span>
      <span className="text-sm break-words" style={{ color: 'var(--ac-text)' }}>{value}</span>
    </div>
  )
}

type Props = {
  pedido: Pedido | null
  onClose: () => void
  onStatusChange?: (id: string, novoStatus: StatusPedido, entregue_at?: string) => void
  perm: { editar: boolean }
}

export function VendaDetalheModal({ pedido, onClose, onStatusChange, perm }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [erro, setErro] = useState('')

  if (!pedido) return null

  const status = STATUS_PEDIDO[pedido.status]
  const pedidoId = pedido.id

  async function exportarVendaSemValor() {
    const p = pedido
    if (!p) return
    setErro('')
    setLoadingPdf(true)
    try {
      await gerarPdfVendaSemValor(p)
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gerar o PDF.')
    } finally {
      setLoadingPdf(false)
    }
  }

  async function acao(
    fn: () => Promise<void>,
    key: string,
    novoStatus?: StatusPedido,
    entregue_at?: string,
  ) {
    setErro(''); setLoading(key)
    try {
      await fn()
      if (novoStatus) onStatusChange?.(pedidoId, novoStatus, entregue_at)
      onClose()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro.')
    } finally {
      setLoading(null)
    }
  }

  const subtotalItens = pedido.itens?.reduce((s, i) => s + i.subtotal, 0) ?? 0
  const frete = pedido.frete ?? 0
  const descontoTotal = pedido.desconto_total ?? 0
  const total =
    pedido.valor_total ??
    Math.max(0, subtotalItens + frete - descontoTotal)

  return (
    <Modal
      open={!!pedido}
      onClose={onClose}
      title={`Venda ${pedido.sequencial != null ? `#${pedido.sequencial} · ` : ''}${pedido.codigo}`}
      width="600px"
    >
      <div className="flex flex-col gap-5">

        {/* Info header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold"
                style={{ color: status.color, background: status.bg, border: `1px solid ${status.border}` }}
              >
                {status.label}
              </span>
              {pedido.entregue_at && (
                <span className="text-xs" style={{ color: 'var(--ac-muted)' }}>
                  Entregue em {new Date(pedido.entregue_at).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--ac-muted)' }}>
              <strong style={{ color: 'var(--ac-text)' }}>
                {pedido.cliente?.nome ?? 'Sem cliente'}
              </strong>
              {pedido.cliente?.tipo && (
                <span className="ml-2 text-xs" style={{ color: 'var(--ac-muted)' }}>({pedido.cliente.tipo})</span>
              )}
            </p>
            {pedido.cliente?.documento ? (
              <p className="text-xs font-mono" style={{ color: 'var(--ac-muted)' }}>
                {formatarDocumento(pedido.cliente.tipo_documento === 'cpf' ? 'cpf' : 'cnpj', pedido.cliente.documento)}
                {pedido.cliente.cidade && pedido.cliente.estado
                  ? ` · ${pedido.cliente.cidade}/${pedido.cliente.estado}`
                  : ''}
              </p>
            ) : pedido.cliente?.cidade && pedido.cliente?.estado ? (
              <p className="text-xs" style={{ color: 'var(--ac-muted)' }}>
                {pedido.cliente.cidade}/{pedido.cliente.estado}
              </p>
            ) : null}
            {pedido.cliente?.razao_social?.trim() ? (
              <p className="text-xs mt-1" style={{ color: 'var(--ac-muted)' }}>
                Razão social:{' '}
                <span style={{ color: 'var(--ac-text)' }}>{pedido.cliente.razao_social}</span>
              </p>
            ) : null}
            {pedido.cliente?.ie?.trim() ? (
              <p className="text-xs font-mono" style={{ color: 'var(--ac-muted)' }}>IE: {pedido.cliente.ie}</p>
            ) : null}
            <p className="text-xs" style={{ color: 'var(--ac-muted)' }}>
              Data da venda: {new Date(pedido.data_pedido + 'T12:00:00').toLocaleDateString('pt-BR')}
            </p>
            {pedido.observacao && (
              <p className="text-xs mt-0.5 italic" style={{ color: 'var(--ac-muted)' }}>{pedido.observacao}</p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: 'var(--ac-muted)' }}>Total</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--ac-accent)' }}>
              {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
          </div>
        </div>

        {/* Registro da venda (cadastro no sistema) */}
        <div
          className="rounded-xl px-4 py-3 flex flex-col gap-2 text-sm"
          style={{
            border: '1px solid var(--ac-border)',
            background: 'color-mix(in srgb, var(--ac-bg) 88%, transparent)',
          }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
            Cadastro no sistema
          </p>
          <DetailMeta
            label="Vendedor responsável"
            value={pedido.vendedor?.nome?.trim() || '—'}
          />
          <DetailMeta label="Registrado em" value={fmtDataHora(pedido.created_at)} />
          {pedido.natureza_operacao?.trim() ? (
            <DetailMeta label="Natureza da operação" value={pedido.natureza_operacao.trim()} />
          ) : null}
        </div>

        {/* Contato e endereço do cliente */}
        {pedido.cliente && clienteTemContatoOuEndereco(pedido.cliente) && (
          <div
            className="rounded-xl px-4 py-3 flex flex-col gap-2 text-sm"
            style={{
              border: '1px solid var(--ac-border)',
              background: 'color-mix(in srgb, var(--ac-bg) 88%, transparent)',
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
              Contato e endereço
            </p>
            {pedido.cliente.telefone?.trim() ? (
              <DetailMeta label="Telefone" value={pedido.cliente.telefone.trim()} />
            ) : null}
            {pedido.cliente.email?.trim() ? (
              <DetailMeta
                label="E-mail"
                value={
                  <a
                    href={`mailto:${pedido.cliente.email.trim()}`}
                    className="underline decoration-dotted"
                    style={{ color: 'var(--ac-accent-strong, var(--ac-accent))' }}
                  >
                    {pedido.cliente.email.trim()}
                  </a>
                }
              />
            ) : null}
            {(() => {
              const t = textoEnderecoCliente(pedido.cliente)
              if (!t) return null
              return (
                <DetailMeta
                  label="Endereço"
                  value={<span className="whitespace-pre-wrap">{t}</span>}
                />
              )
            })()}
          </div>
        )}

        {/* Tabela de itens */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
                <th className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Faca</th>
                <th className="text-center px-3 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Qtd</th>
                <th className="text-right px-3 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Preço</th>
                <th className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {(!pedido.itens || pedido.itens.length === 0) && (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-sm" style={{ color: 'var(--ac-muted)' }}>
                    Nenhum item.
                  </td>
                </tr>
              )}
              {pedido.itens?.map((item, i) => (
                <tr key={item.id}
                  style={{ borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined, background: 'var(--ac-card)' }}>
                  <td className="px-4 py-2.5" style={{ color: 'var(--ac-text)' }}>
                    {(() => {
                      const thumbUrl = getOptimizedSupabaseImageUrl(item.faca?.foto_url, {
                        width: 36,
                        height: 36,
                        quality: 60,
                        resize: 'cover',
                        fallbackUrl: '',
                      })

                      return (
                        <div className="flex items-start gap-3 min-w-0">
                          {thumbUrl ? (
                            <img
                              src={thumbUrl}
                              alt={`Foto de ${item.faca?.nome ?? 'faca'}`}
                              width={36}
                              height={36}
                              loading="lazy"
                              className="shrink-0"
                              style={{ borderRadius: 8, objectFit: 'cover', border: '1px solid var(--ac-border)' }}
                            />
                          ) : (
                            <div
                              aria-label={`Sem foto para ${item.faca?.nome ?? 'faca'}`}
                              className="shrink-0"
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                background: '#facc15',
                                border: '1px solid var(--ac-border)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <img
                                src="/images/favicon-yellow.png"
                                alt="Sem foto"
                                width={18}
                                height={18}
                                style={{ objectFit: 'contain' }}
                              />
                            </div>
                          )}

                          <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs shrink-0" style={{ color: 'var(--ac-muted)' }}>
                                {item.faca?.codigo}
                              </span>
                              <span className="text-sm">{item.faca?.nome ?? '—'}</span>
                            </div>
                            {(item.ncm?.trim() || item.cfop?.trim()) ? (
                              <div className="text-[11px] font-mono" style={{ color: 'var(--ac-muted)' }}>
                                {[item.ncm?.trim() ? `NCM ${item.ncm.trim()}` : null,
                                  item.cfop?.trim() ? `CFOP ${item.cfop.trim()}` : null].filter(Boolean).join(' · ')}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums font-semibold" style={{ color: 'var(--ac-text)' }}>
                    {item.quantidade}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums" style={{ color: 'var(--ac-muted)' }}>
                    {item.preco_unitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: 'var(--ac-text)' }}>
                    {item.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                </tr>
              ))}
            </tbody>
            {(frete > 0 || descontoTotal > 0) && (
              <tfoot>
                {frete > 0 && (
                  <tr style={{ borderTop: '1px solid var(--ac-border)' }}>
                    <td colSpan={3} className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                      Frete
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: 'var(--ac-text)' }}>
                      {frete.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                  </tr>
                )}
                {descontoTotal > 0 && (
                  <tr style={{ borderTop: frete > 0 ? undefined : '1px solid var(--ac-border)' }}>
                    <td colSpan={3} className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                      Desconto no total
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold" style={{ color: '#b45309' }}>
                      −{descontoTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                  </tr>
                )}
              </tfoot>
            )}
          </table>
        </div>

        {/* Erro */}
        {erro && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>{erro}</p>
        )}

        {/* Ações de status */}
        {perm.editar && (
          <div className="flex items-center justify-between gap-2 pt-1 flex-wrap" style={{ borderTop: '1px solid var(--ac-border)' }}>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                loading={loadingPdf}
                onClick={() => void exportarVendaSemValor()}
              >
                Venda sem valor
              </Button>
            </div>

            {/* Avançar status (direita) */}
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose}>Fechar</Button>
              {pedido.status === 'em_espera' && (
                <Button
                  loading={loading === 'producao'}
                  onClick={() => acao(
                    () => avancarStatus(pedido.id, 'em_producao'),
                    'producao',
                    'em_producao',
                  )}
                  style={{ background: '#b45309', color: '#fff', border: 'none' }}
                >
                  Iniciar produção
                </Button>
              )}
              {pedido.status === 'em_producao' && (
                <Button
                  loading={loading === 'entregar'}
                  onClick={() => acao(
                    () => marcarEntregue(pedido.id),
                    'entregar',
                    'entregue',
                    new Date().toISOString(),
                  )}
                  style={{ background: '#15803d', color: '#fff', border: 'none' }}
                >
                  Marcar como entregue
                </Button>
              )}
            </div>
          </div>
        )}

        {!perm.editar && (
          <div className="flex items-center justify-between gap-2 pt-1 flex-wrap" style={{ borderTop: '1px solid var(--ac-border)' }}>
            <Button
              variant="secondary"
              loading={loadingPdf}
              onClick={() => void exportarVendaSemValor()}
            >
              Venda sem valor
            </Button>
            <Button variant="secondary" onClick={onClose}>Fechar</Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
