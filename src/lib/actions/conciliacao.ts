'use server'

import { Prisma } from '@prisma/client'
import { assertPermissao, getAuthenticatedUser, requireAuthenticatedUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type NivelAlerta = 'ok' | 'divergencia'

/**
 * Integridade de estoque por faca.
 * Verifica se: estoque_atual = estoque_implicito_inicial + total_produzido - total_vendido
 * Se o estoque implícito inicial resultar negativo, há extravios não registrados.
 */
export type ConciliacaoFaca = {
  facaId: string
  facaCodigo: string
  facaNome: string
  estoqueAtual: number
  totalProduzido: number   // soma de movimentações tipo='entrada'
  totalVendido: number     // soma de movimentações tipo='saida_venda'
  saldoMovimentos: number  // totalProduzido - totalVendido
  estoqueInicialImplicito: number  // estoqueAtual - saldoMovimentos (deve ser >= 0)
  divergencia: number      // se < 0: há mais saídas registradas do que entradas, impossível
  nivel: NivelAlerta
  detalhe: string
}

/**
 * Consumo de MP vs produção registrada por faca.
 * Verifica se: para cada faca produzida, as MP consumidas batem com o BOM.
 */
export type ConciliacaoProducao = {
  facaId: string
  facaCodigo: string
  facaNome: string
  mpId: string
  mpCodigo: string
  mpNome: string
  totalProduzidoFaca: number   // entradas registradas da faca
  consumoEsperado: number      // totalProduzidoFaca × bom.quantidade
  consumoRegistrado: number    // saida_producao movements para faca+mp
  divergencia: number          // consumoRegistrado - consumoEsperado
  nivel: NivelAlerta
  detalhe: string
}

/**
 * Conciliação de vendas: pedidos entregues vs movimentações de saída.
 * Verifica se para todo pedido entregue há a movimentação correspondente.
 */
export type ConciliacaoVenda = {
  pedidoId: string
  pedidoCodigo: string
  facaId: string
  facaCodigo: string
  facaNome: string
  quantidadePedido: number
  quantidadeMovimento: number
  divergencia: number
  nivel: NivelAlerta
  detalhe: string
}

export type ResultadoConciliacao = {
  geradoEm: string
  tudoOk: boolean
  totalDivergencias: number
  facas: ConciliacaoFaca[]
  producao: ConciliacaoProducao[]
  vendas: ConciliacaoVenda[]
  resumo: {
    facasDivergentes: number
    producaoDivergente: number
    vendasDivergentes: number
  }
}

// ── Action ────────────────────────────────────────────────────────────────────

export async function getConciliacao(): Promise<ResultadoConciliacao> {
  await requireAuthenticatedUserId()
  await assertPermissao('metricas', 'ver')

  // Busca tudo em paralelo
  const [facas, movimentacoes, bom, pedidosEntregues, pedidoItens] = await Promise.all([
    prisma.faca.findMany({
      select: { id: true, codigo: true, nome: true, estoqueAtual: true },
    }),
    prisma.movimentacaoEstoque.findMany({
      select: {
        facaId: true,
        materiaPrimaId: true,
        pedidoId: true,
        tipo: true,
        quantidade: true,
      },
    }),
    prisma.facaMateriaPrima.findMany({
      select: {
        facaId: true,
        materiaPrimaId: true,
        quantidade: true,
        materiaPrima: {
          select: { id: true, codigo: true, nome: true },
        },
      },
    }),
    prisma.pedido.findMany({
      where: { status: 'entregue' },
      select: { id: true, codigo: true },
    }),
    prisma.pedidoItem.findMany({
      select: {
        pedidoId: true,
        facaId: true,
        quantidade: true,
        faca: {
          select: { id: true, codigo: true, nome: true },
        },
      },
    }),
  ])

  const movs = movimentacoes
  const bomItems = bom
  const pedidos = pedidosEntregues
  const itens = pedidoItens

  // ── 1. Integridade de estoque por faca ──────────────────────────────────────

  const resultFacas: ConciliacaoFaca[] = facas.map((faca) => {
    const movsFaca = movs.filter((m) => m.facaId === faca.id)

    const totalProduzido = movsFaca
      .filter((m) => m.tipo === 'entrada')
      .reduce((s, m) => s + Number(m.quantidade), 0)

    const totalVendido = movsFaca
      .filter((m) => m.tipo === 'saida_venda')
      .reduce((s, m) => s + Number(m.quantidade), 0)

    const saldoMovimentos = totalProduzido - totalVendido
    const estoqueInicialImplicito = Number(faca.estoqueAtual) - saldoMovimentos
    const divergencia = estoqueInicialImplicito  // deve ser >= 0

    const nivel: NivelAlerta = divergencia < 0 ? 'divergencia' : 'ok'
    const detalhe = divergencia < 0
      ? `Estoque impossível: ${Math.abs(divergencia)} unidade(s) saíram sem registro de produção ou venda correspondente.`
      : totalProduzido === 0 && totalVendido === 0
        ? 'Sem movimentações registradas — estoque inicial sem rastreio.'
        : 'Balanço consistente.'

    return {
      facaId: faca.id,
      facaCodigo: faca.codigo,
      facaNome: faca.nome,
      estoqueAtual: Number(faca.estoqueAtual),
      totalProduzido,
      totalVendido,
      saldoMovimentos,
      estoqueInicialImplicito,
      divergencia,
      nivel,
      detalhe,
    }
  })

  // ── 2. Consumo de MP vs produção registrada ─────────────────────────────────

  const resultProducao: ConciliacaoProducao[] = []

  for (const faca of facas) {
    const totalProduzidoFaca = movs
      .filter((m) => m.facaId === faca.id && m.tipo === 'entrada')
      .reduce((s, m) => s + Number(m.quantidade), 0)

    if (totalProduzidoFaca === 0) continue  // faca sem produção registrada — skip

    const bomFaca = bomItems.filter((b) => b.facaId === faca.id)

    for (const bomItem of bomFaca) {
      const mp = bomItem.materiaPrima
      if (!mp) continue

      const consumoEsperado = Math.round(totalProduzidoFaca * Number(bomItem.quantidade) * 1000) / 1000

      const consumoRegistrado = movs
        .filter(
          (m) =>
            m.facaId === faca.id &&
            m.materiaPrimaId === bomItem.materiaPrimaId &&
            m.tipo === 'saida_producao',
        )
        .reduce((s, m) => s + Number(m.quantidade), 0)

      const divergencia = Math.round((consumoRegistrado - consumoEsperado) * 1000) / 1000
      const nivel: NivelAlerta = divergencia !== 0 ? 'divergencia' : 'ok'
      const detalhe = divergencia < 0
        ? `Faltam ${Math.abs(divergencia)} unidade(s) de ${mp.codigo} — menos MP consumida do que o esperado pelo BOM.`
        : divergencia > 0
          ? `Excesso de ${divergencia} unidade(s) de ${mp.codigo} consumidas além do BOM.`
          : 'Consumo de MP consistente com a produção.'

      resultProducao.push({
        facaId: faca.id,
        facaCodigo: faca.codigo,
        facaNome: faca.nome,
        mpId: bomItem.materiaPrimaId,
        mpCodigo: mp.codigo,
        mpNome: mp.nome,
        totalProduzidoFaca,
        consumoEsperado,
        consumoRegistrado,
        divergencia,
        nivel,
        detalhe,
      })
    }
  }

  // ── 3. Conciliação de vendas ─────────────────────────────────────────────────

  const resultVendas: ConciliacaoVenda[] = []

  for (const pedido of pedidos) {
    const itensPedido = itens.filter((i) => i.pedidoId === pedido.id)

    for (const item of itensPedido) {
      const faca = item.faca

      const quantidadeMovimento = movs
        .filter(
          (m) =>
            m.pedidoId === pedido.id &&
            m.facaId === item.facaId &&
            m.tipo === 'saida_venda',
        )
        .reduce((s, m) => s + Number(m.quantidade), 0)

      const divergencia = quantidadeMovimento - Number(item.quantidade)
      const nivel: NivelAlerta = divergencia !== 0 ? 'divergencia' : 'ok'
      const detalhe = divergencia < 0
        ? `Pedido ${pedido.codigo}: ${Math.abs(divergencia)} unidade(s) entregue(s) sem movimentação de saída registrada.`
        : divergencia > 0
          ? `Pedido ${pedido.codigo}: ${divergencia} movimentação(ões) de saída a mais do que o pedido.`
          : 'Venda conciliada.'

      if (nivel === 'divergencia') {
        resultVendas.push({
          pedidoId: pedido.id,
          pedidoCodigo: pedido.codigo,
          facaId: item.facaId,
          facaCodigo: faca?.codigo ?? '?',
          facaNome: faca?.nome ?? '?',
          quantidadePedido: Number(item.quantidade),
          quantidadeMovimento,
          divergencia,
          nivel,
          detalhe,
        })
      }
    }
  }

  // ── Resumo ───────────────────────────────────────────────────────────────────

  const facasDivergentes = resultFacas.filter((f) => f.nivel === 'divergencia').length
  const producaoDivergente = resultProducao.filter((p) => p.nivel === 'divergencia').length
  const vendasDivergentes = resultVendas.filter((v) => v.nivel === 'divergencia').length
  const totalDivergencias = facasDivergentes + producaoDivergente + vendasDivergentes

  return {
    geradoEm: new Date().toISOString(),
    tudoOk: totalDivergencias === 0,
    totalDivergencias,
    facas: resultFacas,
    producao: resultProducao,
    vendas: resultVendas,
    resumo: { facasDivergentes, producaoDivergente, vendasDivergentes },
  }
}

export async function corrigirDivergenciaVenda(pedidoId: string, facaId: string): Promise<{ corrigido: number }> {
  await assertPermissao('vendas', 'editar')
  const [pedido, item, movs] = await Promise.all([
    prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: { id: true, status: true },
    }),
    prisma.pedidoItem.findFirst({
      where: { pedidoId, facaId },
      select: { pedidoId: true, facaId: true, quantidade: true },
    }),
    prisma.movimentacaoEstoque.findMany({
      where: { pedidoId, facaId, tipo: 'saida_venda' },
      select: { quantidade: true },
    }),
  ])

  if (!pedido) throw new Error('Pedido não encontrado.')
  if (pedido.status !== 'entregue') throw new Error('Somente pedidos entregues podem ser conciliados.')
  if (!item) throw new Error('Item do pedido não encontrado para esta faca.')

  const quantidadeMovimentoAtual = movs.reduce((s, m) => s + Number(m.quantidade ?? 0), 0)
  const faltante = Number(item.quantidade) - quantidadeMovimentoAtual

  if (faltante <= 0) {
    throw new Error('Não há baixa faltante para este item.')
  }

  const faca = await prisma.faca.findUnique({
    where: { id: facaId },
    select: { id: true, nome: true, estoqueAtual: true },
  })

  if (!faca) throw new Error('Faca não encontrada.')
  if (Number(faca.estoqueAtual) < faltante) {
    throw new Error(`Estoque insuficiente para corrigir (${faca.nome}): precisa ${faltante}, tem ${faca.estoqueAtual}.`)
  }

  const user = await getAuthenticatedUser()

  await prisma.$transaction(async (tx) => {
    await tx.movimentacaoEstoque.create({
      data: {
        tipo: 'saida_venda',
        facaId,
        pedidoId,
        quantidade: faltante,
        usuarioId: user?.id ?? null,
      },
    })

    await tx.faca.update({
      where: { id: facaId },
      data: {
        estoqueAtual: Number(faca.estoqueAtual) - faltante,
      },
    })
  })

  return { corrigido: faltante }
}
