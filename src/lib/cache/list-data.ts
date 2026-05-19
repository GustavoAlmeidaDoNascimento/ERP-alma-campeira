import { unstable_cache } from 'next/cache'
import { createClient, withSupabaseCookieContext } from '@/lib/supabase/server'
import type { MateriaPrima, Fornecedor, CategoriaMateriaPrimaDB } from '@/types'

const LIST_REVALIDATE = 60

function materiasPrimasCache(userId: string) {
  return unstable_cache(
    async (): Promise<MateriaPrima[]> => {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('materias_primas')
        .select('*, fornecedor:fornecedores(id, nome)')
        .order('codigo')
        .limit(120)
      if (error) throw new Error(error.message)
      return data as MateriaPrima[]
    },
    ['list-materias-primas', userId],
    { revalidate: LIST_REVALIDATE, tags: [`list-materias-primas-${userId}`] },
  )
}

function fornecedoresSelectCache(userId: string) {
  return unstable_cache(
    async (): Promise<Pick<Fornecedor, 'id' | 'nome'>[]> => {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('fornecedores')
        .select('id, nome')
        .order('nome')
        .limit(80)
      if (error) throw new Error(error.message)
      return data ?? []
    },
    ['list-fornecedores-select', userId],
    { revalidate: LIST_REVALIDATE, tags: [`list-fornecedores-select-${userId}`] },
  )
}

const CATEGORIAS_PADRAO: CategoriaMateriaPrimaDB[] = [
  { id: 'fallback-bainha', nome: 'Bainha', ordem: 1, created_at: '' },
  { id: 'fallback-botao', nome: 'Botão', ordem: 2, created_at: '' },
  { id: 'fallback-lamina', nome: 'Lâmina', ordem: 3, created_at: '' },
  { id: 'fallback-cabo', nome: 'Cabo', ordem: 4, created_at: '' },
]

function categoriasMPCache(userId: string) {
  return unstable_cache(
    async (): Promise<CategoriaMateriaPrimaDB[]> => {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('categorias_materia_prima')
        .select('*')
        .order('ordem')
      if (error) throw new Error(error.message)
      const categorias = (data ?? []) as CategoriaMateriaPrimaDB[]
      return categorias.length > 0 ? categorias : CATEGORIAS_PADRAO
    },
    ['list-categorias-mp', userId],
    { revalidate: LIST_REVALIDATE, tags: [`list-categorias-mp-${userId}`] },
  )
}

export function fetchMatériasPrimasList(userId: string): Promise<MateriaPrima[]> {
  return withSupabaseCookieContext(() => materiasPrimasCache(userId)())
}

export function fetchFornecedoresSelect(userId: string): Promise<Pick<Fornecedor, 'id' | 'nome'>[]> {
  return withSupabaseCookieContext(() => fornecedoresSelectCache(userId)())
}

export function fetchCategoriasMateriaPrimaList(userId: string): Promise<CategoriaMateriaPrimaDB[]> {
  return withSupabaseCookieContext(() => categoriasMPCache(userId)())
}
