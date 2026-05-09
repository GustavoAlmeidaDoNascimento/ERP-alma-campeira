'use server'

import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertPermissao } from '@/lib/auth'
import type { Cargo, ModuloKey } from '@/types'
import { MODULOS } from '@/types'

export async function getCargos(limit = 50): Promise<Cargo[]> {
  await assertPermissao('cargos', 'ver')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cargos')
    .select('*, permissoes:cargo_permissoes(*)')
    .order('nome')
    .limit(limit)
  if (error) throw new Error(error.message)
  return data as Cargo[]
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

  // Permissões são cacheadas em auth.ts via unstable_cache. Invalidar essa tag
  // específica garante que o próximo `assertPermissao` releia do banco.
  revalidateTag('user-permissions', 'max')
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

  revalidateTag('user-permissions', 'max')
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
}
