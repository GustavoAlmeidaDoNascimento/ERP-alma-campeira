'use server'

import { createClient } from '@/lib/supabase/server'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import { capitalizarTipoGasto, type FormaPagamento, type Gasto, type TipoGasto } from '@/types'

const FORMAS_VALIDAS: FormaPagamento[] = [
  'pix',
  'dinheiro',
  'cartao_credito',
  'cartao_debito',
  'boleto',
  'cheque',
  'link',
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
  usuario_id?: string | null
}

function normalizarGastoPayload(input: GastoInput) {
  const tipo = capitalizarTipoGasto(input.tipo)
  if (!tipo) throw new Error('Selecione o tipo de gasto.')
  if (!FORMAS_VALIDAS.includes(input.forma_pagamento)) throw new Error('Forma de pagamento inválida.')
  const descricao = (input.descricao ?? '').trim()
  if (!descricao) throw new Error('Descrição é obrigatória.')
  const valor = Number(input.valor)
  if (!Number.isFinite(valor) || valor <= 0) throw new Error('Informe um valor maior que zero.')
  if (!input.data_gasto) throw new Error('Data do gasto é obrigatória.')

  return {
    tipo,
    descricao,
    valor,
    forma_pagamento: input.forma_pagamento,
    data_gasto: input.data_gasto,
    observacao: (input.observacao ?? '').toString().trim() || null,
    ordem_compra_id: input.ordem_compra_id ?? null,
  }
}

/**
 * Garante que a tag de tipo exista em `tipos_gasto` (idempotente). Mantém o
 * catálogo de tags coerente mesmo se um gasto for salvo com um tipo recém-criado.
 */
async function garantirTipoGasto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nome: string
) {
  const { data } = await supabase.from('tipos_gasto').select('id').eq('nome', nome).limit(1)
  if (data && data.length > 0) return
  await supabase.from('tipos_gasto').insert({ nome, sistema: false })
}

export async function listarGastos(): Promise<Gasto[]> {
  await assertPermissao('gastos', 'ver')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('gastos')
    .select('*, ordem_compra:ordens_compra(id, codigo), usuario:usuarios_perfis(id, nome)')
    .order('data_gasto', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(error.message)
  return (data ?? []) as Gasto[]
}

export async function criarGasto(input: GastoInput) {
  await assertPermissao('gastos', 'criar')
  const supabase = await createClient()
  // usuario_id vem do select "Quem está registrando" do modal; cai pro autenticado se não vier.
  const usuario_id =
    input.usuario_id ?? (await requireAuthenticatedUserId().catch(() => null))
  const row = { ...normalizarGastoPayload(input), usuario_id }
  const { error } = await supabase.from('gastos').insert(row)
  if (error) throw new Error(error.message)
}

export async function atualizarGasto(id: string, input: GastoInput) {
  await assertPermissao('gastos', 'editar')
  const supabase = await createClient()
  const row = {
    ...normalizarGastoPayload(input),
    ...(input.usuario_id !== undefined ? { usuario_id: input.usuario_id } : {}),
  }
  const { error } = await supabase.from('gastos').update(row).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deletarGasto(id: string) {
  await assertPermissao('gastos', 'deletar')
  const supabase = await createClient()
  const { error } = await supabase.from('gastos').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
