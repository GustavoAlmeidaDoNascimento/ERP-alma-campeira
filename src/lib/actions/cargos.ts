'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { updateTag } from 'next/cache'
import { unstable_cache } from 'next/cache'
import { createClient, withSupabaseCookieContext } from '@/lib/supabase/server'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import type { Cargo, ModuloKey } from '@/types'
import { MODULOS } from '@/types'

const getCargosCached = unstable_cache(
  async (_userId: string, limit: number): Promise<Cargo[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('cargos')
      .select('*, permissoes:cargo_permissoes(*)')
      .order('nome')
      .limit(limit)
    if (error) throw new Error(error.message)
    return data as Cargo[]
  },
  ['cargos-list'],
  { revalidate: 60, tags: ['cargos-list'] }
)

export async function getCargos(limit = 50): Promise<Cargo[]> {
  const userId = await requireAuthenticatedUserId()
  return withSupabaseCookieContext(() => getCargosCached(userId, limit))
}

type CargoInput = {
  nome: string
  descricao: string
  cor: string
  permissoes: Record<ModuloKey, { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }>
}

export async function criarCargo(input: CargoInput) {
  await assertPermissao('cargos', 'criar')
  const supabase = await createClient()

  const { data: cargo, error } = await supabase
    .from('cargos')
    .insert({ nome: input.nome.trim(), descricao: input.descricao.trim() || null, cor: input.cor })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  const permissoes = MODULOS.map((m) => ({
    cargo_id: cargo.id,
    modulo: m.key,
    ...input.permissoes[m.key],
  }))

  const { error: permError } = await supabase.from('cargo_permissoes').insert(permissoes)
  if (permError) throw new Error(permError.message)

  updateTag('user-permissions')
  revalidatePath('/cargos')
  revalidatePath('/usuarios')
  revalidateTag('cargos-list', 'max')
}

export async function atualizarCargo(id: string, input: CargoInput) {
  await assertPermissao('cargos', 'editar')
  const supabase = await createClient()

  const { error } = await supabase
    .from('cargos')
    .update({ nome: input.nome.trim(), descricao: input.descricao.trim() || null, cor: input.cor })
    .eq('id', id)

  if (error) throw new Error(error.message)

  const permissoes = MODULOS.map((m) => ({
    cargo_id: id,
    modulo: m.key,
    ...input.permissoes[m.key],
  }))

  const { error: permError } = await supabase
    .from('cargo_permissoes')
    .upsert(permissoes, { onConflict: 'cargo_id,modulo' })

  if (permError) throw new Error(permError.message)

  updateTag('user-permissions')
  revalidatePath('/cargos')
  revalidatePath('/usuarios')
  revalidateTag('cargos-list', 'max')
}

export async function deletarCargo(id: string) {
  await assertPermissao('cargos', 'deletar')
  const supabase = await createClient()

  const { data: uso } = await supabase
    .from('usuarios_perfis')
    .select('id')
    .eq('cargo_id', id)
    .limit(1)

  if (uso && uso.length > 0) {
    throw new Error('Este cargo está sendo usado por um ou mais usuários.')
  }

  const { error } = await supabase.from('cargos').delete().eq('id', id)
  if (error) throw new Error(error.message)

  revalidatePath('/cargos')
  revalidateTag('cargos-list', 'max')
}
