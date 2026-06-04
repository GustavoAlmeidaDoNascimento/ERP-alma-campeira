'use server'

import { createClient } from '@/lib/supabase/server'
import { assertPermissao } from '@/lib/auth'
import {
  capitalizarTipoGasto,
  TIPO_GASTO_OUTROS,
  TIPO_GASTO_PAGAMENTO_OC,
  type TipoGastoDB,
} from '@/types'

/** Tags de sistema (não podem ser removidas pelo usuário). */
const TAGS_SISTEMA = [TIPO_GASTO_PAGAMENTO_OC, TIPO_GASTO_OUTROS]

/** Compara nomes ignorando caixa e acentos, para detectar duplicatas. */
function normalizar(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
}

export async function listarTiposGasto(): Promise<TipoGastoDB[]> {
  await assertPermissao('gastos', 'ver')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('tipos_gasto')
    .select('*')
    .order('nome')
  if (error) throw new Error(error.message)
  return (data ?? []) as TipoGastoDB[]
}

/**
 * Cria uma nova tag (capitalizada). Se já existir uma equivalente
 * (ignorando caixa/acentos), retorna a existente em vez de duplicar.
 */
export async function criarTipoGasto(nomeBruto: string): Promise<TipoGastoDB> {
  await assertPermissao('gastos', 'criar')
  const nome = capitalizarTipoGasto(nomeBruto)
  if (!nome) throw new Error('Informe um nome para o tipo de gasto.')

  const supabase = await createClient()

  const { data: existentes, error: errBusca } = await supabase
    .from('tipos_gasto')
    .select('*')
  if (errBusca) throw new Error(errBusca.message)

  const alvo = normalizar(nome)
  const jaExiste = (existentes ?? []).find((t) => normalizar(t.nome) === alvo)
  if (jaExiste) return jaExiste as TipoGastoDB

  const { data, error } = await supabase
    .from('tipos_gasto')
    .insert({ nome, sistema: false })
    .select('*')
    .single()
  if (error) throw new Error(error.message)
  return data as TipoGastoDB
}

/**
 * Remove uma tag. Os gastos que usavam essa tag passam a ser listados como
 * "Outros". Tags de sistema não podem ser removidas.
 */
export async function deletarTipoGasto(id: string): Promise<void> {
  await assertPermissao('gastos', 'deletar')
  const supabase = await createClient()

  const { data: tag, error: errTag } = await supabase
    .from('tipos_gasto')
    .select('id, nome, sistema')
    .eq('id', id)
    .single()
  if (errTag) throw new Error(errTag.message)
  if (!tag) throw new Error('Tipo de gasto não encontrado.')
  if (tag.sistema || TAGS_SISTEMA.includes(tag.nome)) {
    throw new Error('Este tipo de gasto é de sistema e não pode ser removido.')
  }

  // Reatribui os gastos dessa tag para "Outros" antes de remover.
  const { error: errUpd } = await supabase
    .from('gastos')
    .update({ tipo: TIPO_GASTO_OUTROS })
    .eq('tipo', tag.nome)
  if (errUpd) throw new Error(errUpd.message)

  const { error: errDel } = await supabase.from('tipos_gasto').delete().eq('id', id)
  if (errDel) throw new Error(errDel.message)
}
