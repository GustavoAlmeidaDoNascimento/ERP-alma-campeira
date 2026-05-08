'use server'

import { createClient } from '@/lib/supabase/server'
import { assertPermissao } from '@/lib/auth'
import type { CategoriaMateriaPrimaDB } from '@/types'

const CATEGORIAS_PADRAO: CategoriaMateriaPrimaDB[] = [
  { id: 'fallback-bainha', nome: 'Bainha', ordem: 1, created_at: '' },
  { id: 'fallback-botao', nome: 'Botão', ordem: 2, created_at: '' },
  { id: 'fallback-lamina', nome: 'Lâmina', ordem: 3, created_at: '' },
  { id: 'fallback-cabo', nome: 'Cabo', ordem: 4, created_at: '' },
]

export async function getCategoriasMateriaPrima(): Promise<CategoriaMateriaPrimaDB[]> {
  await assertPermissao('materias_primas', 'ver')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('categorias_materia_prima')
    .select('*')
    .order('ordem')
  if (error) throw new Error(error.message)
  const categorias = (data ?? []) as CategoriaMateriaPrimaDB[]
  return categorias.length > 0 ? categorias : CATEGORIAS_PADRAO
}

type CategoriaInput = { nome: string }

export async function criarCategoriaMateriaPrima(input: CategoriaInput) {
  await assertPermissao('materias_primas', 'criar')
  const supabase = await createClient()

  const { data: maxData } = await supabase
    .from('categorias_materia_prima')
    .select('ordem')
    .order('ordem', { ascending: false })
    .limit(1)
    .single()

  const ordem = (maxData?.ordem ?? 0) + 1

  const { error } = await supabase.from('categorias_materia_prima').insert({
    nome: input.nome.trim(),
    ordem,
  })
  if (error) throw new Error(error.message)
}

export async function atualizarCategoriaMateriaPrima(id: string, input: CategoriaInput) {
  await assertPermissao('materias_primas', 'editar')
  const supabase = await createClient()

  const { error } = await supabase
    .from('categorias_materia_prima')
    .update({ nome: input.nome.trim() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deletarCategoriaMateriaPrima(id: string) {
  await assertPermissao('materias_primas', 'deletar')
  const supabase = await createClient()
  const { error } = await supabase.from('categorias_materia_prima').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
