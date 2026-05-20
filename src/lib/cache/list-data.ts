import { unstable_cache } from 'next/cache'
import { createClient, withSupabaseCookieContext } from '@/lib/supabase/server'
import type {
  MateriaPrima,
  Fornecedor,
  CategoriaMateriaPrimaDB,
  Faca,
  CategoriaFacaDB,
  Cliente,
} from '@/types'

type TaxasLucroConfig = {
  taxa_producao: number
  margem_lucro: number
  taxa_comissao: number
}

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

// ============================================================
// Facas (com custo calculado via BOM)
// ============================================================

function facasComCustoCache(userId: string) {
  return unstable_cache(
    async (): Promise<Faca[]> => {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('facas')
        .select('*')
        .order('codigo')
        .limit(120)
      if (error) throw new Error(error.message)
      const facas = (data ?? []) as Faca[]
      const ids = facas.map((f) => f.id)
      if (ids.length === 0) return facas
      const { data: boms, error: bomsErr } = await supabase
        .from('faca_materias_primas')
        .select('faca_id, quantidade, materia_prima:materias_primas(preco_custo)')
        .in('faca_id', ids)
      if (bomsErr) throw new Error(bomsErr.message)
      const base = new Map<string, number>()
      for (const b of boms ?? []) {
        const mp = (Array.isArray(b.materia_prima) ? b.materia_prima[0] : b.materia_prima) as
          | { preco_custo: number }
          | null
        const custo = Number(mp?.preco_custo ?? 0)
        const qtd = Number(b.quantidade ?? 0)
        base.set(b.faca_id, (base.get(b.faca_id) ?? 0) + custo * qtd)
      }
      return facas.map((f) => ({
        ...f,
        preco_custo: Math.round((base.get(f.id) ?? 0) * 100) / 100,
      }))
    },
    ['list-facas-com-custo', userId],
    { revalidate: LIST_REVALIDATE, tags: [`list-facas-${userId}`] },
  )
}

export function fetchFacasComCustoList(userId: string): Promise<Faca[]> {
  return withSupabaseCookieContext(() => facasComCustoCache(userId)())
}

// ============================================================
// Categorias de Faca
// ============================================================

function categoriasFacaCache(userId: string) {
  return unstable_cache(
    async (): Promise<CategoriaFacaDB[]> => {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('categorias_faca')
        .select('*')
        .order('ordem')
      if (error) throw new Error(error.message)
      return (data ?? []) as CategoriaFacaDB[]
    },
    ['list-categorias-faca', userId],
    { revalidate: LIST_REVALIDATE, tags: [`list-categorias-faca-${userId}`] },
  )
}

export function fetchCategoriasFacaList(userId: string): Promise<CategoriaFacaDB[]> {
  return withSupabaseCookieContext(() => categoriasFacaCache(userId)())
}

// ============================================================
// Fornecedores (lista completa)
// ============================================================

function fornecedoresFullCache(userId: string) {
  return unstable_cache(
    async (): Promise<Fornecedor[]> => {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('fornecedores')
        .select('*')
        .order('nome')
        .limit(120)
      if (error) throw new Error(error.message)
      return (data ?? []) as Fornecedor[]
    },
    ['list-fornecedores-full', userId],
    { revalidate: LIST_REVALIDATE, tags: [`list-fornecedores-${userId}`] },
  )
}

export function fetchFornecedoresFullList(userId: string): Promise<Fornecedor[]> {
  return withSupabaseCookieContext(() => fornecedoresFullCache(userId)())
}

// ============================================================
// Clientes
// ============================================================

function clientesCache(userId: string) {
  return unstable_cache(
    async (): Promise<Cliente[]> => {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome')
        .limit(120)
      if (error) throw new Error(error.message)
      return (data ?? []) as Cliente[]
    },
    ['list-clientes', userId],
    { revalidate: LIST_REVALIDATE, tags: [`list-clientes-${userId}`] },
  )
}

export function fetchClientesList(userId: string): Promise<Cliente[]> {
  return withSupabaseCookieContext(() => clientesCache(userId)())
}

// ============================================================
// Taxas de Lucro (config global)
// ============================================================

const taxasLucroCacheFn = unstable_cache(
  async (): Promise<TaxasLucroConfig> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('app_config')
      .select('taxa_producao_lucro, margem_lucro, taxa_comissao_lucro')
      .eq('id', 1)
      .maybeSingle()
    if (error || !data) return { taxa_producao: 0, margem_lucro: 0, taxa_comissao: 0 }
    return {
      taxa_producao: Number(data.taxa_producao_lucro ?? 0),
      margem_lucro: Number(data.margem_lucro ?? 0),
      taxa_comissao: Number(data.taxa_comissao_lucro ?? 0),
    }
  },
  ['app-config-taxas-lucro'],
  { revalidate: 600, tags: ['app-config-taxas-lucro'] },
)

export function fetchTaxasLucroConfig(): Promise<TaxasLucroConfig> {
  return withSupabaseCookieContext(() => taxasLucroCacheFn())
}
