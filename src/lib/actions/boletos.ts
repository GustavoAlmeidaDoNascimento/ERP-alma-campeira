'use server'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import { TIPO_GASTO_OUTROS, TIPO_GASTO_PAGAMENTO_OC } from '@/types'
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
  ordem_compra_id?: string | null
  pedido_id?: string | null
  parcelas: ParcelaInput[]
}

type DecimalLike = Prisma.Decimal | number | string | null | undefined

type ParcelaGastoSync = {
  pago_em: string | null
  valor_pago: number | null
  valor: number
}

function num(value: DecimalLike): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return value.toNumber()
}

function day(value: Date | string | null | undefined): string | null {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
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

  const numeros = new Set<number>()
  for (const p of parcelas) {
    if (!Number.isInteger(p.numero) || p.numero < 1) {
      throw new Error('Número de parcela inválido.')
    }
    if (numeros.has(p.numero)) throw new Error('Parcelas duplicadas.')
    numeros.add(p.numero)
    if (!Number.isFinite(p.valor) || p.valor < 0) throw new Error('Valor de parcela inválido.')
  }

  return {
    head: {
      tipo: input.tipo,
      contraparteNome: contraparte,
      cnpjCpf: (input.cnpj_cpf ?? '').toString().trim() || null,
      clienteId: input.tipo === 'entrada' ? input.cliente_id ?? null : null,
      fornecedorId: input.tipo === 'saida' ? input.fornecedor_id ?? null : null,
      vendedorId: input.tipo === 'entrada' ? input.vendedor_id ?? null : null,
      unidades: input.unidades != null && input.unidades > 0 ? Math.trunc(input.unidades) : null,
      numeroDocumento: (input.numero_documento ?? '').toString().trim() || null,
      valorTotal: valor_total,
      emitidoEm: input.emitido_em ? new Date(input.emitido_em) : null,
      observacao: (input.observacao ?? '').toString().trim() || null,
      ordemCompraId: input.ordem_compra_id ?? null,
      pedidoId: input.pedido_id ?? null,
    },
    parcelas: parcelas
      .sort((a, b) => a.numero - b.numero)
      .map((p) => ({
        numero: p.numero,
        vencimento: new Date(p.vencimento),
        valor: Number(p.valor),
        pagoEm: p.pago_em ? new Date(p.pago_em) : null,
        valorPago: p.valor_pago != null ? Number(p.valor_pago) : null,
      })),
  }
}

function mapBoleto(row: {
  id: string
  tipo: string
  sequencial: bigint | null
  contraparteNome: string
  cnpjCpf: string | null
  clienteId: string | null
  fornecedorId: string | null
  vendedorId: string | null
  unidades: number | null
  numeroDocumento: string | null
  valorTotal: DecimalLike
  emitidoEm: Date | null
  ordemCompraId: string | null
  pedidoId: string | null
  observacao: string | null
  criadoPor: string | null
  createdAt: Date
  updatedAt: Date
  parcelas: Array<{
    id: string
    boletoId: string
    numero: number
    vencimento: Date
    valor: DecimalLike
    pagoEm: Date | null
    valorPago: DecimalLike
    createdAt: Date
  }>
  cliente?: { id: string; nome: string } | null
  fornecedor?: { id: string; nome: string } | null
  vendedor?: { id: string; nome: string } | null
  criador?: { id: string; nome: string } | null
}): Boleto {
  return {
    id: row.id,
    tipo: row.tipo as BoletoTipo,
    sequencial: row.sequencial == null ? 0 : Number(row.sequencial),
    contraparte_nome: row.contraparteNome,
    cnpj_cpf: row.cnpjCpf,
    cliente_id: row.clienteId,
    fornecedor_id: row.fornecedorId,
    vendedor_id: row.vendedorId,
    unidades: row.unidades,
    numero_documento: row.numeroDocumento,
    valor_total: num(row.valorTotal),
    emitido_em: day(row.emitidoEm),
    ordem_compra_id: row.ordemCompraId,
    pedido_id: row.pedidoId,
    observacao: row.observacao,
    criado_por: row.criadoPor,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    parcelas: [...row.parcelas]
      .sort((a, b) => a.numero - b.numero)
      .map((parcela) => ({
        id: parcela.id,
        boleto_id: parcela.boletoId,
        numero: parcela.numero,
        vencimento: day(parcela.vencimento)!,
        valor: num(parcela.valor),
        pago_em: day(parcela.pagoEm),
        valor_pago: parcela.valorPago == null ? null : num(parcela.valorPago),
        created_at: parcela.createdAt.toISOString(),
      })),
    cliente: row.cliente ?? null,
    fornecedor: row.fornecedor ?? null,
    vendedor: row.vendedor ?? null,
    criador: row.criador ?? null,
  }
}

async function nextSequencial(tx: Prisma.TransactionClient, tipo: BoletoTipo): Promise<number> {
  const agg = await tx.boleto.aggregate({
    where: { tipo },
    _max: { sequencial: true },
  })
  return Number(agg._max.sequencial ?? 0) + 1
}

export async function listarBoletos(tipo?: BoletoTipo): Promise<Boleto[]> {
  await assertPermissao('boletos', 'ver')
  const rows = await prisma.boleto.findMany({
    where: tipo ? { tipo } : undefined,
    include: {
      parcelas: true,
      cliente: { select: { id: true, nome: true } },
      fornecedor: { select: { id: true, nome: true } },
      vendedor: { select: { id: true, nome: true } },
      criador: { select: { id: true, nome: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })

  return rows.map(mapBoleto)
}

export async function criarBoleto(input: BoletoInput): Promise<string> {
  await assertPermissao('boletos', 'criar')
  const { head, parcelas } = normalizar(input)
  const criadoPor = await requireAuthenticatedUserId().catch(() => null)

  return prisma.$transaction(async (tx) => {
    const sequencial = await nextSequencial(tx, input.tipo)
    const boleto = await tx.boleto.create({
      data: {
        ...head,
        criadoPor,
        sequencial,
      },
      select: { id: true },
    })

    const parcelasInseridas = []
    for (const parcela of parcelas) {
      const criada = await tx.boletoParcela.create({
        data: {
          boletoId: boleto.id,
          numero: parcela.numero,
          vencimento: parcela.vencimento,
          valor: parcela.valor,
          pagoEm: parcela.pagoEm,
          valorPago: parcela.valorPago,
        },
        select: { id: true, pagoEm: true, valorPago: true, valor: true },
      })
      parcelasInseridas.push(criada)
    }

    for (const parcela of parcelasInseridas) {
      if (parcela.pagoEm) {
        await criarGastoDaParcela(
          tx,
          boleto.id,
          parcela.id,
          day(parcela.pagoEm)!,
          num(parcela.valorPago ?? parcela.valor),
          criadoPor,
        )
      }
    }
    return boleto.id
  })
}

export async function atualizarBoleto(id: string, input: BoletoInput) {
  await assertPermissao('boletos', 'editar')
  const { head, parcelas } = normalizar(input)
  const uid = await requireAuthenticatedUserId().catch(() => null)

  await prisma.$transaction(async (tx) => {
    await tx.boleto.update({
      where: { id },
      data: {
        ...head,
        updatedAt: new Date(),
      },
    })

    const atuais = await tx.boletoParcela.findMany({
      where: { boletoId: id },
      select: { id: true, numero: true, vencimento: true, valor: true, pagoEm: true, valorPago: true },
    })

    const atuaisPorNumero = new Map(atuais.map((p) => [Number(p.numero), p]))
    const numerosNovos = new Set<number>()

    for (const parcela of parcelas) {
      numerosNovos.add(parcela.numero)
      const atual = atuaisPorNumero.get(parcela.numero)

      if (!atual) {
        const nova = await tx.boletoParcela.create({
          data: {
            boletoId: id,
            numero: parcela.numero,
            vencimento: parcela.vencimento,
            valor: parcela.valor,
            pagoEm: parcela.pagoEm,
            valorPago: parcela.valorPago,
          },
          select: { id: true },
        })
        if (parcela.pagoEm) {
          await criarGastoDaParcela(tx, id, nova.id, day(parcela.pagoEm)!, Number(parcela.valorPago ?? parcela.valor), uid)
        }
        continue
      }

      const estavaPago = !!atual.pagoEm
      const ficouPago = !!parcela.pagoEm
      const mudou =
        day(atual.vencimento) !== day(parcela.vencimento) ||
        num(atual.valor) !== Number(parcela.valor) ||
        estavaPago !== ficouPago ||
        num(atual.valorPago ?? 0) !== Number(parcela.valorPago ?? 0)

      if (!mudou) continue

      await tx.boletoParcela.update({
        where: { id: atual.id },
        data: {
          vencimento: parcela.vencimento,
          valor: parcela.valor,
          pagoEm: parcela.pagoEm,
          valorPago: parcela.valorPago,
        },
      })

      await sincronizarGastoParcela(tx, id, atual.id, estavaPago, ficouPago, {
        pago_em: day(parcela.pagoEm),
        valor_pago: parcela.valorPago != null ? Number(parcela.valorPago) : null,
        valor: Number(parcela.valor),
      }, uid)
    }

    const removidos = atuais.filter((p) => !numerosNovos.has(Number(p.numero)))
    if (removidos.length > 0) {
      for (const parcela of removidos) {
        await removerGastoDaParcela(tx, parcela.id)
      }
      await tx.boletoParcela.deleteMany({
        where: { id: { in: removidos.map((p) => p.id) } },
      })
    }
  })
}

export async function deletarBoleto(id: string) {
  await assertPermissao('boletos', 'deletar')
  await prisma.boleto.delete({ where: { id } })
}

export async function marcarParcela(
  parcela_id: string,
  pago: boolean,
  opts?: { pago_em?: string; valor_pago?: number },
) {
  await assertPermissao('boletos', 'editar')
  const uid = await requireAuthenticatedUserId().catch(() => null)

  await prisma.$transaction(async (tx) => {
    const parcela = await tx.boletoParcela.findUnique({
      where: { id: parcela_id },
      select: { id: true, boletoId: true, valor: true },
    })
    if (!parcela) throw new Error('Parcela não encontrada.')

    if (pago) {
      const pagoEm = opts?.pago_em ?? new Date().toISOString().slice(0, 10)
      const valorPago = opts?.valor_pago ?? num(parcela.valor)

      await tx.boletoParcela.update({
        where: { id: parcela_id },
        data: {
          pagoEm: new Date(pagoEm),
          valorPago,
        },
      })

      await criarGastoDaParcela(tx, parcela.boletoId, parcela_id, pagoEm, valorPago, uid)
      return
    }

    await tx.boletoParcela.update({
      where: { id: parcela_id },
      data: { pagoEm: null, valorPago: null },
    })

    await removerGastoDaParcela(tx, parcela_id)
  })
}

async function removerGastoDaParcela(tx: Prisma.TransactionClient, parcelaId: string) {
  await tx.gasto.deleteMany({
    where: { boletoParcelaId: parcelaId },
  })
}

async function sincronizarGastoParcela(
  tx: Prisma.TransactionClient,
  boletoId: string,
  parcelaId: string,
  estavaPago: boolean,
  ficouPago: boolean,
  parcela: ParcelaGastoSync,
  usuarioId: string | null,
) {
  if (!estavaPago && ficouPago && parcela.pago_em) {
    await criarGastoDaParcela(tx, boletoId, parcelaId, parcela.pago_em, Number(parcela.valor_pago ?? parcela.valor), usuarioId)
    return
  }
  if (estavaPago && !ficouPago) {
    await removerGastoDaParcela(tx, parcelaId)
    return
  }
  if (estavaPago && ficouPago && parcela.pago_em) {
    const existente = await tx.gasto.findFirst({
      where: { boletoParcelaId: parcelaId },
      select: { id: true },
    })
    if (!existente) {
      await criarGastoDaParcela(tx, boletoId, parcelaId, parcela.pago_em, Number(parcela.valor_pago ?? parcela.valor), usuarioId)
      return
    }
    await tx.gasto.updateMany({
      where: { boletoParcelaId: parcelaId },
      data: {
        valor: Number(parcela.valor_pago ?? parcela.valor),
        dataGasto: new Date(parcela.pago_em),
      },
    })
  }
}

async function criarGastoDaParcela(
  tx: Prisma.TransactionClient,
  boletoId: string,
  parcelaId: string,
  pagoEm: string,
  valorPago: number,
  usuarioId: string | null,
) {
  const existing = await tx.gasto.findFirst({
    where: { boletoParcelaId: parcelaId },
    select: { id: true },
  })
  if (existing) return

  const parcela = await tx.boletoParcela.findUnique({
    where: { id: parcelaId },
    select: { numero: true },
  })
  if (!parcela) return

  const boleto = await tx.boleto.findUnique({
    where: { id: boletoId },
    select: {
      tipo: true,
      contraparteNome: true,
      ordemCompraId: true,
      ordemCompra: {
        select: { codigo: true },
      },
    },
  })
  if (!boleto || boleto.tipo !== 'saida') return

  let descricao = `Boleto parcela ${parcela.numero} - ${boleto.contraparteNome}`
  let tipo: string = TIPO_GASTO_OUTROS

  if (boleto.ordemCompraId && boleto.ordemCompra?.codigo) {
    descricao = `Pagamento OC ${boleto.ordemCompra.codigo} - parcela ${parcela.numero} - ${boleto.contraparteNome}`
    tipo = TIPO_GASTO_PAGAMENTO_OC
  }

  await tx.gasto.create({
    data: {
      tipo,
      descricao,
      valor: valorPago,
      formaPagamento: 'boleto',
      dataGasto: new Date(pagoEm),
      ordemCompraId: boleto.ordemCompraId ?? null,
      boletoParcelaId: parcelaId,
      usuarioId,
    },
  })
}
