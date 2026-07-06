'use server'

import { Prisma } from '@prisma/client'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Consumivel, Fornecedor } from '@/types'
import { gerarCodigoForte } from '@/lib/utils/codigo'

type ConsumivelRow = {
  id: string
  codigo: string
  sku: string
  nome: string
  categoria: string
  fornecedorId: string | null
  fotoUrl: string | null
  precoCusto: Prisma.Decimal | number | string | null
  estoqueAtual: Prisma.Decimal | number | string | null
  estoqueMinimo: Prisma.Decimal | number | string | null
  createdAt: Date | string
  fornecedor: {
    id: string
    nome: string
    telefone: string | null
    email: string | null
    createdAt: Date
    tipoDocumento: 'cnpj' | 'cpf'
    documento: string | null
    cep: string | null
    logradouro: string | null
    numero: string | null
    complemento: string | null
    bairro: string | null
    cidade: string | null
    uf: string | null
    razaoSocial: string | null
    ie: string | null
    codigoMunicipioIbge: string | null
  } | null
}

function numberFrom(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value == null) return 0
  if (typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
    return value.toNumber()
  }
  return Number(value) || 0
}

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(Number.isFinite(value) ? value : 0)
}

function isoFrom(value: Date | string | null): string {
  if (!value) return ''
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

function mapFornecedorRow(row: ConsumivelRow): Fornecedor | null {
  if (!row.fornecedor) return null
  return {
    id: row.fornecedor.id,
    nome: row.fornecedor.nome,
    telefone: row.fornecedor.telefone,
    email: row.fornecedor.email,
    tipo_documento: row.fornecedor.tipoDocumento ?? 'cnpj',
    documento: row.fornecedor.documento,
    cep: row.fornecedor.cep,
    logradouro: row.fornecedor.logradouro,
    numero: row.fornecedor.numero,
    complemento: row.fornecedor.complemento,
    bairro: row.fornecedor.bairro,
    cidade: row.fornecedor.cidade,
    uf: row.fornecedor.uf,
    razao_social: row.fornecedor.razaoSocial,
    ie: row.fornecedor.ie,
    codigo_municipio_ibge: row.fornecedor.codigoMunicipioIbge,
    created_at: isoFrom(row.fornecedor.createdAt),
  }
}

function mapConsumivelRow(row: ConsumivelRow): Consumivel {
  return {
    id: row.id,
    codigo: row.codigo,
    sku: row.sku,
    nome: row.nome,
    categoria: row.categoria,
    fornecedor_id: row.fornecedorId,
    foto_url: row.fotoUrl,
    preco_custo: numberFrom(row.precoCusto),
    estoque_atual: numberFrom(row.estoqueAtual),
    estoque_minimo: numberFrom(row.estoqueMinimo),
    created_at: isoFrom(row.createdAt),
    fornecedor: mapFornecedorRow(row),
  }
}

export async function getConsumiveis(limit = 120): Promise<Consumivel[]> {
  await assertPermissao('consumiveis', 'ver')
  const rows = await prisma.consumivel.findMany({
    include: {
      fornecedor: {
        select: {
          id: true,
          nome: true,
          telefone: true,
          email: true,
          createdAt: true,
          tipoDocumento: true,
          documento: true,
          cep: true,
          logradouro: true,
          numero: true,
          complemento: true,
          bairro: true,
          cidade: true,
          uf: true,
          razaoSocial: true,
          ie: true,
          codigoMunicipioIbge: true,
        },
      },
    },
    orderBy: { codigo: 'asc' },
    take: limit,
  })
  return rows.map(mapConsumivelRow)
}

export async function gerarCodigoConsumivel(): Promise<string> {
  return gerarCodigoForte('CN')
}

export async function deletarConsumivel(id: string) {
  await assertPermissao('consumiveis', 'deletar')
  await prisma.consumivel.deleteMany({
    where: { id },
  })
}

// ============================================================
// Entrada / baixa de estoque — Consumíveis
// ============================================================

export async function entradaEstoqueConsumivel(
  consumivelId: string,
  quantidade: number,
  observacao?: string
): Promise<void> {
  await assertPermissao('consumiveis', 'editar')

  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new Error('Quantidade deve ser maior que zero.')
  }
  if (!Number.isInteger(quantidade)) {
    throw new Error('Quantidade deve ser um número inteiro.')
  }

  const userId = await requireAuthenticatedUserId()
  await prisma.$transaction(async (tx) => {
    const row = await tx.consumivel.findUnique({
      where: { id: consumivelId },
      select: { id: true, estoqueAtual: true },
    })
    if (!row) throw new Error('Consumível não encontrado.')

    const novoEstoque = round3(numberFrom(row.estoqueAtual) + quantidade)

    await tx.movimentacaoEstoque.create({
      data: {
        tipo: 'entrada',
        consumivelId,
        quantidade,
        observacao: observacao?.trim() || null,
        usuarioId: userId,
      },
    })

    await tx.consumivel.update({
      where: { id: consumivelId },
      data: { estoqueAtual: decimal(novoEstoque) },
    })
  })

}

export async function baixaEstoqueConsumivel(
  consumivelId: string,
  quantidade: number,
  observacao?: string
): Promise<void> {
  await assertPermissao('consumiveis', 'editar')

  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new Error('Quantidade deve ser maior que zero.')
  }
  if (!Number.isInteger(quantidade)) {
    throw new Error('Quantidade deve ser um número inteiro.')
  }

  const userId = await requireAuthenticatedUserId()
  await prisma.$transaction(async (tx) => {
    const row = await tx.consumivel.findUnique({
      where: { id: consumivelId },
      select: { id: true, estoqueAtual: true },
    })
    if (!row) throw new Error('Consumível não encontrado.')

    const atual = numberFrom(row.estoqueAtual)
    if (quantidade > atual) {
      throw new Error('Quantidade maior que o estoque disponível.')
    }

    const novoEstoque = round3(atual - quantidade)

    await tx.movimentacaoEstoque.create({
      data: {
        tipo: 'saida_consumivel',
        consumivelId,
        quantidade,
        observacao: observacao?.trim() || null,
        usuarioId: userId,
      },
    })

    await tx.consumivel.update({
      where: { id: consumivelId },
      data: { estoqueAtual: decimal(novoEstoque) },
    })
  })

}
