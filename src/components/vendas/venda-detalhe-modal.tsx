'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { avancarStatus, marcarEntregue } from '@/lib/actions/vendas'
import { STATUS_PEDIDO } from '@/types'
import type { Pedido, StatusPedido } from '@/types'
import { getOptimizedSupabaseImageUrl } from '@/lib/supabase/optimized-image'

type Props = {
  pedido: Pedido | null
  onClose: () => void
  onStatusChange?: (id: string, novoStatus: StatusPedido, entregue_at?: string) => void
  perm: { editar: boolean }
}

export function VendaDetalheModal({ pedido, onClose, onStatusChange, perm }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const [erro, setErro] = useState('')

  if (!pedido) return null

  const status = STATUS_PEDIDO[pedido.status]
  const pedidoId = pedido.id

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

  const total = pedido.itens?.reduce((s, i) => s + i.subtotal, 0) ?? pedido.valor_total ?? 0

  return (
    <Modal
      open={!!pedido}
      onClose={onClose}
      title={`Venda ${pedido.codigo}`}
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
            <p className="text-xs" style={{ color: 'var(--ac-muted)' }}>
              Data: {new Date(pedido.data_pedido + 'T12:00:00').toLocaleDateString('pt-BR')}
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
                        <div className="flex items-center gap-3">
                          {thumbUrl ? (
                            <img
                              src={thumbUrl}
                              alt={`Foto de ${item.faca?.nome ?? 'faca'}`}
                              width={36}
                              height={36}
                              loading="lazy"
                              style={{ borderRadius: 8, objectFit: 'cover', border: '1px solid var(--ac-border)' }}
                            />
                          ) : (
                            <div
                              aria-label={`Sem foto para ${item.faca?.nome ?? 'faca'}`}
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

                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs" style={{ color: 'var(--ac-muted)' }}>
                              {item.faca?.codigo}
                            </span>
                            <span className="text-sm">{item.faca?.nome ?? '—'}</span>
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
          </table>
        </div>

        {/* Erro */}
        {erro && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>{erro}</p>
        )}

        {/* Ações de status */}
        {perm.editar && (
          <div className="flex items-center justify-between gap-2 pt-1" style={{ borderTop: '1px solid var(--ac-border)' }}>
            <div />

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
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onClose}>Fechar</Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
