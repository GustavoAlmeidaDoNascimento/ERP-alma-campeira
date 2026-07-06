'use server'

import { revalidateTag } from 'next/cache'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import { fetchClientesList } from '@/lib/cache/list-data'
import { prisma } from '@/lib/prisma'
import { mapPedidoHistoricoResumo } from '@/lib/prisma-auth-mappers'
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
  const data = await prisma.pedido.findMany({
    where: { clienteId },
    select: {
      id: true,
      codigo: true,
      sequencial: true,
      dataPedido: true,
      status: true,
      valorTotal: true,
      vendedor: {
        select: { nome: true },
      },
    },
    orderBy: [{ dataPedido: 'desc' }, { createdAt: 'desc' }],
    take: limit,
  })

  return data.map((pedido) => ({
    ...mapPedidoHistoricoResumo(pedido),
    status: normalizeStatusPedidoHistorico(String(pedido.status)),
  }))
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
  const row = normalizarClientePayload(input)
  await prisma.cliente.create({
    data: {
      nome: row.nome,
      tipo: row.tipo,
      telefone: row.telefone || null,
      email: row.email || null,
      tipoDocumento: row.tipo_documento,
      documento: row.documento || null,
      cep: row.cep || null,
      logradouro: row.logradouro || null,
      numero: row.numero || null,
      complemento: row.complemento,
      bairro: row.bairro || null,
      cidade: row.cidade || null,
      estado: row.estado || null,
      razaoSocial: row.razao_social,
      ie: row.ie || null,
      indicadorIe: row.indicador_ie,
      codigoMunicipioIbge: row.codigo_municipio_ibge || null,
    },
  })
  await revalidateClientesList()
}

export async function atualizarCliente(id: string, input: ClienteInput) {
  await assertPermissao('clientes', 'editar')
  const row = normalizarClientePayload(input)
  await prisma.cliente.update({
    where: { id },
    data: {
      nome: row.nome,
      tipo: row.tipo,
      telefone: row.telefone || null,
      email: row.email || null,
      tipoDocumento: row.tipo_documento,
      documento: row.documento || null,
      cep: row.cep || null,
      logradouro: row.logradouro || null,
      numero: row.numero || null,
      complemento: row.complemento,
      bairro: row.bairro || null,
      cidade: row.cidade || null,
      estado: row.estado || null,
      razaoSocial: row.razao_social,
      ie: row.ie || null,
      indicadorIe: row.indicador_ie,
      codigoMunicipioIbge: row.codigo_municipio_ibge || null,
    },
  })
  await revalidateClientesList()
}

export async function deletarCliente(id: string) {
  await assertPermissao('clientes', 'deletar')
  const uso = await prisma.pedido.findFirst({
    where: { clienteId: id },
    select: { id: true },
  })

  if (uso) {
    throw new Error('Este cliente possui vendas vinculadas e não pode ser excluído.')
  }

  await prisma.cliente.delete({ where: { id } })
  await revalidateClientesList()
}
