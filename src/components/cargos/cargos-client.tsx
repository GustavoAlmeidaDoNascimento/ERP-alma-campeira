'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { CargoModal } from './cargo-modal'
import { PermissoesGrid } from './permissoes-grid'
import { deletarCargo } from '@/lib/actions/cargos'
import { permissoesFromArray } from '@/lib/permissoes'
import { MODULOS } from '@/types'
import type { Cargo } from '@/types'
import { useErpTabs } from '@/components/layout/erp-tabs'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }

export function CargosClient({ cargos, perm }: { cargos: Cargo[]; perm: Perm }) {
  const { refreshActiveTab } = useErpTabs()
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Cargo | null>(null)
  const [visualizando, setVisualizando] = useState<Cargo | null>(null)
  const [deletando, setDeletando] = useState<Cargo | null>(null)
  const [erroDelete, setErroDelete] = useState('')
  const [loadingDelete, setLoadingDelete] = useState(false)

  function abrirNovo() { setEditando(null); setModalAberto(true) }
  function abrirEditar(c: Cargo) { setEditando(c); setModalAberto(true) }

  async function confirmarDelete() {
    if (!deletando) return
    setErroDelete('')
    setLoadingDelete(true)
    try {
      await deletarCargo(deletando.id)
      setDeletando(null)
      refreshActiveTab()
    } catch (e: unknown) {
      setErroDelete(e instanceof Error ? e.message : 'Erro ao excluir.')
    } finally {
      setLoadingDelete(false)
    }
  }

  // Resumo de permissões ativas por cargo (contagem de módulos)
  function resumoPerm(cargo: Cargo) {
    const total = MODULOS.length
    const ativos = cargo.permissoes.filter((p) => p.ver).length
    return { ativos, total }
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-6" style={{ borderBottom: '1px solid var(--ac-border)' }}>
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ac-text)' }}>Cargos</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ac-muted)' }}>
            Configure os cargos e suas permissões, depois delegue aos usuários
          </p>
        </div>
        {perm.criar && (
          <Button onClick={abrirNovo}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-4">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Novo cargo
          </Button>
        )}
      </div>

      {/* Grid de cards */}
      <div className="px-8 py-6">
        {cargos.length === 0 && (
          <div className="text-center py-16 text-sm" style={{ color: 'var(--ac-muted)' }}>
            Nenhum cargo cadastrado ainda.
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {cargos.map((cargo) => {
            const { ativos, total } = resumoPerm(cargo)
            const pct = Math.round((ativos / total) * 100)
            return (
              <div
                key={cargo.id}
                className="rounded-xl p-5 flex flex-col gap-4"
                style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)' }}
              >
                {/* Topo */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${cargo.cor}22`, border: `1.5px solid ${cargo.cor}44` }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke={cargo.cor} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="size-5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm" style={{ color: 'var(--ac-text)' }}>{cargo.nome}</h3>
                        <span className="size-2 rounded-full flex-shrink-0" style={{ background: cargo.cor }} />
                      </div>
                      {cargo.descricao && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--ac-muted)' }}>{cargo.descricao}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setVisualizando(cargo)} className="p-1.5 rounded-lg transition-colors"
                      style={{ color: 'var(--ac-muted)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ac-border)'; e.currentTarget.style.color = 'var(--ac-text)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ac-muted)' }}
                      title="Ver permissões"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    {perm.editar && (
                      <button onClick={() => abrirEditar(cargo)} className="p-1.5 rounded-lg transition-colors"
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
                      <button onClick={() => { setDeletando(cargo); setErroDelete('') }} className="p-1.5 rounded-lg transition-colors"
                        style={{ color: 'var(--ac-muted)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626' }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ac-muted)' }}
                        title="Excluir"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                          <path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {/* Acesso a módulos - barra de progresso */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: 'var(--ac-muted)' }}>
                      Acesso a {ativos} de {total} módulos
                    </span>
                    <span className="text-xs font-semibold" style={{ color: cargo.cor }}>{pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--ac-border)' }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cargo.cor }} />
                  </div>
                </div>

                {/* Mini matrix de módulos */}
                <div className="flex flex-wrap gap-1.5">
                  {MODULOS.map((m) => {
                    const p = cargo.permissoes.find((x) => x.modulo === m.key)
                    const on = p?.ver ?? false
                    return (
                      <span key={m.key} className="text-[11px] px-2 py-0.5 rounded font-medium"
                        style={{
                          color: on ? cargo.cor : 'var(--ac-muted)',
                          background: on ? `${cargo.cor}18` : 'var(--ac-bg)',
                          border: `1px solid ${on ? `${cargo.cor}44` : 'var(--ac-border)'}`,
                          opacity: on ? 1 : 0.5,
                        }}
                      >
                        {m.label}
                      </span>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal criar/editar */}
      <CargoModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        editando={editando}
        onSaved={refreshActiveTab}
      />

      {/* Modal visualizar permissões */}
      {visualizando && (
        <Modal open={!!visualizando} onClose={() => setVisualizando(null)} title={`Permissões — ${visualizando.nome}`} width="680px">
          <PermissoesGrid value={permissoesFromArray(visualizando.permissoes)} onChange={() => {}} readonly />
          <div className="flex justify-end mt-4">
            <Button variant="secondary" onClick={() => setVisualizando(null)}>Fechar</Button>
          </div>
        </Modal>
      )}

      {/* Modal delete */}
      <Modal open={!!deletando} onClose={() => setDeletando(null)} title="Excluir cargo">
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--ac-text)' }}>
            Tem certeza que deseja excluir o cargo <strong>{deletando?.nome}</strong>?
            Os usuários com esse cargo ficarão sem cargo atribuído.
          </p>
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
