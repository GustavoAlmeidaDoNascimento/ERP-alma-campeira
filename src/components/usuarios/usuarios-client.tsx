'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { UsuarioModal } from './usuario-modal'
import { deletarUsuario } from '@/lib/actions/usuarios'
import type { Usuario, Cargo } from '@/types'
import { useErpTabs } from '@/components/layout/erp-tabs'

// Badge de cargo ou "Personalizado"
function CargoBadge({ usuario }: { usuario: Usuario }) {
  if (usuario.permissoes_customizadas) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold"
        style={{ color: '#b45309', background: '#fef9c3', border: '1px solid #fde047' }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-3">
          <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
        Personalizado
      </span>
    )
  }
  if (usuario.cargo) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-semibold"
        style={{
          color: usuario.cargo.cor,
          background: `${usuario.cargo.cor}18`,
          border: `1px solid ${usuario.cargo.cor}44`,
        }}>
        <span className="size-1.5 rounded-full" style={{ background: usuario.cargo.cor }} />
        {usuario.cargo.nome}
      </span>
    )
  }
  return <span className="text-xs" style={{ color: 'var(--ac-muted)' }}>Sem cargo</span>
}

function getInitials(nome: string, email: string) {
  const base = nome || email.split('@')[0]
  const parts = base.split(/[\s._-]/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return base.slice(0, 2).toUpperCase()
}

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }

type Props = {
  usuarios: Usuario[]
  cargos: Cargo[]  // completo — passa permissões para o modal
  perm: Perm
}

export function UsuariosClient({ usuarios, cargos, perm }: Props) {
  const { refreshActiveTab } = useErpTabs()
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [deletando, setDeletando] = useState<Usuario | null>(null)
  const [erroDelete, setErroDelete] = useState('')
  const [loadingDelete, setLoadingDelete] = useState(false)

  const cargosSimples = cargos.map((c) => ({ id: c.id, nome: c.nome, cor: c.cor, permissoes: c.permissoes }))

  function abrirNovo() { setEditando(null); setModalAberto(true) }
  function abrirEditar(u: Usuario) { setEditando(u); setModalAberto(true) }

  async function confirmarDelete() {
    if (!deletando) return
    setErroDelete('')
    setLoadingDelete(true)
    try {
      await deletarUsuario(deletando.id)
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
          <h2 className="text-2xl font-bold" style={{ color: 'var(--ac-text)' }}>Usuários</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--ac-muted)' }}>
            {usuarios.length} {usuarios.length === 1 ? 'usuário cadastrado' : 'usuários cadastrados'}
          </p>
        </div>
        {perm.criar && (
          <Button onClick={abrirNovo}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="size-4">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Novo usuário
          </Button>
        )}
      </div>

      {/* Tabela */}
      <div className="px-8 py-5">
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--ac-border)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: 'var(--ac-bg)', borderBottom: '1px solid var(--ac-border)' }}>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Usuário</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>E-mail</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Cargo</th>
                <th className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Status</th>
                <th className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide" style={{ color: 'var(--ac-muted)' }}>Criado em</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-sm" style={{ color: 'var(--ac-muted)' }}>
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
              {usuarios.map((u, i) => (
                <tr key={u.id}
                  style={{ borderTop: i > 0 ? '1px solid var(--ac-border)' : undefined, background: 'var(--ac-card)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--ac-bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--ac-card)')}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="size-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: u.cargo?.cor ?? 'var(--ac-border)', color: u.cargo?.cor ? '#fff' : 'var(--ac-muted)' }}>
                        {getInitials(u.nome, u.email)}
                      </div>
                      <span className="font-medium" style={{ color: 'var(--ac-text)' }}>{u.nome || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--ac-muted)' }}>{u.email}</td>
                  <td className="px-4 py-3">
                    <CargoBadge usuario={u} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {u.ativo ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                        style={{ color: '#16a34a', background: '#dcfce7', border: '1px solid #bbf7d0' }}>Ativo</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                        style={{ color: '#6b7280', background: '#f3f4f6', border: '1px solid #e5e7eb' }}>Inativo</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: 'var(--ac-muted)' }}>
                    {new Date(u.created_at).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {perm.editar && (
                        <button onClick={() => abrirEditar(u)} className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--ac-muted)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--ac-border)'; e.currentTarget.style.color = 'var(--ac-text)' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ac-muted)' }}
                          title="Editar">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      )}
                      {perm.deletar && (
                        <button onClick={() => { setDeletando(u); setErroDelete('') }} className="p-1.5 rounded-lg transition-colors"
                          style={{ color: 'var(--ac-muted)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#fee2e2'; e.currentTarget.style.color = '#dc2626' }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--ac-muted)' }}
                          title="Excluir">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="size-4">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
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

      <UsuarioModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        editando={editando}
        cargos={cargosSimples}
        onSaved={refreshActiveTab}
      />

      <Modal open={!!deletando} onClose={() => setDeletando(null)} title="Excluir usuário">
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: 'var(--ac-text)' }}>
            Tem certeza que deseja excluir <strong>{deletando?.email}</strong>? O usuário perderá acesso imediatamente.
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
