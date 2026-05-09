'use server'

import { createClient } from '@/lib/supabase/server'
import { assertPermissao } from '@/lib/auth'
import type { CategoriaConsumivelDB } from '@/types'

const CATEGORIAS_PADRAO: CategoriaConsumivelDB[] = [
  { id: 'fallback-escritorio', nome: 'Escritório', ordem: 1, created_at: '' },
  { id: 'fallback-limpeza', nome: 'Limpeza', ordem: 2, created_at: '' },
  { id: 'fallback-producao', nome: 'Produção', ordem: 3, created_at: '' },
  { id: 'fallback-seguranca', nome: 'Segurança', ordem: 4, created_at: '' },
]

export async function getCategoriasConsumivel(): Promise<CategoriaConsumivelDB[]> {
  await assertPermissao('consumiveis', 'ver')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categorias_consumivel')
    .select('*')
    .order('ordem')
  if (error) throw new Error(error.message)
  const categorias = (data ?? []) as CategoriaConsumivelDB[]
  return categorias.length > 0 ? categorias : CATEGORIAS_PADRAO
}

type CategoriaInput = { nome: string }

export async function criarCategoriaConsumivel(input: CategoriaInput) {
  await assertPermissao('consumiveis', 'criar')
  const supabase = await createClient()

  const { data: maxData } = await supabase
    .from('categorias_consumivel')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .single()

  const ordem = (maxData?.ordem ?? 0) + 1

  const { error } = await supabase.from('categorias_consumivel').insert({
    nome: input.nome.trim(),
    ordem,
  })
  if (error) throw new Error(error.message)
}

export async function atualizarCategoriaConsumivel(id: string, input: CategoriaInput) {
  await assertPermissao('consumiveis', 'editar')
  const supabase = await createClient()

  const { error } = await supabase
    .from('categorias_consumivel')
    .update({ nome: input.nome.trim() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deletarCategoriaConsumivel(id: string) {
  await assertPermissao('consumiveis', 'deletar')
  const supabase = await createClient()
  const { error } = await supabase.from('categorias_consumivel').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
