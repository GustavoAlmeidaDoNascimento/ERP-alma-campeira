'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { unstable_cache } from 'next/cache'
import { createClient, withSupabaseCookieContext } from '@/lib/supabase/server'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import type { Faca } from '@/types'

const getFacasCached = unstable_cache(
  async (_userId: string, limit: number): Promise<Faca[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('facas')
      .select('*')
      .order('codigo')
      .limit(limit)
    if (error) throw new Error(error.message)
    return data as Faca[]
  },
  ['facas-list'],
  { revalidate: 60, tags: ['facas-list'] }
)

export async function getFacas(limit = 80): Promise<Faca[]> {
  const userId = await requireAuthenticatedUserId()
  return withSupabaseCookieContext(() => getFacasCached(userId, limit))
}

export async function gerarCodigoFaca(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('facas')
    .select('codigo')
    .order('codigo', { ascending: false })
    .limit(1)
    .single()

  if (!data) return 'FK-0001'
  const num = parseInt(data.codigo.replace('FK-', ''), 10)
  return `FK-${String(num + 1).padStart(4, '0')}`
}

type FacaInput = {
  nome: string
  categoria: string
  preco_venda: number
  estoque_atual: number
  estoque_minimo: number
}

export async function criarFaca(input: FacaInput) {
  await assertPermissao('facas', 'criar')
  const supabase = await createClient()
  const codigo = await gerarCodigoFaca()

  const { error } = await supabase.from('facas').insert({
    codigo,
    nome: input.nome.trim(),
    categoria: input.categoria,
    preco_venda: input.preco_venda,
    estoque_atual: input.estoque_atual,
    estoque_minimo: input.estoque_minimo,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/facas')
  revalidateTag('facas-list')
}

export async function atualizarFaca(id: string, input: FacaInput) {
  await assertPermissao('facas', 'editar')
  const supabase = await createClient()

  const { error } = await supabase
    .from('facas')
    .update({
      nome: input.nome.trim(),
      categoria: input.categoria,
      preco_venda: input.preco_venda,
      estoque_atual: input.estoque_atual,
      estoque_minimo: input.estoque_minimo,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/facas')
  revalidateTag('facas-list')
}

export async function deletarFaca(id: string) {
  await assertPermissao('facas', 'deletar')
  const supabase = await createClient()
  const { error } = await supabase.from('facas').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/facas')
  revalidateTag('facas-list')
}
