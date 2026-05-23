'use server'

import { createClient } from '@/lib/supabase/server'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import type { Boleto, BoletoTipo } from '@/types'

export type ParcelaInput = {
  numero: number
  vencimento: string
  valor: number
  pago_em?: string | null
  valor_pago?: number | null
}

export type BoletoInput = {
  tipo: BoletoTipo
  contraparte_nome: string
  cnpj_cpf?: string | null
  cliente_id?: string | null
  fornecedor_id?: string | null
  vendedor_id?: string | null
  unidades?: number | null
  numero_documento?: string | null
  valor_total: number
  emitido_em?: string | null
  observacao?: string | null
  parcelas: ParcelaInput[]
}

function normalizar(input: BoletoInput) {
  if (input.tipo !== 'entrada' && input.tipo !== 'saida') {
    throw new Error('Tipo de boleto inválido.')
  }
  const contraparte = (input.contraparte_nome ?? '').trim()
  if (!contraparte) throw new Error('Informe o nome do cliente/fornecedor.')

  const valor_total = Number(input.valor_total)
  if (!Number.isFinite(valor_total) || valor_total < 0) {
    throw new Error('Valor total inválido.')
  }

  const parcelas = (input.parcelas ?? []).filter((p) => p.valor > 0 && p.vencimento)
  if (parcelas.length === 0) throw new Error('Adicione pelo menos uma parcela.')
  if (parcelas.length > 6) throw new Error('Máximo de 6 parcelas.')

  const numeros = new Set<number>()
  for (const p of parcelas) {
    if (!Number.isInteger(p.numero) || p.numero < 1 || p.numero > 6) {
      throw new Error('Número de parcela inválido (1 a 6).')
    }
    if (numeros.has(p.numero)) throw new Error('Parcelas duplicadas.')
    numeros.add(p.numero)
    if (!Number.isFinite(p.valor) || p.valor < 0) throw new Error('Valor de parcela inválido.')
  }

  return {
    head: {
      tipo: input.tipo,
      contraparte_nome: contraparte,
      cnpj_cpf: (input.cnpj_cpf ?? '').toString().trim() || null,
      cliente_id: input.tipo === 'entrada' ? input.cliente_id ?? null : null,
      fornecedor_id: input.tipo === 'saida' ? input.fornecedor_id ?? null : null,
      vendedor_id: input.tipo === 'entrada' ? input.vendedor_id ?? null : null,
      unidades: input.unidades != null && input.unidades > 0 ? Math.trunc(input.unidades) : null,
      numero_documento: (input.numero_documento ?? '').toString().trim() || null,
      valor_total,
      emitido_em: input.emitido_em || null,
      observacao: (input.observacao ?? '').toString().trim() || null,
    },
    parcelas: parcelas
      .sort((a, b) => a.numero - b.numero)
      .map((p) => ({
        numero: p.numero,
        vencimento: p.vencimento,
        valor: Number(p.valor),
        pago_em: p.pago_em || null,
        valor_pago: p.valor_pago != null ? Number(p.valor_pago) : null,
      })),
  }
}

const SELECT_BOLETO = `
  *,
  parcelas:boleto_parcelas(*),
  cliente:clientes(id, nome),
  fornecedor:fornecedores(id, nome),
  vendedor:usuarios_perfis!boletos_vendedor_id_fkey(id, nome),
  criador:usuarios_perfis!boletos_criado_por_fkey(id, nome)
`

export async function listarBoletos(tipo?: BoletoTipo): Promise<Boleto[]> {
  await assertPermissao('boletos', 'ver')
  const supabase = await createClient()
  let query = supabase
    .from('boletos')
    .select(SELECT_BOLETO)
    .order('created_at', { ascending: false })
    .limit(500)
  if (tipo) query = query.eq('tipo', tipo)
  const { data, error } = await query
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as Boleto[]
  // Ordena parcelas pela posição
  for (const b of rows) {
    b.parcelas = (b.parcelas ?? []).sort((a, c) => a.numero - c.numero)
  }
  return rows
}

export async function criarBoleto(input: BoletoInput): Promise<string> {
  await assertPermissao('boletos', 'criar')
  const supabase = await createClient()
  const { head, parcelas } = normalizar(input)
  const criado_por = await requireAuthenticatedUserId().catch(() => null)

  const { data: boleto, error } = await supabase
    .from('boletos')
    .insert({ ...head, criado_por })
    .select('id')
    .single()
  if (error || !boleto) throw new Error(error?.message ?? 'Erro ao criar boleto.')

  const rows = parcelas.map((p) => ({ ...p, boleto_id: boleto.id }))
  const { error: errPar } = await supabase.from('boleto_parcelas').insert(rows)
  if (errPar) {
    // rollback manual
    await supabase.from('boletos').delete().eq('id', boleto.id)
    throw new Error(errPar.message)
  }
  return boleto.id
}

export async function atualizarBoleto(id: string, input: BoletoInput) {
  await assertPermissao('boletos', 'editar')
  const supabase = await createClient()
  const { head, parcelas } = normalizar(input)

  const { error } = await supabase.from('boletos').update(head).eq('id', id)
  if (error) throw new Error(error.message)

  // Estratégia simples: apaga parcelas e reinsere. Há cascade em boleto_id.
  const { error: errDel } = await supabase.from('boleto_parcelas').delete().eq('boleto_id', id)
  if (errDel) throw new Error(errDel.message)

  const rows = parcelas.map((p) => ({ ...p, boleto_id: id }))
  const { error: errIns } = await supabase.from('boleto_parcelas').insert(rows)
  if (errIns) throw new Error(errIns.message)
}

export async function deletarBoleto(id: string) {
  await assertPermissao('boletos', 'deletar')
  const supabase = await createClient()
  const { error } = await supabase.from('boletos').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Marca/desmarca uma parcela como paga.
 * O cliente DEVE passar `valor_pago` (vem do estado local da parcela) para
 * evitar um SELECT extra no servidor — mantém o caminho rápido em 1 UPDATE.
 * Se não vier, faz fallback com SELECT+UPDATE (uso defensivo).
 */
export async function marcarParcela(
  parcela_id: string,
  pago: boolean,
  opts?: { pago_em?: string; valor_pago?: number },
) {
  await assertPermissao('boletos', 'editar')
  const supabase = await createClient()
  if (pago) {
    const pago_em = opts?.pago_em ?? new Date().toISOString().slice(0, 10)
    let valor_pago = opts?.valor_pago
    if (valor_pago == null) {
      const { data: parcela } = await supabase
        .from('boleto_parcelas')
        .select('valor')
        .eq('id', parcela_id)
        .single()
      valor_pago = Number(parcela?.valor ?? 0)
    }
    const { error } = await supabase
      .from('boleto_parcelas')
      .update({ pago_em, valor_pago })
      .eq('id', parcela_id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase
      .from('boleto_parcelas')
      .update({ pago_em: null, valor_pago: null })
      .eq('id', parcela_id)
    if (error) throw new Error(error.message)
  }
}
