'use client'

import { useState, useTransition } from 'react'
import { corrigirDivergenciaVenda, getConciliacao, type ResultadoConciliacao } from '@/lib/actions/conciliacao'

type Props = {
  data: ResultadoConciliacao
}

function fmt(n: number) {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{
        color: ok ? '#15803d' : '#dc2626',
        background: ok ? '#dcfce7' : '#fee2e2',
        border: `1px solid ${ok ? '#bbf7d0' : '#fecaca'}`,
      }}
    >
      {ok ? (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-3">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      )}
      {ok ? 'OK' : 'Divergência'}
    </span>
  )
}

function SectionHeader({ title, ok, count }: { title: string; ok: boolean; count: number }) {
  return (
    <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--ac-border)' }}>
      <h3 className="text-sm font-semibold" style={{ color: 'var(--ac-text)' }}>{title}</h3>
      <div className="flex items-center gap-2">
        {count > 0 && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ color: '#dc2626', background: '#fee2e2' }}>
            {count} problema{count !== 1 ? 's' : ''}
          </span>
        )}
        <StatusBadge ok={ok} />
      </div>
    </div>
  )
}

export function ConciliacaoMetricsView({ data: initialData }: Props) {
  const [data, setData] = useState(initialData)
  const [isPending, startTransition] = useTransition()
  const [corrigindoKey, setCorrigindoKey] = useState<string | null>(null)
  const [erroCorrecao, setErroCorrecao] = useState('')

  function refresh() {
    startTransition(async () => {
      const fresh = await getConciliacao()
      setData(fresh)
    })
  }

  function corrigirVenda(venda: { pedidoId: string; facaId: string }) {
    const key = `${venda.pedidoId}-${venda.facaId}`
    setErroCorrecao('')
    setCorrigindoKey(key)
    startTransition(async () => {
      try {
        await corrigirDivergenciaVenda(venda.pedidoId, venda.facaId)
        const fresh = await getConciliacao()
        setData(fresh)
      } catch (e) {
        setErroCorrecao(e instanceof Error ? e.message : 'Erro ao corrigir divergência.')
      } finally {
        setCorrigindoKey(null)
      }
    })
  }

  const facasDivergentes = data.facas.filter((f) => f.nivel === 'divergencia')
  const producaoDivergente = data.producao.filter((p) => p.nivel === 'divergencia')

  return (
    <div className="space-y-6">
      {/* Banner principal */}
      <div
        className="rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        style={{
          border: `1.5px solid ${data.tudoOk ? '#bbf7d0' : '#fca5a5'}`,
          background: data.tudoOk
            ? 'linear-gradient(135deg, #f0fdf4, #dcfce7)'
            : 'linear-gradient(135deg, #fff5f5, #fee2e2)',
        }}
      >
        <div className="flex items-start gap-4">
          <div
            className="flex items-center justify-center rounded-full size-12 flex-shrink-0"
            style={{
              background: data.tudoOk ? '#15803d' : '#dc2626',
              color: '#fff',
            }}
          >
            {data.tudoOk ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-6">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-6">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            )}
          </div>
          <div>
            <p className="text-base font-bold" style={{ color: data.tudoOk ? '#15803d' : '#dc2626' }}>
              {data.tudoOk
                ? 'Tudo em ordem — balanço confirmado'
                : `${data.totalDivergencias} divergência${data.totalDivergencias !== 1 ? 's' : ''} encontrada${data.totalDivergencias !== 1 ? 's' : ''}`}
            </p>
            <p className="text-xs mt-0.5" style={{ color: data.tudoOk ? '#15803d' : '#b91c1c' }}>
              {data.tudoOk
                ? 'Matérias-primas, produção e vendas estão conciliados.'
                : 'Verifique os itens marcados abaixo. Pode indicar extravios ou registros incorretos.'}
            </p>
            <p className="text-xs mt-1" style={{ color: '#9ca3af' }}>
              Verificado em {fmtDate(data.geradoEm)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0 disabled:opacity-60"
          style={{
            background: 'var(--ac-card)',
            border: '1px solid var(--ac-border)',
            color: 'var(--ac-text)',
          }}
        >
          <svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-4"
            style={{ animation: isPending ? 'spin 1s linear infinite' : 'none' }}
          >
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          {isPending ? 'Verificando...' : 'Verificar agora'}
        </button>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          {
            label: 'Estoque de Facas',
            count: data.resumo.facasDivergentes,
            total: data.facas.length,
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-5">
                <path d="M3 22 L7 18" /><path d="M6 14 L10 18" /><path d="M8 16 L20 4" />
                <path d="M9 17 C12 14 17 9 20 4 L21 5" />
              </svg>
            ),
          },
          {
            label: 'Consumo de MP',
            count: data.resumo.producaoDivergente,
            total: data.producao.length,
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-5">
                <path d="M4 8h16" /><path d="M6 8V6.8a1.8 1.8 0 0 1 1.8-1.8h8.4A1.8 1.8 0 0 1 18 6.8V8" />
                <rect x="5" y="8" width="14" height="11" rx="2" />
                <path d="M9 12h6" /><path d="M9 15h4" />
              </svg>
            ),
          },
          {
            label: 'Conciliação de Vendas',
            count: data.resumo.vendasDivergentes,
            total: data.vendas.length + (data.resumo.vendasDivergentes > 0 ? 0 : 0),
            icon: (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-5">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
            ),
          },
        ].map((card) => {
          const ok = card.count === 0
          return (
            <div
              key={card.label}
              className="rounded-xl p-4 flex items-center gap-3"
              style={{
                border: `1px solid ${ok ? 'var(--ac-border)' : '#fca5a5'}`,
                background: ok ? 'var(--ac-card)' : '#fff5f5',
              }}
            >
              <div
                className="flex items-center justify-center size-10 rounded-lg flex-shrink-0"
                style={{
                  background: ok
                    ? 'color-mix(in srgb, var(--ac-accent) 12%, transparent)'
                    : '#fee2e2',
                  color: ok ? 'var(--ac-accent)' : '#dc2626',
                }}
              >
                {card.icon}
              </div>
              <div>
                <p className="text-xs font-medium" style={{ color: 'var(--ac-muted)' }}>{card.label}</p>
                <p className="text-lg font-bold" style={{ color: ok ? 'var(--ac-text)' : '#dc2626' }}>
                  {ok ? 'OK' : `${card.count} problema${card.count !== 1 ? 's' : ''}`}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── 1. Estoque de facas ──────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
        <SectionHeader
          title="Integridade de Estoque — Facas"
          ok={data.resumo.facasDivergentes === 0}
          count={data.resumo.facasDivergentes}
        />

        {facasDivergentes.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--ac-muted)' }}>
            Todas as facas com movimentações apresentam estoque consistente.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
                  {['Faca', 'Produzido', 'Vendido', 'Saldo Mov.', 'Estoque Atual', 'Diferença', 'Detalhe'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {facasDivergentes.map((f, i) => (
                  <tr key={f.facaId} style={{ borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined, background: '#fff5f5' }}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs" style={{ color: 'var(--ac-muted)' }}>{f.facaCodigo}</span>
                      <span className="ml-2 font-medium" style={{ color: 'var(--ac-text)' }}>{f.facaNome}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--ac-text)' }}>{fmt(f.totalProduzido)}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--ac-text)' }}>{fmt(f.totalVendido)}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: 'var(--ac-text)' }}>{fmt(f.saldoMovimentos)}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: 'var(--ac-text)' }}>{fmt(f.estoqueAtual)}</td>
                    <td className="px-4 py-3 tabular-nums font-bold" style={{ color: '#dc2626' }}>
                      {fmt(f.divergencia)}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-xs" style={{ color: '#b91c1c' }}>{f.detalhe}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 2. Consumo de MP ──────────────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
        <SectionHeader
          title="Consumo de Matéria-Prima vs Produção"
          ok={data.resumo.producaoDivergente === 0}
          count={data.resumo.producaoDivergente}
        />

        {producaoDivergente.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--ac-muted)' }}>
            {data.producao.length === 0
              ? 'Nenhuma produção registrada para verificar.'
              : 'Consumo de matéria-prima consistente com o BOM de todas as facas produzidas.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
                  {['Faca', 'Matéria-Prima', 'Produzido', 'Consumo Esperado', 'Consumo Registrado', 'Diferença', 'Detalhe'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {producaoDivergente.map((p, i) => (
                  <tr key={`${p.facaId}-${p.mpId}`} style={{ borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined, background: '#fff5f5' }}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs" style={{ color: 'var(--ac-muted)' }}>{p.facaCodigo}</span>
                      <span className="ml-2 font-medium" style={{ color: 'var(--ac-text)' }}>{p.facaNome}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs" style={{ color: 'var(--ac-muted)' }}>{p.mpCodigo}</span>
                      <span className="ml-2 font-medium" style={{ color: 'var(--ac-text)' }}>{p.mpNome}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--ac-text)' }}>{fmt(p.totalProduzidoFaca)}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--ac-text)' }}>{fmt(p.consumoEsperado)}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: 'var(--ac-text)' }}>{fmt(p.consumoRegistrado)}</td>
                    <td className="px-4 py-3 tabular-nums font-bold" style={{ color: p.divergencia < 0 ? '#dc2626' : '#b45309' }}>
                      {p.divergencia > 0 ? '+' : ''}{fmt(p.divergencia)}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-xs" style={{ color: p.divergencia < 0 ? '#b91c1c' : '#92400e' }}>{p.detalhe}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── 3. Conciliação de vendas ──────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
        <SectionHeader
          title="Conciliação de Vendas Entregues"
          ok={data.resumo.vendasDivergentes === 0}
          count={data.resumo.vendasDivergentes}
        />

        {data.vendas.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm" style={{ color: 'var(--ac-muted)' }}>
            Todas as vendas entregues possuem movimentações de saída correspondentes.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
                  {['Pedido', 'Faca', 'Qtd. Pedido', 'Qtd. Movimento', 'Diferença', 'Detalhe', 'Ação'].map((h) => (
                    <th key={h} className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.vendas.map((v, i) => (
                  <tr key={`${v.pedidoId}-${v.facaId}`} style={{ borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined, background: '#fff5f5' }}>
                    <td className="px-4 py-3 font-mono text-xs font-medium" style={{ color: 'var(--ac-muted)' }}>
                      {v.pedidoCodigo}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs" style={{ color: 'var(--ac-muted)' }}>{v.facaCodigo}</span>
                      <span className="ml-2 font-medium" style={{ color: 'var(--ac-text)' }}>{v.facaNome}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--ac-text)' }}>{fmt(v.quantidadePedido)}</td>
                    <td className="px-4 py-3 tabular-nums font-semibold" style={{ color: 'var(--ac-text)' }}>{fmt(v.quantidadeMovimento)}</td>
                    <td className="px-4 py-3 tabular-nums font-bold" style={{ color: '#dc2626' }}>
                      {v.divergencia > 0 ? '+' : ''}{fmt(v.divergencia)}
                    </td>
                    <td className="px-4 py-3 text-xs max-w-xs" style={{ color: '#b91c1c' }}>{v.detalhe}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => corrigirVenda(v)}
                        disabled={isPending || corrigindoKey === `${v.pedidoId}-${v.facaId}`}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60"
                        style={{
                          color: '#065f46',
                          background: '#d1fae5',
                          border: '1px solid #6ee7b7',
                        }}
                      >
                        {corrigindoKey === `${v.pedidoId}-${v.facaId}` ? 'Corrigindo...' : 'Corrigir'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {erroCorrecao && (
          <div className="px-4 py-3 text-sm" style={{ color: '#b91c1c', borderTop: '1px solid var(--ac-border)', background: '#fff5f5' }}>
            {erroCorrecao}
          </div>
        )}
      </div>

      {/* Nota explicativa */}
      <div
        className="rounded-xl px-4 py-3 text-xs space-y-1"
        style={{ border: '1px solid var(--ac-border)', background: 'var(--ac-card)', color: 'var(--ac-muted)' }}
      >
        <p className="font-semibold" style={{ color: 'var(--ac-text)' }}>Como interpretar</p>
        <p><strong>Estoque de Facas:</strong> verifica se estoque atual bate com produção registrada menos vendas. Diferença negativa indica unidades que saíram sem registro — possível extravio.</p>
        <p><strong>Consumo de MP:</strong> verifica se cada faca produzida consumiu exatamente o que a ficha tecnica especifica. Diferença negativa indica MP que sumiu antes ou depois da produção.</p>
        <p><strong>Vendas:</strong> verifica se todo pedido entregue gerou movimentação de saída no estoque. Diferença indica entrega sem baixa no sistema.</p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
