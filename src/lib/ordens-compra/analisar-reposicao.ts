import { prisma } from '@/lib/prisma'

export type ResultadoAnalise = {
  criouFila: boolean
  quantidadeItens: number
}

/**
 * Analisa a necessidade de reposicao de MPs para um pedido entregue.
 */
export async function analisarReposicaoParaPedido(
  pedido_id: string,
): Promise<ResultadoAnalise> {
  const filaExistente = await prisma.filaReposicao.findFirst({
    where: { pedidoId: pedido_id },
    select: {
      id: true,
      itens: {
        select: { id: true },
      },
    },
  })

  if (filaExistente) {
    return { criouFila: false, quantidadeItens: filaExistente.itens.length }
  }

  const pedidoItens = await prisma.pedidoItem.findMany({
    where: { pedidoId: pedido_id },
    select: { facaId: true, quantidade: true },
  })

  if (pedidoItens.length === 0) return { criouFila: false, quantidadeItens: 0 }

  const facaIds = [...new Set(pedidoItens.map((item) => item.facaId))]

  const boms = await prisma.facaMateriaPrima.findMany({
    where: { facaId: { in: facaIds } },
    select: {
      facaId: true,
      materiaPrimaId: true,
      quantidade: true,
      materiaPrima: {
        select: {
          id: true,
          codigo: true,
          nome: true,
          precoCusto: true,
          estoqueAtual: true,
          estoqueMinimo: true,
          fornecedorId: true,
          fornecedor: {
            select: { id: true, nome: true },
          },
        },
      },
    },
  })

  if (boms.length === 0) return { criouFila: false, quantidadeItens: 0 }

  type MpInfo = {
    id: string
    estoque_atual: number
    estoque_minimo: number
  }

  const mpMap = new Map<string, MpInfo>()
  for (const bom of boms) {
    const mp = bom.materiaPrima
    if (!mp || mpMap.has(mp.id)) continue

    mpMap.set(mp.id, {
      id: mp.id,
      estoque_atual: mp.estoqueAtual.toNumber(),
      estoque_minimo: mp.estoqueMinimo.toNumber(),
    })
  }

  const mpsBaixas = [...mpMap.values()].filter((mp) => mp.estoque_atual < mp.estoque_minimo)
  if (mpsBaixas.length === 0) return { criouFila: false, quantidadeItens: 0 }

  const mpIdsParaVerificar = mpsBaixas.map((mp) => mp.id)

  const todasFacasComMp = await prisma.facaMateriaPrima.findMany({
    where: { materiaPrimaId: { in: mpIdsParaVerificar } },
    select: {
      materiaPrimaId: true,
      quantidade: true,
      faca: {
        select: {
          id: true,
          nome: true,
          estoqueAtual: true,
          estoqueMinimo: true,
        },
      },
    },
  })

  type FacaInfo = {
    estoque_atual: number
    estoque_minimo: number
  }

  const facasPorMp = new Map<string, FacaInfo[]>()
  for (const row of todasFacasComMp) {
    const list = facasPorMp.get(row.materiaPrimaId) ?? []
    list.push({
      estoque_atual: Number(row.faca.estoqueAtual),
      estoque_minimo: Number(row.faca.estoqueMinimo),
    })
    facasPorMp.set(row.materiaPrimaId, list)
  }

  const itensSugeridos: Array<{ materia_prima_id: string; quantidade_sugerida: number }> = []

  for (const mp of mpsBaixas) {
    const facas = facasPorMp.get(mp.id) ?? []
    const algumFacaAbaixoMinimo = facas.some((f) => f.estoque_atual < f.estoque_minimo)
    if (!algumFacaAbaixoMinimo) continue

    itensSugeridos.push({
      materia_prima_id: mp.id,
      quantidade_sugerida: mp.estoque_minimo - mp.estoque_atual,
    })
  }

  if (itensSugeridos.length === 0) return { criouFila: false, quantidadeItens: 0 }

  await prisma.$transaction(async (tx) => {
    const filaExistenteTx = await tx.filaReposicao.findFirst({
      where: { pedidoId: pedido_id },
      select: { id: true },
    })

    if (filaExistenteTx) return

    const fila = await tx.filaReposicao.create({
      data: {
        pedidoId: pedido_id,
        status: 'pendente',
      },
      select: { id: true },
    })

    await tx.filaReposicaoItem.createMany({
      data: itensSugeridos.map((item) => ({
        filaId: fila.id,
        materiaPrimaId: item.materia_prima_id,
        quantidadeSugerida: item.quantidade_sugerida,
        quantidadeAdicional: 0,
        selecionado: true,
      })),
    })
  })

  return { criouFila: true, quantidadeItens: itensSugeridos.length }
}
