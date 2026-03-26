'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { unstable_cache } from 'next/cache'
import { createClient, withSupabaseCookieContext } from '@/lib/supabase/server'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import type { Fornecedor } from '@/types'

const getFornecedoresCached = unstable_cache(
  async (_userId: string, limit: number): Promise<Fornecedor[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('fornecedores')
      .select('*')
      .order('nome')
      .limit(limit)
    if (error) throw new Error(error.message)
    return data as Fornecedor[]
  },
  ['fornecedores-list'],
  { revalidate: 60, tags: ['fornecedores-list'] }
)

export async function getFornecedores(limit = 50): Promise<Fornecedor[]> {
  const userId = await requireAuthenticatedUserId()
  return withSupabaseCookieContext(() => getFornecedoresCached(userId, limit))
}

type FornecedorInput = {
  nome: string
  telefone: string
  email: string
}

export async function criarFornecedor(input: FornecedorInput) {
  await assertPermissao('fornecedores', 'criar')
  const supabase = await createClient()
  const { error } = await supabase.from('fornecedores').insert({
    nome: input.nome.trim(),
    telefone: input.telefone.trim() || null,
    email: input.email.trim() || null,
  })
  if (error) throw new Error(error.message)
  revalidatePath('/fornecedores')
  revalidateTag('fornecedores-list', 'max')
}

export async function atualizarFornecedor(id: string, input: FornecedorInput) {
  await assertPermissao('fornecedores', 'editar')
  const supabase = await createClient()
  const { error } = await supabase
    .from('fornecedores')
    .update({
      nome: input.nome.trim(),
      telefone: input.telefone.trim() || null,
      email: input.email.trim() || null,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/fornecedores')
  revalidateTag('fornecedores-list', 'max')
}

export async function deletarFornecedor(id: string) {
  await assertPermissao('fornecedores', 'deletar')
  const supabase = await createClient()

  const { data: uso } = await supabase
    .from('materias_primas')
    .select('id')
    .eq('fornecedor_id', id)
    .limit(1)

  if (uso && uso.length > 0) {
    throw new Error('Este fornecedor possui matérias-primas vinculadas e não pode ser excluído.')
  }

  const { error } = await supabase.from('fornecedores').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/fornecedores')
  revalidateTag('fornecedores-list', 'max')
}
