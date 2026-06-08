'use server'

import { revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import { fetchClientesList } from '@/lib/cache/list-data'
import type { Cliente, PedidoHistoricoResumo, StatusPedido, TipoDocumento } from '@/types'
import { apenasDigitos } from '@/lib/br/documento'
import { validarCamposObrigatoriosCliente } from '@/lib/br/validar-cadastro-parceiro'

async function revalidateClientesList() {
  try {
    const userId = await requireAuthenticatedUserId()
    revalidateTag(`list-clientes-${userId}`, 'max')
  } catch {}
}

export async function getClientes(limit = 50): Promise<Cliente[]> {
  const userId = await requireAuthenticatedUserId()
  await assertPermissao('clientes', 'ver')
  const rows = await fetchClientesList(userId)
  return rows.slice(0, limit)
}

function normalizeStatusPedidoHistorico(status: string): StatusPedido {
  if (status === 'em_espera' || status === 'em_producao' || status === 'entregue') return status
  if (status === 'orcamento' || status === 'confirmado') return 'em_espera'
  if (status === 'cancelado') return 'entregue'
  return 'em_espera'
}

/** Vendas (pedidos) vinculadas ao cliente — usado no modal de detalhe. */
export async function getPedidosPorCliente(clienteId: string, limit = 200): Promise<PedidoHistoricoResumo[]> {
  await assertPermissao('vendas', 'ver')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select('id, codigo, sequencial, data_pedido, status, valor_total, vendedor:usuarios_perfis(nome)')
    .eq('cliente_id', clienteId)
    .order('data_pedido', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)

  return (data ?? []).map((row) => {
    const vendedor = row.vendedor as { nome: string } | { nome: string }[] | null
    const vendedorNome = Array.isArray(vendedor) ? vendedor[0]?.nome : vendedor?.nome
    return {
      id: row.id as string,
      codigo: row.codigo as string,
      sequencial: (row.sequencial as number | null) ?? null,
      data_pedido: row.data_pedido as string,
      status: normalizeStatusPedidoHistorico(String(row.status)),
      valor_total: (row.valor_total as number | null) ?? null,
      vendedor_nome: vendedorNome ?? null,
    }
  })
}

type ClienteInput = {
  nome: string
  tipo: string
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
  estado: string
  razao_social?: string
  ie?: string
  indicador_ie?: number
  codigo_municipio_ibge?: string
}

function normalizarClientePayload(input: ClienteInput) {
  validarCamposObrigatoriosCliente({
    nome: input.nome,
    tipo: input.tipo,
    indicador_ie: input.indicador_ie,
    telefone: input.telefone,
    email: input.email,
    tipo_documento: input.tipo_documento,
    documento: input.documento,
    cep: input.cep,
    logradouro: input.logradouro,
    numero: input.numero,
    complemento: input.complemento,
    bairro: input.bairro,
    cidade: input.cidade,
    uf: input.estado,
    razao_social: input.razao_social,
    ie: input.ie,
    codigo_municipio_ibge: input.codigo_municipio_ibge,
  })

  const doc = apenasDigitos(input.documento)
  const cep = apenasDigitos(input.cep)
  const estado = input.estado.trim().toUpperCase()
  const ibge = apenasDigitos(input.codigo_municipio_ibge ?? '')
  const indIE = Number(input.indicador_ie) as 1 | 2 | 9

  return {
    nome: input.nome.trim(),
    tipo: input.tipo.trim(),
    telefone: input.telefone.trim(),
    email: input.email.trim(),
    tipo_documento: input.tipo_documento,
    documento: doc,
    cep,
    logradouro: input.logradouro.trim(),
    numero: input.numero.trim(),
    complemento: input.complemento.trim() || null,
    bairro: input.bairro.trim(),
    cidade: input.cidade.trim(),
    estado,
    razao_social: (input.razao_social ?? '').trim() || null,
    ie: (input.ie ?? '').trim(),
    indicador_ie: indIE,
    codigo_municipio_ibge: ibge,
  }
}

export async function criarCliente(input: ClienteInput) {
  await assertPermissao('clientes', 'criar')
  const supabase = await createClient()
  const row = normalizarClientePayload(input)
  const { error } = await supabase.from('clientes').insert(row)
  if (error) throw new Error(error.message)
  await revalidateClientesList()
}

export async function atualizarCliente(id: string, input: ClienteInput) {
  await assertPermissao('clientes', 'editar')
  const supabase = await createClient()
  const row = normalizarClientePayload(input)
  const { error } = await supabase.from('clientes').update(row).eq('id', id)
  if (error) throw new Error(error.message)
  await revalidateClientesList()
}

export async function deletarCliente(id: string) {
  await assertPermissao('clientes', 'deletar')
  const supabase = await createClient()

  const { data: uso } = await supabase
    .from('pedidos')
    .select('id')
    .eq('cliente_id', id)
    .limit(1)

  if (uso && uso.length > 0) {
    throw new Error('Este cliente possui vendas vinculadas e não pode ser excluído.')
  }

  const { error } = await supabase.from('clientes').delete().eq('id', id)
  if (error) throw new Error(error.message)
  await revalidateClientesList()
}
