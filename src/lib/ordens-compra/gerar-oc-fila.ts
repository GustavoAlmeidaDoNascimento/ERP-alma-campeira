'use server'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { gerarCodigoForte } from '@/lib/utils/codigo'

export async function gerarCodigoOC(): Promise<string> {
  return gerarCodigoForte('OC')
}

async function nextSequencialFornecedor(
  tx: Prisma.TransactionClient,
  fornecedorId: string | null,
): Promise<number> {
  const agregado = await tx.ordemCompra.aggregate({
    where: { fornecedorId },
    _max: { sequencialFornecedor: true },
  })

  return (agregado._max.sequencialFornecedor ?? 0) + 1
}

/**
 * Gera OCs a partir dos itens selecionados de uma entrada da fila de reposição.
 * Agrupa os itens por categoria e fornecedor, garantindo categoria única por OC.
 * Ao final, marca a fila como 'convertida'.
 */
export async function gerarOCsDeFilaItens(
  filaId: string,
  registroUsuarioId: string,
): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const fila = await tx.filaReposicao.findUnique({
      where: { id: filaId },
      select: {
        id: true,
        status: true,
        ordensCompra: {
          select: { id: true },
        },
      },
    })

    if (!fila) throw new Error('Fila de reposição não encontrada.')
    if (fila.status !== 'pendente') {
      throw new Error('Esta fila não está mais pendente e não pode gerar novas OCs.')
    }
    if (fila.ordensCompra.length > 0) {
      throw new Error('Esta fila já possui ordens de compra geradas.')
    }

    const itens = await tx.filaReposicaoItem.findMany({
      where: { filaId, selecionado: true },
      select: {
        materiaPrimaId: true,
        quantidadeSugerida: true,
        quantidadeAdicional: true,
        materiaPrima: {
          select: {
            id: true,
            categoria: true,
            precoCusto: true,
            fornecedorId: true,
          },
        },
      },
    })

    if (itens.length === 0) throw new Error('Nenhum item selecionado para gerar OC.')

    type GrupoCategoriaFornecedor = {
      categoria: string
      fornecedorId: string | null
      itens: Array<{
        materiaPrimaId: string
        quantidade: Prisma.Decimal
        precoUnitario: Prisma.Decimal
      }>
    }

    const grupos = new Map<string, GrupoCategoriaFornecedor>()

    for (const item of itens) {
      const mp = item.materiaPrima
      if (!mp) continue

      const quantidade = item.quantidadeSugerida.add(item.quantidadeAdicional)
      if (quantidade.lte(0)) continue

      const categoria = (mp.categoria ?? '').trim()
      const fornecedorKey = mp.fornecedorId ?? '__sem_fornecedor__'
      const chave = `${categoria}::${fornecedorKey}`
      const grupo = grupos.get(chave) ?? {
        categoria,
        fornecedorId: mp.fornecedorId,
        itens: [],
      }

      grupo.itens.push({
        materiaPrimaId: item.materiaPrimaId,
        quantidade,
        precoUnitario: mp.precoCusto,
      })

      grupos.set(chave, grupo)
    }

    if (grupos.size === 0) {
      throw new Error('Nenhum item com quantidade válida para gerar OC.')
    }

    const codigos: string[] = []

    for (const grupo of grupos.values()) {
      if (grupo.itens.length === 0) continue

      const codigo = await gerarCodigoOC()
      const sequencialFornecedor = await nextSequencialFornecedor(tx, grupo.fornecedorId)

      const oc = await tx.ordemCompra.create({
        data: {
          codigo,
          fornecedorId: grupo.fornecedorId,
          filaReposicaoId: filaId,
          sequencialFornecedor,
          status: 'pendente',
          dataGeracao: new Date(),
          ultimaAlteracaoUsuarioId: registroUsuarioId,
          ultimaAlteracaoEm: new Date(),
          itens: {
            create: grupo.itens.map((item) => ({
              materiaPrimaId: item.materiaPrimaId,
              quantidadeVendida: item.quantidade,
              quantidadeAdicional: new Prisma.Decimal(0),
              quantidade: item.quantidade,
              precoUnitario: item.precoUnitario,
            })),
          },
        },
        select: { id: true },
      })

      if (!oc?.id) throw new Error('Erro ao criar OC.')
      codigos.push(codigo)
    }

    await tx.filaReposicao.update({
      where: { id: filaId },
      data: {
        status: 'convertida',
        updatedAt: new Date(),
      },
    })

    return codigos
  })
}
