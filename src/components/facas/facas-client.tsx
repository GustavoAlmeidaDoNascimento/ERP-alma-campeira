'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { FacaModal } from './faca-modal'
import { deletarFaca, type DeletarFacaModo } from '@/lib/actions/facas'
import { BadgeEstoque } from '@/components/ui/badge-estoque'
import { statusEstoqueFaca } from '@/types'
import type { Faca, CategoriaFacaDB } from '@/types'
import { useErpTabs } from '@/components/layout/erp-tabs'
import { getOptimizedSupabaseImageUrl } from '@/lib/supabase/optimized-image'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }
type Props = { facas: Faca[]; categorias: CategoriaFacaDB[]; perm: Perm }

export function FacasClient({ facas, categorias, perm }: Props) {
  const { refreshActiveTab } = useErpTabs()
  const badgeCategoria = useMemo(() => {
    const map: Record<string, React.CSSProperties> = {}
    for (const cat of categorias) {
      map[cat.nome] = { color: cat.cor_texto, background: cat.cor_fundo, border: `1px solid ${cat.cor_borda}` }
    }
    return map
  }, [categorias])
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Faca | null>(null)
  const [deletando, setDeletando] = useState<Faca | null>(null)
  const [modoDelete, setModoDelete] = useState<DeletarFacaModo>('desmontar')
  const [erroDelete, setErroDelete] = useState('')
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [busca, setBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')

  const filtradas = useMemo(() => {
    return facas.filter((f) => {
      const matchBusca = !busca.trim() ||
        f.nome.toLowerCase().includes(busca.toLowerCase()) ||
        f.codigo.toLowerCase().includes(busca.toLowerCase())
      const matchCategoria = !filtroCategoria || f.categoria === filtroCategoria
      return matchBusca && matchCategoria
    })
  }, [facas, busca, filtroCategoria])

  const categoriasDisponiveis = useMemo(() => [...new Set(facas.map((f) => f.categoria))].sort(), [facas])

  const fotoUrlByFacaId = useMemo(() => {
    const map = new Map<string, string>()
    for (const f of facas) {
      if (!f.foto_url) continue
      map.set(
        f.id,
        getOptimizedSupabaseImageUrl(f.foto_url, {
          width: 64,
          height: 64,
          quality: 65,
          resize: 'cover',
        })
      )
    }
    return map
  }, [facas])

  function abrirNovo() { setEditando(null); setModalAberto(true) }
  function abrirEditar(f: Faca) { setEditando(f); setModalAberto(true) }

  async function confirmarDelete() {
    if (!deletando) return
    setErroDelete('')
    setLoadingDelete(true)
    try {
      await deletarFaca(deletando.id, modoDelete)
      setDeletando(null)
      refreshActiveTab()
    } catch (e: unknown) {
      setErroDelete(e instanceof Error ? e.message : 'Erro ao excluir.')
    } finally {
      setLoadingDelete(false)
    }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6" style={{ borderBottom: '1px solid var(--ac-border)' }}>
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ac-text)' }}>Facas</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ac-muted)' }}>
            {facas.length} {facas.length === 1 ? 'faca no catálogo' : 'facas no catálogo'}
          </p>
        </div>
        {perm.criar && (
          <Button onClick={abrirNovo}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-4">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nova faca
          </Button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 px-8 py-4">
        <div className="relative flex-1 max-w-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
            className="absolute left-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none"
            style={{ color: 'var(--ac-muted)' }}
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nome ou código..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm outline-none transition-all"
            style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)', color: 'var(--ac-text)' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ac-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--ac-accent) 20%, transparent)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ac-border)'; e.currentTarget.style.boxShadow = 'none' }}
          />
        </div>
        <select
          value={filtroCategoria}
          onChange={(e) => setFiltroCategoria(e.target.value)}
          className="py-2.5 px-3 rounded-lg text-sm outline-none transition-all appearance-none"
          style={{
            background: 'var(--ac-card)', border: '1px solid var(--ac-border)', color: 'var(--ac-text)',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%236b7280' stroke-width='2' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '16px', paddingRight: '32px',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ac-accent)' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ac-border)' }}
        >
          <option value="">Todas as categorias</option>
          {categoriasDisponiveis.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Tabela */}
      <div className="px-8 pb-8">
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Foto</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Código</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Nome</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Categoria</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Preço Venda</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Estoque / Mín.</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm" style={{ color: 'var(--ac-muted)' }}>
                    {busca || filtroCategoria ? 'Nenhum resultado para esse filtro.' : 'Nenhuma faca cadastrada ainda.'}
                  </td>
                </tr>
              )}
              {filtradas.map((faca, i) => {
                const catStyle = badgeCategoria[faca.categoria] ?? badgeCategoria['Outro']
                const statusEstoque = statusEstoqueFaca(faca)
                return (
                  <tr
                    key={faca.id}
                    style={{ borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined, background: 'var(--ac-card)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ac-bg)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ac-card)')}
                  >
                    <td className="px-4 py-3">
                      {(() => {
                        const thumbUrl = fotoUrlByFacaId.get(faca.id)
                        if (thumbUrl) {
                          return (
                            <img
                              src={thumbUrl}
                              alt={`Foto de ${faca.nome}`}
                              width={64}
                              height={64}
                              loading="lazy"
                              style={{ borderRadius: '10px', objectFit: 'cover', border: '1px solid var(--ac-border)' }}
                            />
                          )
                        }
                        return (
                          <div
                            aria-label={`Sem foto para ${faca.nome}`}
                            style={{
                              width: 64,
                              height: 64,
                              borderRadius: 10,
                              background: 'linear-gradient(135deg, rgba(250, 204, 21, 0.18), rgba(250, 204, 21, 0.06))',
                              border: '1px solid var(--ac-border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {/* Mostra o logo (monocromático) em amarelo no placeholder */}
                            <div
                              aria-hidden="true"
                              style={{
                                width: 36,
                                height: 36,
                                background: '#facc15',
                                WebkitMaskImage: "url('/images/logo.png')",
                                WebkitMaskRepeat: 'no-repeat',
                                WebkitMaskPosition: 'center',
                                WebkitMaskSize: 'contain',
                                maskImage: "url('/images/logo.png')",
                                maskRepeat: 'no-repeat',
                                maskPosition: 'center',
                                maskSize: 'contain',
                              }}
                            />
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-medium" style={{ color: 'var(--ac-muted)' }}>
                      {faca.codigo}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--ac-text)' }}>
                      {faca.nome}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold" style={catStyle}>
                        {faca.categoria}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold" style={{ color: 'var(--ac-text)' }}>
                      {faca.preco_venda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--ac-text)' }}>
                      <span className="font-semibold">{faca.estoque_atual}</span>
                      <span className="text-xs ml-1" style={{ color: 'var(--ac-muted)' }}>
                        / {faca.estoque_minimo}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <BadgeEstoque status={statusEstoque} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {perm.editar && (
                          <button onClick={() => abrirEditar(faca)} className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--ac-muted)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ac-border)'; e.currentTarget.style.color = 'var(--ac-text)' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ac-muted)' }}
                            title="Editar"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}
                        {perm.deletar && (
                          <button onClick={() => { setDeletando(faca); setModoDelete('desmontar'); setErroDelete('') }} className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--ac-muted)' }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626' }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ac-muted)' }}
                            title="Excluir"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      <FacaModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        editando={editando}
        categorias={categorias}
        onSaved={refreshActiveTab}
      />

      <Modal open={!!deletando} onClose={() => setDeletando(null)} title="Excluir faca">
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--ac-text)' }}>
            Tem certeza que deseja excluir <strong>{deletando?.nome}</strong>? Esta ação não pode ser desfeita.
          </p>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>
              Como tratar as matérias-primas?
            </label>
            <select
              value={modoDelete}
              onChange={(e) => setModoDelete(e.target.value as DeletarFacaModo)}
              className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all appearance-none"
              style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)', color: 'var(--ac-text)' }}
            >
              <option value="apagar_materias_primas">{deletando?.nome}: apagar materias primas também</option>
              <option value="desmontar">desmontar: retornar matérias primas ao estoque</option>
            </select>
          </div>

          {erroDelete && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>{erroDelete}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeletando(null)}>Cancelar</Button>
            <Button variant="danger" loading={loadingDelete} onClick={confirmarDelete}>Excluir</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
