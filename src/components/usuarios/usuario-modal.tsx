'use client'

import { useState, useEffect, useCallback } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PermissoesGrid } from '@/components/cargos/permissoes-grid'
import { criarUsuario, atualizarPerfil, getPermissoesUsuario } from '@/lib/actions/usuarios'
import { permissoesVazias, permissoesFromArray, permissoesIguais } from '@/lib/permissoes'
import type { PermMap } from '@/lib/permissoes'
import type { Usuario, Cargo, ModuloKey } from '@/types'

type Props = {
  open: boolean
  onClose: () => void
  editando?: Usuario | null
  cargos: Pick<Cargo, 'id' | 'nome' | 'cor' | 'permissoes'>[]
  onSaved?: () => void
}

export function UsuarioModal({ open, onClose, editando, cargos, onSaved }: Props) {
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [cargoId, setCargoId] = useState('')
  const [ativo, setAtivo] = useState(true)
  const [permissoes, setPermissoes] = useState<PermMap>(permissoesVazias())
  const [isCustom, setIsCustom] = useState(false)
  const [loadingPerms, setLoadingPerms] = useState(false)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  const getPermsDoCargo = useCallback((id: string): PermMap => {
    const cargo = cargos.find((c) => c.id === id)
    if (!cargo) return permissoesVazias()
    return permissoesFromArray(cargo.permissoes)
  }, [cargos])

  useEffect(() => {
    if (!open) return

    if (editando) {
      setNome(editando.nome)
      setCargoId(editando.cargo_id ?? '')
      setAtivo(editando.ativo)
      setErro('')

      if (editando.permissoes_customizadas) {
        // Carrega as permissões customizadas do servidor
        setLoadingPerms(true)
        getPermissoesUsuario(editando.id).then((perms) => {
          setPermissoes(perms ?? permissoesVazias())
          setIsCustom(true)
          setLoadingPerms(false)
        })
      } else {
        const perms = editando.cargo_id ? getPermsDoCargo(editando.cargo_id) : permissoesVazias()
        setPermissoes(perms)
        setIsCustom(false)
      }
    } else {
      setNome('')
      setEmail('')
      setSenha('')
      const primeiroCargo = cargos[0]?.id ?? ''
      setCargoId(primeiroCargo)
      setAtivo(true)
      setPermissoes(primeiroCargo ? getPermsDoCargo(primeiroCargo) : permissoesVazias())
      setIsCustom(false)
      setErro('')
    }
  }, [editando, open, cargos, getPermsDoCargo])

  function handleCargoChange(novoCargoId: string) {
    setCargoId(novoCargoId)
    // Preenche a matriz com as permissões do novo cargo
    const novasPerms = novoCargoId ? getPermsDoCargo(novoCargoId) : permissoesVazias()
    setPermissoes(novasPerms)
    setIsCustom(false)
  }

  function handlePermissoesChange(novasPerms: PermMap) {
    setPermissoes(novasPerms)
    // Verifica se difere do cargo atual
    if (cargoId) {
      const cargoPerms = getPermsDoCargo(cargoId)
      setIsCustom(!permissoesIguais(novasPerms, cargoPerms))
    } else {
      // Sem cargo: customizado se tiver qualquer permissão
      const vazio = permissoesVazias()
      setIsCustom(!permissoesIguais(novasPerms, vazio))
    }
  }

  function resetarParaCargo() {
    const perms = cargoId ? getPermsDoCargo(cargoId) : permissoesVazias()
    setPermissoes(perms)
    setIsCustom(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    if (!nome.trim()) { setErro('Nome é obrigatório.'); return }
    if (!editando) {
      if (!email.trim()) { setErro('E-mail é obrigatório.'); return }
      if (senha.length < 6) { setErro('Senha deve ter pelo menos 6 caracteres.'); return }
    }

    setLoading(true)
    try {
      if (editando) {
        await atualizarPerfil(editando.id, {
          nome,
          ativo,
          cargo_id: cargoId || null,
          permissoes: isCustom ? permissoes : null,
        })
      } else {
        await criarUsuario({ email, senha, nome, cargo_id: cargoId || null })
      }
      onClose()
      onSaved?.()
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editando ? `Editar — ${editando.email}` : 'Novo Usuário'} width="700px">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Dados básicos */}
        <div className={`grid gap-3 ${editando ? 'grid-cols-1' : 'grid-cols-2'}`}>
          <Input id="nome" label="Nome *" placeholder="Ex: João Silva"
            value={nome} onChange={(e) => setNome(e.target.value)} />
          {!editando && (
            <Input id="email" label="E-mail *" type="email"
              placeholder="joao@almacampeira.com.br"
              value={email} onChange={(e) => setEmail(e.target.value)} />
          )}
        </div>

        {!editando && (
          <Input id="senha" label="Senha inicial *" type="password"
            placeholder="Mínimo 6 caracteres"
            value={senha} onChange={(e) => setSenha(e.target.value)} />
        )}

        {/* Cargo */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>Cargo</label>
          <div className="flex items-center gap-2">
            <select value={cargoId} onChange={(e) => handleCargoChange(e.target.value)}
              className="flex-1 rounded-lg px-3 py-2.5 text-sm outline-none transition-all appearance-none"
              style={{
                background: 'var(--ac-card)', border: '1px solid var(--ac-border)', color: 'var(--ac-text)',
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%236b7280' stroke-width='2' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
                backgroundSize: '16px', paddingRight: '36px',
              }}
              onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--ac-accent)' }}
              onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--ac-border)' }}
            >
              <option value="">— Sem cargo —</option>
              {cargos.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            {isCustom && cargoId && (
              <button type="button" onClick={resetarParaCargo}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0"
                style={{ color: '#b45309', background: '#fef9c3', border: '1px solid #fde047' }}
                title="Redefinir permissões para as do cargo"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-3.5">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
                Redefinir para o cargo
              </button>
            )}
          </div>
          {isCustom && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="size-3.5 flex-shrink-0"
                style={{ color: '#b45309' }}>
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="text-xs" style={{ color: '#b45309' }}>
                Permissões personalizadas — diferem do cargo atribuído
              </span>
            </div>
          )}
        </div>

        {/* Status (só edição) */}
        {editando && (
          <div className="flex items-center gap-3">
            <button type="button" role="switch" aria-checked={ativo}
              onClick={() => setAtivo((v) => !v)}
              className="relative inline-flex h-5 w-9 rounded-full transition-colors flex-shrink-0"
              style={{ background: ativo ? 'var(--ac-accent)' : 'var(--ac-border)' }}
            >
              <span className="inline-block size-4 rounded-full bg-white shadow transition-transform mt-0.5"
                style={{ transform: ativo ? 'translateX(18px)' : 'translateX(2px)' }} />
            </button>
            <span className="text-sm" style={{ color: 'var(--ac-text)' }}>
              {ativo ? 'Usuário ativo' : 'Usuário inativo'}
            </span>
          </div>
        )}

        {/* Matriz de permissões */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium" style={{ color: 'var(--ac-text)' }}>Permissões</label>
            {isCustom && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded"
                style={{ color: '#b45309', background: '#fef9c3', border: '1px solid #fde047' }}>
                Personalizado
              </span>
            )}
            {!isCustom && cargoId && (
              <span className="text-xs" style={{ color: 'var(--ac-muted)' }}>
                Herdado do cargo · edite para personalizar
              </span>
            )}
          </div>
          {loadingPerms ? (
            <div className="h-40 rounded-xl flex items-center justify-center"
              style={{ border: '1px solid var(--ac-border)', background: 'var(--ac-bg)' }}>
              <svg className="animate-spin size-5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : (
            <PermissoesGrid value={permissoes} onChange={handlePermissoesChange} />
          )}
        </div>

        {erro && (
          <p className="text-sm rounded-lg px-3 py-2" style={{ color: '#dc2626', background: '#fee2e2' }}>{erro}</p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>
            {editando ? 'Salvar alterações' : 'Criar usuário'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
