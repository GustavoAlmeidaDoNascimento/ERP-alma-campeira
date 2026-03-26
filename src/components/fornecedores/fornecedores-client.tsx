'use client'

import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { FornecedorModal } from './fornecedor-modal'
import { deletarFornecedor } from '@/lib/actions/fornecedores'
import type { Fornecedor } from '@/types'
import { useErpTabs } from '@/components/layout/erp-tabs'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }

export function FornecedoresClient({ fornecedores, perm }: { fornecedores: Fornecedor[]; perm: Perm }) {
  const { refreshActiveTab } = useErpTabs()
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Fornecedor | null>(null)
  const [deletando, setDeletando] = useState<Fornecedor | null>(null)
  const [erroDelete, setErroDelete] = useState('')
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [busca, setBusca] = useState('')

  const filtrados = useMemo(() => {
    if (!busca.trim()) return fornecedores
    const q = busca.toLowerCase()
    return fornecedores.filter(
      (f) => f.nome.toLowerCase().includes(q) || f.telefone?.toLowerCase().includes(q) || f.email?.toLowerCase().includes(q)
    )
  }, [fornecedores, busca])

  function abrirNovo() { setEditando(null); setModalAberto(true) }
  function abrirEditar(f: Fornecedor) { setEditando(f); setModalAberto(true) }

  async function confirmarDelete() {
    if (!deletando) return
    setErroDelete('')
    setLoadingDelete(true)
    try {
      await deletarFornecedor(deletando.id)
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
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ac-text)' }}>Fornecedores</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ac-muted)' }}>
            {fornecedores.length} {fornecedores.length === 1 ? 'fornecedor cadastrado' : 'fornecedores cadastrados'}
          </p>
        </div>
        {perm.criar && (
          <Button onClick={abrirNovo}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-4">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Novo fornecedor
          </Button>
        )}
      </div>

      {/* Busca */}
      <div className="px-8 py-4">
        <div className="relative max-w-sm">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
            className="absolute left-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none"
            style={{ color: 'var(--ac-muted)' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input type="text" placeholder="Buscar por nome, telefone ou e-mail..."
            value={busca} onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm outline-none transition-all"
            style={{ background: 'var(--ac-card)', border: '1px solid var(--ac-border)', color: 'var(--ac-text)' }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ac-accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px color-mix(in srgb, var(--ac-accent) 20%, transparent)' }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ac-border)'; e.currentTarget.style.boxShadow = 'none' }}
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="px-8 pb-8">
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Nome</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Telefone</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>E-mail</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Cadastrado em</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-sm" style={{ color: 'var(--ac-muted)' }}>
                    {busca ? 'Nenhum resultado para essa busca.' : 'Nenhum fornecedor cadastrado ainda.'}
                  </td>
                </tr>
              )}
              {filtrados.map((f, i) => (
                <tr key={f.id}
                  style={{ borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined, background: 'var(--ac-card)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ac-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ac-card)')}
                >
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--ac-text)' }}>{f.nome}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--ac-muted)' }}>{f.telefone ?? '—'}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--ac-muted)' }}>{f.email ?? '—'}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--ac-muted)' }}>
                    {new Date(f.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {perm.editar && (
                        <button onClick={() => abrirEditar(f)} className="p-1.5 rounded-lg transition-colors"
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
                        <button onClick={() => { setDeletando(f); setErroDelete('') }} className="p-1.5 rounded-lg transition-colors"
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <FornecedorModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        editando={editando}
        onSaved={refreshActiveTab}
      />

      <Modal open={!!deletando} onClose={() => setDeletando(null)} title="Excluir fornecedor">
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--ac-text)' }}>
            Tem certeza que deseja excluir <strong>{deletando?.nome}</strong>? Esta ação não pode ser desfeita.
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
