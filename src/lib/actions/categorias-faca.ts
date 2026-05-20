'use server'

import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import { fetchCategoriasFacaList } from '@/lib/cache/list-data'
import type { CategoriaFacaDB } from '@/types'

async function revalidateCategoriasFaca() {
  try {
    const userId = await requireAuthenticatedUserId()
    revalidateTag(`list-categorias-faca-${userId}`, 'max')
  } catch {}
}

export async function getCategoriasFaca(): Promise<CategoriaFacaDB[]> {
  const userId = await requireAuthenticatedUserId()
  await assertPermissao('facas', 'ver')
  return fetchCategoriasFacaList(userId)
}

type CategoriaInput = {
  nome: string
  cor_texto: string
  cor_fundo: string
  cor_borda: string
}

export async function criarCategoriaFaca(input: CategoriaInput) {
  await assertPermissao('facas', 'criar')
  const supabase = await createClient()

  const { data: maxData } = await supabase
    .from('categorias_faca')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .single()

  const ordem = (maxData?.ordem ?? 0) + 1

  const { error } = await supabase.from('categorias_faca').insert({
    nome: input.nome.trim(),
    cor_texto: input.cor_texto,
    cor_fundo: input.cor_fundo,
    cor_borda: input.cor_borda,
    ordem,
  })
  if (error) throw new Error(error.message)
  await revalidateCategoriasFaca()
}

export async function atualizarCategoriaFaca(id: string, input: CategoriaInput) {
  await assertPermissao('facas', 'editar')
  const supabase = await createClient()

  const { error } = await supabase
    .from('categorias_faca')
    .update({
      nome: input.nome.trim(),
      cor_texto: input.cor_texto,
      cor_fundo: input.cor_fundo,
      cor_borda: input.cor_borda,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)
  await revalidateCategoriasFaca()
}

export async function deletarCategoriaFaca(id: string) {
  await assertPermissao('facas', 'deletar')
  const supabase = await createClient()
  const { error } = await supabase.from('categorias_faca').delete().eq('id', id)
  if (error) throw new Error(error.message)
  await revalidateCategoriasFaca()
}
