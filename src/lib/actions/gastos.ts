'use server'

import { Prisma } from '@prisma/client'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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

type GastoRow = {
  id: string
  tipo: string
  descricao: string
  valor: Prisma.Decimal | number | string | null
  formaPagamento: string
  dataGasto: Date | string
  ordemCompraId: string | null
  boletoParcelaId: string | null
  observacao: string | null
  usuarioId: string | null
  createdAt: Date | string
  ordemCompra: { id: string; codigo: string } | null
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

function mapGastoRow(row: GastoRow): Gasto {
  return {
    id: row.id,
    tipo: row.tipo as TipoGasto,
    descricao: row.descricao,
    valor: numberFrom(row.valor),
    forma_pagamento: row.formaPagamento as FormaPagamento,
    data_gasto: dateOnly(row.dataGasto),
    ordem_compra_id: row.ordemCompraId,
    boleto_parcela_id: row.boletoParcelaId,
    observacao: row.observacao,
    usuario_id: row.usuarioId,
    created_at: iso(row.createdAt),
    ordem_compra: row.ordemCompra,
    usuario: row.usuario,
  }
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

/** Normaliza para comparar tags sem caixa/acento (evita duplicatas). */
function normalizarNome(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
}

/**
 * Resolve o tipo do gasto para o nome canônico da tag: se já existir uma tag
 * equivalente (ignorando caixa/acentos), reutiliza o nome dela; senão, cria a
 * tag. Mantém o catálogo coerente e evita duplicatas por diferença de grafia.
 */
async function resolverTipoGasto(
  db: Prisma.TransactionClient | typeof prisma,
  nome: string
): Promise<string> {
  const data = await db.tipoGastoTag.findMany({
    select: { nome: true },
  })
  const alvo = normalizarNome(nome)
  const existente = (data ?? []).find((t) => normalizarNome(t.nome) === alvo)
  if (existente) return existente.nome
  await db.tipoGastoTag.create({
    data: { nome, sistema: false },
  })
  return nome
}

export async function listarGastos(): Promise<Gasto[]> {
  await assertPermissao('gastos', 'ver')
  const rows = await prisma.gasto.findMany({
    include: {
      ordemCompra: {
        select: { id: true, codigo: true },
      },
      usuario: {
        select: { id: true, nome: true },
      },
    },
    orderBy: [{ dataGasto: 'desc' }, { createdAt: 'desc' }],
    take: 500,
  })
  return rows.map(mapGastoRow)
}

export async function criarGasto(input: GastoInput) {
  await assertPermissao('gastos', 'criar')
  // usuario_id vem do select "Quem está registrando" do modal; cai pro autenticado se não vier.
  const usuario_id =
    input.usuario_id ?? (await requireAuthenticatedUserId().catch(() => null))
  const payload = normalizarGastoPayload(input)
  await prisma.$transaction(async (tx) => {
    const tipo = await resolverTipoGasto(tx, payload.tipo)
    await tx.gasto.create({
      data: {
        tipo,
        descricao: payload.descricao,
        valor: new Prisma.Decimal(payload.valor),
        formaPagamento: payload.forma_pagamento,
        dataGasto: new Date(`${payload.data_gasto}T00:00:00.000Z`),
        observacao: payload.observacao,
        ordemCompraId: payload.ordem_compra_id,
        usuarioId: usuario_id,
      },
    })
  })
}

export async function atualizarGasto(id: string, input: GastoInput) {
  await assertPermissao('gastos', 'editar')
  const payload = normalizarGastoPayload(input)
  await prisma.$transaction(async (tx) => {
    const tipo = await resolverTipoGasto(tx, payload.tipo)
    await tx.gasto.update({
      where: { id },
      data: {
        tipo,
        descricao: payload.descricao,
        valor: new Prisma.Decimal(payload.valor),
        formaPagamento: payload.forma_pagamento,
        dataGasto: new Date(`${payload.data_gasto}T00:00:00.000Z`),
        observacao: payload.observacao,
        ordemCompraId: payload.ordem_compra_id,
        ...(input.usuario_id !== undefined ? { usuarioId: input.usuario_id } : {}),
      },
    })
  })
}

export async function deletarGasto(id: string) {
  await assertPermissao('gastos', 'deletar')
  await prisma.gasto.delete({ where: { id } })
}
