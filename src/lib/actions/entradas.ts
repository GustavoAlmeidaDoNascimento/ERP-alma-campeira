'use server'

import { createClient } from '@/lib/supabase/server'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import type { Entrada, FormaPagamento } from '@/types'

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

export type EntradaInput = {
  descricao: string
  valor: number
  forma_pagamento: FormaPagamento
  data_entrada: string
  categoria?: string | null
  observacao?: string | null
  usuario_id?: string | null
}

function normalizarEntradaPayload(input: EntradaInput) {
  if (!FORMAS_VALIDAS.includes(input.forma_pagamento)) throw new Error('Forma de pagamento inválida.')
  const descricao = (input.descricao ?? '').trim()
  if (!descricao) throw new Error('Descrição é obrigatória.')
  const valor = Number(input.valor)
  if (!Number.isFinite(valor) || valor <= 0) throw new Error('Informe um valor maior que zero.')
  if (!input.data_entrada) throw new Error('Data da entrada é obrigatória.')

  return {
    descricao,
    valor,
    forma_pagamento: input.forma_pagamento,
    data_entrada: input.data_entrada,
    categoria: (input.categoria ?? '').toString().trim() || null,
    observacao: (input.observacao ?? '').toString().trim() || null,
  }
}

// Reutilizamos o módulo de permissão `gastos` para a página de Movimentação
// (entradas + saídas vivem na mesma tela e no mesmo escopo de acesso).

export async function listarEntradas(): Promise<Entrada[]> {
  await assertPermissao('gastos', 'ver')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('entradas')
    .select('*, usuario:usuarios_perfis(id, nome)')
    .order('data_entrada', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) throw new Error(error.message)
  return (data ?? []) as Entrada[]
}

export async function criarEntrada(input: EntradaInput) {
  await assertPermissao('gastos', 'criar')
  const supabase = await createClient()
  const usuario_id =
    input.usuario_id ?? (await requireAuthenticatedUserId().catch(() => null))
  const payload = normalizarEntradaPayload(input)
  const { error } = await supabase.from('entradas').insert({ ...payload, usuario_id })
  if (error) throw new Error(error.message)
}

export async function atualizarEntrada(id: string, input: EntradaInput) {
  await assertPermissao('gastos', 'editar')
  const supabase = await createClient()
  const payload = normalizarEntradaPayload(input)
  const row = {
    ...payload,
    ...(input.usuario_id !== undefined ? { usuario_id: input.usuario_id } : {}),
  }
  const { error } = await supabase.from('entradas').update(row).eq('id', id)
  if (error) throw new Error(error.message)
}

export async function deletarEntrada(id: string) {
  await assertPermissao('gastos', 'deletar')
  const supabase = await createClient()
  const { error } = await supabase.from('entradas').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
