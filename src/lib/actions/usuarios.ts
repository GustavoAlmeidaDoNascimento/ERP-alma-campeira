'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { updateTag } from 'next/cache'
import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient, withSupabaseCookieContext } from '@/lib/supabase/server'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import type { Usuario, PerfilUsuario } from '@/types'
import type { PermMap } from '@/lib/permissoes'
import { MODULOS } from '@/types'

const getUsuariosCached = unstable_cache(
  async (_userId: string, limit: number): Promise<Usuario[]> => {
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
  },
  ['usuarios-list'],
  { revalidate: 60, tags: ['usuarios-list'] }
)

export async function getUsuarios(limit = 100): Promise<Usuario[]> {
  const userId = await requireAuthenticatedUserId()
  return withSupabaseCookieContext(() => getUsuariosCached(userId, limit))
}

export async function getPermissoesUsuario(userId: string): Promise<PermMap | null> {
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
  revalidatePath('/usuarios')
  revalidateTag('usuarios-list')
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

  updateTag('user-permissions')
  revalidatePath('/usuarios')
  revalidateTag('usuarios-list')
}

export async function deletarUsuario(id: string) {
  await assertPermissao('usuarios', 'deletar')
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) throw new Error(error.message)
  revalidatePath('/usuarios')
  revalidateTag('usuarios-list')
}
