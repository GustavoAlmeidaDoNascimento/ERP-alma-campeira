'use server'

import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import { fetchFornecedoresFullList } from '@/lib/cache/list-data'
import type { Fornecedor, OrdemCompraHistoricoResumo, StatusOC, TipoDocumento } from '@/types'
import { apenasDigitos } from '@/lib/br/documento'
import { validarCamposObrigatoriosParceiro } from '@/lib/br/validar-cadastro-parceiro'

async function revalidateFornecedoresList() {
  try {
    const userId = await requireAuthenticatedUserId()
    revalidateTag(`list-fornecedores-${userId}`, 'max')
    revalidateTag(`list-fornecedores-select-${userId}`, 'max')
  } catch {}
}

export async function getFornecedores(limit = 50): Promise<Fornecedor[]> {
  const userId = await requireAuthenticatedUserId()
  await assertPermissao('fornecedores', 'ver')
  const rows = await fetchFornecedoresFullList(userId)
  return rows.slice(0, limit)
}

/** Mantido para compatibilidade — agora idêntico a `getFornecedores`. */
export async function getFornecedoresSemCache(limit = 50): Promise<Fornecedor[]> {
  return getFornecedores(limit)
}

const STATUS_OC_VALIDOS: readonly StatusOC[] = ['pendente', 'enviada', 'recebida']

function normalizarStatusOCHistorico(row: { status?: unknown; pago?: unknown }): { status: StatusOC; pago: boolean } {
  let status = String(row.status ?? 'pendente')
  let pago = Boolean(row.pago)
  if (status === 'pago') {
    status = 'enviada'
    pago = true
  }
  if (!STATUS_OC_VALIDOS.includes(status as StatusOC)) status = 'pendente'
  return { status: status as StatusOC, pago }
}

function embedUm<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

/** Ordens de compra do fornecedor — usado no modal de detalhe. */
export async function getOrdensCompraPorFornecedor(
  fornecedorId: string,
  limit = 200,
): Promise<OrdemCompraHistoricoResumo[]> {
  await assertPermissao('ordens_compra', 'ver')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ordens_compra')
    .select(`
      id,
      codigo,
      sequencial_fornecedor,
      data_geracao,
      status,
      pago,
      itens:ordem_compra_itens(quantidade, preco_unitario),
      fila_reposicao(
        pedido:pedidos(codigo, sequencial, cliente:clientes(nome))
      )
    `)
    .eq('fornecedor_id', fornecedorId)
    .order('data_geracao', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const itens = (row.itens ?? []) as { quantidade: number; preco_unitario: number | null }[]
    const valor_total = itens.reduce(
      (s, it) => s + Number(it.quantidade) * (Number(it.preco_unitario) || 0),
      0,
    )
    const fila = embedUm(
      row.fila_reposicao as { pedido?: unknown } | { pedido?: unknown }[] | null,
    )
    const pedido = embedUm(
      fila?.pedido as
        | { codigo: string; sequencial: number | null; cliente?: { nome: string } | { nome: string }[] | null }
        | { codigo: string; sequencial: number | null; cliente?: { nome: string } | { nome: string }[] | null }[]
        | null,
    )
    const cliente = pedido?.cliente ? embedUm(pedido.cliente) : null
    const { status, pago } = normalizarStatusOCHistorico(row)
    return {
      id: row.id as string,
      codigo: row.codigo as string,
      sequencial_fornecedor: (row.sequencial_fornecedor as number | null) ?? null,
      data_geracao: row.data_geracao as string,
      status,
      pago,
      valor_total,
      pedido_codigo: pedido?.codigo ?? null,
      pedido_sequencial: pedido?.sequencial ?? null,
      cliente_nome: cliente?.nome ?? null,
    }
  })
}

type FornecedorInput = {
  nome: string
  telefone: string
  email: string
  tipo_documento: TipoDocumento
  documento: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  razao_social?: string
  ie?: string
  codigo_municipio_ibge?: string
}

function normalizarFornecedorPayload(input: FornecedorInput) {
  validarCamposObrigatoriosParceiro(input)

  const doc = apenasDigitos(input.documento)
  const cep = apenasDigitos(input.cep)
  const uf = input.uf.trim().toUpperCase()
  const ibge = apenasDigitos(input.codigo_municipio_ibge ?? '')

  return {
    nome: input.nome.trim(),
    telefone: input.telefone.trim(),
    email: input.email.trim(),
    tipo_documento: input.tipo_documento,
    documento: doc,
    cep,
    logradouro: input.logradouro.trim(),
    numero: input.numero.trim(),
    complemento: input.complemento.trim(),
    bairro: input.bairro.trim(),
    cidade: input.cidade.trim(),
    uf,
    razao_social: (input.razao_social ?? '').trim() || null,
    ie: (input.ie ?? '').trim(),
    codigo_municipio_ibge: ibge,
  }
}

export async function criarFornecedor(input: FornecedorInput) {
  await assertPermissao('fornecedores', 'criar')
  const supabase = await createClient()
  const row = normalizarFornecedorPayload(input)
  const { error } = await supabase.from('fornecedores').insert(row)
  if (error) throw new Error(error.message)
  await revalidateFornecedoresList()
}

export async function atualizarFornecedor(id: string, input: FornecedorInput) {
  await assertPermissao('fornecedores', 'editar')
  const supabase = await createClient()
  const row = normalizarFornecedorPayload(input)
  const { error } = await supabase.from('fornecedores').update(row).eq('id', id)
  if (error) throw new Error(error.message)
  await revalidateFornecedoresList()
}

export async function deletarFornecedor(id: string) {
  await assertPermissao('fornecedores', 'deletar')
  const supabase = await createClient()

  const { data: uso } = await supabase
    .from('materias_primas')
    .select('id')
    .eq('fornecedor_id', id)
    .limit(1)

  if (uso && uso.length > 0) {
    throw new Error('Este fornecedor possui matérias-primas vinculadas e não pode ser excluído.')
  }

  const { error } = await supabase.from('fornecedores').delete().eq('id', id)
  if (error) throw new Error(error.message)
  await revalidateFornecedoresList()
}
