'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'

/** Taxas em % do preço de venda (ex.: 10 = 10%). */
export type TaxasLucroConfig = {
  taxa_producao: number
  taxa_comissao: number
}

/** PostgREST quando a tabela ainda não existe no projeto (migração não aplicada). */
function isAppConfigUnavailable(error: { message?: string }): boolean {
  const m = error.message ?? ''
  return m.includes('app_config') && m.includes('schema cache')
}

export async function getTaxasLucroConfig(): Promise<TaxasLucroConfig> {
  await requireAuthenticatedUserId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('app_config')
    .select('taxa_producao_lucro, taxa_comissao_lucro')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    if (isAppConfigUnavailable(error)) {
      return { taxa_producao: 0, taxa_comissao: 0 }
    }
    throw new Error(error.message)
  }
  if (!data) return { taxa_producao: 0, taxa_comissao: 0 }
  return {
    taxa_producao: Number(data.taxa_producao_lucro ?? 0),
    taxa_comissao: Number(data.taxa_comissao_lucro ?? 0),
  }
}

export async function updateTaxasLucroConfig(input: TaxasLucroConfig) {
  await assertPermissao('taxas_lucro', 'editar')
  const tp = Number(input.taxa_producao)
  const tc = Number(input.taxa_comissao)
  if (!Number.isFinite(tp) || tp < 0 || tp > 100) {
    throw new Error('Taxa de produção inválida (use 0 a 100%).')
  }
  if (!Number.isFinite(tc) || tc < 0 || tc > 100) {
    throw new Error('Taxa de comissão inválida (use 0 a 100%).')
  }

  const supabase = await createClient()
  const { error } = await supabase.from('app_config').upsert(
    {
      id: 1,
      taxa_producao_lucro: tp,
      taxa_comissao_lucro: tc,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )

  if (error) throw new Error(error.message)
  revalidatePath('/configuracoes')
  revalidatePath('/facas')
}
