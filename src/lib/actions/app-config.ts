'use server'

import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertPermissao } from '@/lib/auth'
import { fetchTaxasLucroConfig } from '@/lib/cache/list-data'

export type TaxasLucroConfig = {
  /** Valor fixo em R$ adicionado ao custo de materiais (ex.: 27.00). */
  taxa_producao: number
  /** Margem de lucro em % sobre o custo de produção (ex.: 60 = 60%). */
  margem_lucro: number
  /** Comissão em % descontada do preço de venda (ex.: 10 = 10%). */
  taxa_comissao: number
}

const APP_CONFIG_MISSING_MSG =
  'A tabela app_config ainda não existe no Supabase. Abra o SQL Editor, execute o arquivo supabase/migration_app_config_taxas_lucro.sql do repositório e, se o erro persistir, em Project Settings → API use "Reload schema" (cache do PostgREST).'

/** PostgREST / Postgres quando app_config não existe ou não está no cache. */
function isAppConfigUnavailable(error: { message?: string }): boolean {
  const m = error.message ?? ''
  if (!m.includes('app_config')) return false
  return (
    m.includes('schema cache') ||
    m.includes('does not exist') ||
    m.includes('Could not find the table')
  )
}

export async function getTaxasLucroConfig(): Promise<TaxasLucroConfig> {
  await assertPermissao('taxas_lucro', 'ver')
  return fetchTaxasLucroConfig()
}

export async function updateTaxasLucroConfig(input: TaxasLucroConfig) {
  await assertPermissao('taxas_lucro', 'editar')
  const tp = Number(input.taxa_producao)
  const ml = Number(input.margem_lucro)
  const tc = Number(input.taxa_comissao)
  if (!Number.isFinite(tp) || tp < 0) {
    throw new Error('Taxa de produção inválida (informe um valor em R$ maior ou igual a 0).')
  }
  if (!Number.isFinite(ml) || ml < 0) {
    throw new Error('Margem de lucro inválida (use 0% ou mais).')
  }
  if (!Number.isFinite(tc) || tc < 0 || tc > 100) {
    throw new Error('Taxa de comissão inválida (use 0 a 100%).')
  }

  const supabase = await createClient()
  const { error } = await supabase.from('app_config').upsert(
    {
      id: 1,
      taxa_producao_lucro: tp,
      margem_lucro: ml,
      taxa_comissao_lucro: tc,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )

  if (error) {
    if (isAppConfigUnavailable(error)) throw new Error(APP_CONFIG_MISSING_MSG)
    throw new Error(error.message)
  }
  revalidateTag('app-config-taxas-lucro', 'max')
}
