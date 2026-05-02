'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import type { FormaPagamento, Gasto, TipoGasto } from '@/types'

const TIPOS_VALIDOS: TipoGasto[] = [
  'beneficios',
  'investimento',
  'material_consumo',
  'administrativo',
  'pagamento_oc',
  'outros',
]

const FORMAS_VALIDAS: FormaPagamento[] = [
  'pix',
  'dinheiro',
  'cartao_credito',
  'cartao_debito',
  'boleto',
  'transferencia',
  'outro',
]

export type GastoInput = {
  tipo: TipoGasto
  descricao: string
  valor: number
  forma_pagamento: FormaPagamento
  data_gasto: string
  observacao?: string | null
  ordem_compra_id?: string | null
}

function normalizarGastoPayload(input: GastoInput) {
  if (!TIPOS_VALIDOS.includes(input.tipo)) throw new Error('Tipo de gasto inválido.')
  if (!FORMAS_VALIDAS.includes(input.forma_pagamento)) throw new Error('Forma de pagamento inválida.')
  const descricao = (input.descricao ?? '').trim()
  if (!descricao) throw new Error('Descrição é obrigatória.')
  const valor = Number(input.valor)
  if (!Number.isFinite(valor) || valor < 0) throw new Error('Valor inválido.')
  if (!input.data_gasto) throw new Error('Data do gasto é obrigatória.')

  return {
    tipo: input.tipo,
    descricao,
    valor,
    forma_pagamento: input.forma_pagamento,
    data_gasto: input.data_gasto,
    observacao: (input.observacao ?? '').toString().trim() || null,
    ordem_compra_id: input.ordem_compra_id ?? null,
  }
}

export async function listarGastos(): Promise<Gasto[]> {
  await assertPermissao('gastos', 'ver')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('gastos')
    .select('*, ordem_compra:ordens_compra(id, codigo)')
    .order('data_gasto', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(error.message)
  return (data ?? []) as Gasto[]
}

export async function criarGasto(input: GastoInput) {
  await assertPermissao('gastos', 'criar')
  const supabase = await createClient()
  const usuario_id = await requireAuthenticatedUserId().catch(() => null)
  const row = { ...normalizarGastoPayload(input), usuario_id }
  const { error } = await supabase.from('gastos').insert(row)
  if (error) throw new Error(error.message)
  revalidatePath('/gastos')
  revalidateTag('gastos-list', 'max')
  revalidateTag('metricas-financeiro', 'max')
}

export async function atualizarGasto(id: string, input: GastoInput) {
  await assertPermissao('gastos', 'editar')
  const supabase = await createClient()
  const row = normalizarGastoPayload(input)
  const { error } = await supabase.from('gastos').update(row).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/gastos')
  revalidateTag('gastos-list', 'max')
  revalidateTag('metricas-financeiro', 'max')
}

export async function deletarGasto(id: string) {
  await assertPermissao('gastos', 'deletar')
  const supabase = await createClient()
  const { error } = await supabase.from('gastos').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/gastos')
  revalidateTag('gastos-list', 'max')
  revalidateTag('metricas-financeiro', 'max')
}
