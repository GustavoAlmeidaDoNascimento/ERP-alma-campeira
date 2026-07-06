'use server'

import { Prisma } from '@prisma/client'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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

type EntradaRow = {
  id: string
  descricao: string
  valor: Prisma.Decimal | number | string | null
  formaPagamento: string
  dataEntrada: Date | string
  categoria: string | null
  observacao: string | null
  usuarioId: string | null
  createdAt: Date | string
  usuario: { id: string; nome: string } | null
}

function numberFrom(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value == null) return 0
  if (typeof value === 'object' && 'toNumber' in value && typeof value.toNumber === 'function') {
    return value.toNumber()
  }
  return Number(value) || 0
}

function dateOnly(value: Date | string | null | undefined): string {
  if (!value) return ''
  return (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10)
}

function iso(value: Date | string | null | undefined): string {
  if (!value) return ''
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function parseDateOnly(value: string): Date {
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    throw new Error('Data da entrada inválida.')
  }
  return date
}

function mapEntradaRow(row: EntradaRow): Entrada {
  return {
    id: row.id,
    descricao: row.descricao,
    valor: numberFrom(row.valor),
    forma_pagamento: row.formaPagamento as FormaPagamento,
    data_entrada: dateOnly(row.dataEntrada),
    categoria: row.categoria,
    observacao: row.observacao,
    usuario_id: row.usuarioId,
    created_at: iso(row.createdAt),
    usuario: row.usuarioId && row.usuario
      ? {
          id: row.usuario.id,
          nome: row.usuario.nome,
        }
      : null,
  }
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
  const rows = await prisma.entrada.findMany({
    include: {
      usuario: {
        select: { id: true, nome: true },
      },
    },
    orderBy: [{ dataEntrada: 'desc' }, { createdAt: 'desc' }],
    take: 500,
  })
  return rows.map(mapEntradaRow)
}

export async function criarEntrada(input: EntradaInput) {
  await assertPermissao('gastos', 'criar')
  const usuario_id =
    input.usuario_id ?? (await requireAuthenticatedUserId().catch(() => null))
  const payload = normalizarEntradaPayload(input)
  await prisma.entrada.create({
    data: {
      descricao: payload.descricao,
      valor: payload.valor,
      formaPagamento: payload.forma_pagamento,
      dataEntrada: parseDateOnly(payload.data_entrada),
      categoria: payload.categoria,
      observacao: payload.observacao,
      usuarioId: usuario_id,
    },
  })
}

export async function atualizarEntrada(id: string, input: EntradaInput) {
  await assertPermissao('gastos', 'editar')
  const payload = normalizarEntradaPayload(input)
  const data: {
    descricao: string
    valor: number
    formaPagamento: FormaPagamento
    dataEntrada: Date
    categoria: string | null
    observacao: string | null
    usuarioId?: string | null
  } = {
    descricao: payload.descricao,
    valor: payload.valor,
    formaPagamento: payload.forma_pagamento,
    dataEntrada: parseDateOnly(payload.data_entrada),
    categoria: payload.categoria,
    observacao: payload.observacao,
  }

  if (input.usuario_id !== undefined) {
    data.usuarioId = input.usuario_id
  }

  await prisma.entrada.updateMany({
    where: { id },
    data,
  })
}

export async function deletarEntrada(id: string) {
  await assertPermissao('gastos', 'deletar')
  await prisma.entrada.deleteMany({
    where: { id },
  })
}
