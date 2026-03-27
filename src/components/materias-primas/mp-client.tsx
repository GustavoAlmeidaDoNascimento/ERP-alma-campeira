'use client'

import { useState, useMemo } from 'react'
import { BadgeEstoque } from '@/components/ui/badge-estoque'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { MPModal } from './mp-modal'
import { deletarMateriaPrima } from '@/lib/actions/materias-primas'
import { statusEstoque } from '@/types'
import type { MateriaPrima, Fornecedor } from '@/types'
import { useErpTabs } from '@/components/layout/erp-tabs'
import { getOptimizedSupabaseImageUrl } from '@/lib/supabase/optimized-image'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }

type Props = {
  materiasPrimas: MateriaPrima[]
  fornecedores: Fornecedor[]
  perm: Perm
}

export function MPClient({ materiasPrimas, fornecedores, perm }: Props) {
  const { refreshActiveTab } = useErpTabs()
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<MateriaPrima | null>(null)
  const [deletando, setDeletando] = useState<MateriaPrima | null>(null)
  const [erroDelete, setErroDelete] = useState('')
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [busca, setBusca] = useState('')
  const [fotoLightboxSrc, setFotoLightboxSrc] = useState<string>('')
  const [fotoLightboxAlt, setFotoLightboxAlt] = useState<string>('')

  const filtrados = useMemo(() => {
    if (!busca.trim()) return materiasPrimas
    const q = busca.toLowerCase()
    return materiasPrimas.filter(
      (mp) =>
        mp.nome.toLowerCase().includes(q) ||
        mp.codigo.toLowerCase().includes(q) ||
        mp.fornecedor?.nome?.toLowerCase().includes(q)
    )
  }, [materiasPrimas, busca])

  const fotoUrlByMPId = useMemo(() => {
    const map = new Map<string, string>()
    for (const mp of materiasPrimas) {
      if (!mp.foto_url) continue
      map.set(
        mp.id,
        getOptimizedSupabaseImageUrl(mp.foto_url, {
          width: 64,
          height: 64,
          quality: 65,
        })
      )
    }
    return map
  }, [materiasPrimas])

  function abrirNovo() {
    setEditando(null)
    setModalAberto(true)
  }

  function abrirEditar(mp: MateriaPrima) {
    setEditando(mp)
    setModalAberto(true)
  }

  function abrirFotoLightbox(mp: MateriaPrima, thumbFallback: string) {
    if (!mp.foto_url) return
    const srcGrande = getOptimizedSupabaseImageUrl(mp.foto_url, {
      width: 520,
      height: 520,
      quality: 80,
      resize: 'contain',
    })
    setFotoLightboxSrc(srcGrande || thumbFallback)
    setFotoLightboxAlt(mp.nome)
  }

  async function confirmarDelete() {
    if (!deletando) return
    setErroDelete('')
    setLoadingDelete(true)
    try {
      await deletarMateriaPrima(deletando.id)
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
      {/* Header da página */}
      <div className="flex items-center justify-between px-8 py-6" style={{ borderBottom: '1px solid var(--ac-border)' }}>
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ac-text)' }}>Matérias-Primas</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ac-muted)' }}>
            {materiasPrimas.length} {materiasPrimas.length === 1 ? 'item cadastrado' : 'itens cadastrados'}
          </p>
        </div>
        {perm.criar && (
          <Button onClick={abrirNovo}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-4">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Nova matéria-prima
          </Button>
        )}
      </div>

      {/* Busca */}
      <div className="px-8 py-4">
        <div className="relative max-w-sm">
          <svg
            viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
            className="absolute left-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none"
            style={{ color: 'var(--ac-muted)' }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nome, código ou fornecedor..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm outline-none transition-all"
            style={{
              background: 'var(--ac-card)',
              border: '1px solid var(--ac-border)',
              color: 'var(--ac-text)',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--ac-accent)'
              e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--ac-accent) 20%, transparent)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--ac-border)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="px-8 pb-8">
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)', width: 80 }}>Foto</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Código</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Nome</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Fornecedor</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Preço Custo</th>
                <th className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Estoque / Mín.</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-sm" style={{ color: 'var(--ac-muted)' }}>
                    {busca ? 'Nenhum resultado para essa busca.' : 'Nenhuma matéria-prima cadastrada ainda.'}
                  </td>
                </tr>
              )}
              {filtrados.map((mp, i) => {
                const status = statusEstoque(mp)
                return (
                  <tr
                    key={mp.id}
                    style={{
                      borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined,
                      background: 'var(--ac-card)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ac-bg)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ac-card)')}
                  >
                    <td className="px-4 py-3">
                      {(() => {
                        const thumbUrl = fotoUrlByMPId.get(mp.id)
                        if (thumbUrl) {
                          return (
                            <button
                              type="button"
                              onClick={() => abrirFotoLightbox(mp, thumbUrl)}
                              aria-label={`Expandir foto de ${mp.nome}`}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                padding: 0,
                                cursor: 'zoom-in',
                                display: 'block',
                                borderRadius: 8,
                                overflow: 'hidden',
                              }}
                            >
                              <img
                                src={thumbUrl}
                                alt={mp.nome}
                                width={64}
                                height={64}
                                loading="lazy"
                                style={{
                                  objectFit: 'cover',
                                  borderRadius: 8,
                                  display: 'block',
                                  border: '1px solid var(--ac-border)',
                                }}
                              />
                            </button>
                          )
                        }
                        return (
                          <div
                            aria-label={`Sem foto para ${mp.nome}`}
                            style={{
                              width: 64,
                              height: 64,
                              borderRadius: 8,
                              border: '1px solid var(--ac-border)',
                              background: 'linear-gradient(135deg, rgba(250, 204, 21, 0.18), rgba(250, 204, 21, 0.06))',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <img
                              src="/images/favicon-yellow.png"
                              alt="Sem foto"
                              width={28}
                              height={28}
                              style={{ objectFit: 'contain' }}
                            />
                          </div>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-medium" style={{ color: 'var(--ac-muted)' }}>
                      {mp.codigo}
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--ac-text)' }}>
                      {mp.nome}
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--ac-muted)' }}>
                      {mp.fornecedor?.nome ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--ac-text)' }}>
                      {mp.preco_custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--ac-text)' }}>
                      <span className="font-semibold">{Number(mp.estoque_atual).toLocaleString('pt-BR')}</span>
                      <span className="mx-1 font-normal" style={{ color: 'var(--ac-border)' }}>/</span>
                      <span style={{ color: 'var(--ac-muted)' }}>{Number(mp.estoque_minimo).toLocaleString('pt-BR')}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <BadgeEstoque status={status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {perm.editar && (
                          <button
                            onClick={() => abrirEditar(mp)}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--ac-muted)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'var(--ac-border)'
                              e.currentTarget.style.color = 'var(--ac-text)'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent'
                              e.currentTarget.style.color = 'var(--ac-muted)'
                            }}
                            title="Editar"
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}
                        {perm.deletar && (
                          <button
                            onClick={() => { setDeletando(mp); setErroDelete('') }}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: 'var(--ac-muted)' }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = '#fee2e2'
                              e.currentTarget.style.color = '#dc2626'
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent'
                              e.currentTarget.style.color = 'var(--ac-muted)'
                            }}
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

      {/* Modal CRUD */}
      <MPModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        fornecedores={fornecedores}
        editando={editando}
        onSaved={refreshActiveTab}
      />

      {/* Modal de confirmação de delete */}
      <Modal open={!!deletando} onClose={() => setDeletando(null)} title="Excluir matéria-prima">
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--ac-text)' }}>
            Tem certeza que deseja excluir <strong>{deletando?.nome}</strong>?
            {' '}Esta ação não pode ser desfeita.
          </p>
          {erroDelete && (
            <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>
              {erroDelete}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeletando(null)}>Cancelar</Button>
            <Button variant="danger" loading={loadingDelete} onClick={confirmarDelete}>
              Excluir
            </Button>
          </div>
        </div>
      </Modal>

      {/* Lightbox de foto */}
      <Modal
        open={!!fotoLightboxSrc}
        onClose={() => {
          setFotoLightboxSrc('')
          setFotoLightboxAlt('')
        }}
        title={`Foto — ${fotoLightboxAlt}`}
        width="520px"
      >
        <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--ac-border)', background: 'var(--ac-card)' }}>
          <img
            src={fotoLightboxSrc}
            alt={`Foto de ${fotoLightboxAlt}`}
            style={{ width: '100%', height: 'auto', display: 'block' }}
          />
        </div>
      </Modal>
    </>
  )
}
