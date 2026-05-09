'use server'

import { revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import type { Usuario, PerfilUsuario } from '@/types'
import type { PermMap } from '@/lib/permissoes'
import { MODULOS } from '@/types'

export async function getUsuariosPerfisList(): Promise<{ id: string; nome: string }[]> {
  await assertPermissao('usuarios', 'ver')
  const supabase = await createClient()
  const { data } = await supabase
    .from('usuarios_perfis')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome')
  return data ?? []
}

export async function getUsuarios(limit = 100): Promise<Usuario[]> {
  await assertPermissao('usuarios', 'ver')
  const supabase = await createClient()

  const admin = createAdminClient()
  const { data: authData, error: authError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: limit,
  })
  if (authError) throw new Error(authError.message)

  const [{ data: perfis }, { data: userPerms }] = await Promise.all([
    supabase.from('usuarios_perfis').select('*, cargo:cargos(id, nome, cor, permissoes:cargo_permissoes(*))'),
    supabase.from('usuario_permissoes').select('usuario_id'),
  ])

  const perfisMap = new Map((perfis ?? []).map((p) => [p.id, p]))
  const customIds = new Set((userPerms ?? []).map((p) => p.usuario_id))

  return authData.users.map((u) => {
    const perfil = perfisMap.get(u.id)
    return {
      id: u.id,
      email: u.email ?? '',
      nome: perfil?.nome ?? u.email?.split('@')[0] ?? '',
      perfil: (perfil?.perfil ?? 'vendas') as PerfilUsuario,
      ativo: perfil?.ativo ?? true,
      cargo_id: perfil?.cargo_id ?? null,
      cargo: perfil?.cargo ?? null,
      permissoes_customizadas: customIds.has(u.id),
      created_at: u.created_at,
    }
  }) as Usuario[]
}

export async function getPermissoesUsuario(userId: string): Promise<PermMap | null> {
  await assertPermissao('usuarios', 'ver')
  const supabase = await createClient()
  const { data } = await supabase
    .from('usuario_permissoes')
    .select('*')
    .eq('usuario_id', userId)

  if (!data || data.length === 0) return null

  const { permissoesVazias } = await import('@/lib/permissoes')
  const base = permissoesVazias()
  for (const p of data) {
    base[p.modulo as keyof PermMap] = { ver: p.ver, criar: p.criar, editar: p.editar, deletar: p.deletar }
  }
  return base
}

export async function criarUsuario({
  email, senha, nome, cargo_id,
}: {
  email: string
  senha: string
  nome: string
  cargo_id: string | null
}) {
  await assertPermissao('usuarios', 'criar')
  const admin = createAdminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
  })
  if (error) throw new Error(error.message)
  if (!data.user) throw new Error('Usuário não criado.')

  const supabase = await createClient()
  const { error: perfilError } = await supabase.from('usuarios_perfis').insert({
    id: data.user.id,
    nome: nome.trim(),
    perfil: 'vendas',
    ativo: true,
    cargo_id: cargo_id || null,
  })
  if (perfilError) throw new Error(perfilError.message)
}

export async function atualizarPerfil(
  id: string,
  {
    nome,
    ativo,
    cargo_id,
    permissoes,
  }: {
    nome: string
    ativo: boolean
    cargo_id: string | null
    permissoes: PermMap | null
  }
) {
  await assertPermissao('usuarios', 'editar')
  const supabase = await createClient()

  const { error } = await supabase
    .from('usuarios_perfis')
    .upsert({ id, nome: nome.trim(), perfil: 'vendas', ativo, cargo_id: cargo_id || null })
  if (error) throw new Error(error.message)

  if (permissoes === null) {
    await supabase.from('usuario_permissoes').delete().eq('usuario_id', id)
  } else {
    const rows = MODULOS.map((m) => ({
      usuario_id: id,
      modulo: m.key,
      ...permissoes[m.key],
    }))
    const { error: permError } = await supabase
      .from('usuario_permissoes')
      .upsert(rows, { onConflict: 'usuario_id,modulo' })
    if (permError) throw new Error(permError.message)
  }

  // Invalida o cache global de permissões (todos os usuários).
  // A tag específica por id não existe no unstable_cache atual; usar a tag global
  // garante que o usuário afetado vai recarregar suas permissões na próxima requisição.
  revalidateTag('user-permissions', 'max')
}

export async function deletarUsuario(id: string) {
  await assertPermissao('usuarios', 'deletar')
  const currentId = await requireAuthenticatedUserId()
  if (id === currentId) {
    throw new Error('Não é possível excluir o próprio usuário.')
  }

  const admin = createAdminClient()

  // Referências em `public` impedem a remoção em auth.users; limpa na ordem correta.
  const { error: pedidosErr } = await admin
    .from('pedidos')
    .update({ vendedor_id: null })
    .eq('vendedor_id', id)
  if (pedidosErr) throw new Error(pedidosErr.message)

  const { error: movErr } = await admin
    .from('movimentacoes_estoque')
    .update({ usuario_id: null })
    .eq('usuario_id', id)
  if (movErr) throw new Error(movErr.message)

  const { error: permErr } = await admin.from('usuario_permissoes').delete().eq('usuario_id', id)
  if (permErr) throw new Error(permErr.message)

  const { error: perfilErr } = await admin.from('usuarios_perfis').delete().eq('id', id)
  if (perfilErr) throw new Error(perfilErr.message)

  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) throw new Error(error.message)

}
