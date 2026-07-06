'use server'

import { assertPermissao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  capitalizarTipoGasto,
  TIPO_GASTO_OUTROS,
  TIPO_GASTO_PAGAMENTO_OC,
  type TipoGastoDB,
} from '@/types'

/** Tags de sistema (não podem ser removidas pelo usuário). */
const TAGS_SISTEMA = [TIPO_GASTO_PAGAMENTO_OC, TIPO_GASTO_OUTROS]

type TipoGastoRow = {
  id: string
  nome: string
  sistema: boolean
}

/** Compara nomes ignorando caixa e acentos, para detectar duplicatas. */
function normalizar(s: string): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .trim()
    .toLowerCase()
}

export async function listarTiposGasto(): Promise<TipoGastoDB[]> {
  await assertPermissao('gastos', 'ver')
  const rows = await prisma.tipoGastoTag.findMany({
    select: { id: true, nome: true, sistema: true },
    orderBy: { nome: 'asc' },
  })
  return rows as TipoGastoDB[]
}

/**
 * Cria uma nova tag (capitalizada). Se já existir uma equivalente
 * (ignorando caixa/acentos), retorna a existente em vez de duplicar.
 */
export async function criarTipoGasto(nomeBruto: string): Promise<TipoGastoDB> {
  await assertPermissao('gastos', 'criar')
  const nome = capitalizarTipoGasto(nomeBruto)
  if (!nome) throw new Error('Informe um nome para o tipo de gasto.')

  return prisma.$transaction(async (tx) => {
    const existentes = await tx.tipoGastoTag.findMany({
      select: { id: true, nome: true, sistema: true },
    })

    const alvo = normalizar(nome)
    const jaExiste = existentes.find((t) => normalizar(t.nome) === alvo)
    if (jaExiste) return jaExiste as TipoGastoDB

    const inserted = await tx.tipoGastoTag.create({
      data: { nome, sistema: false },
      select: { id: true, nome: true, sistema: true },
    })
    return inserted as TipoGastoDB
  })
}

/**
 * Remove uma tag. Os gastos que usavam essa tag passam a ser listados como
 * "Outros". Tags de sistema não podem ser removidas.
 */
export async function deletarTipoGasto(id: string): Promise<void> {
  await assertPermissao('gastos', 'deletar')
  await prisma.$transaction(async (tx) => {
    const tag = await tx.tipoGastoTag.findUnique({
      where: { id },
      select: { id: true, nome: true, sistema: true },
    })
    if (!tag) throw new Error('Tipo de gasto não encontrado.')
    if (tag.sistema || TAGS_SISTEMA.includes(tag.nome)) {
      throw new Error('Este tipo de gasto é de sistema e não pode ser removido.')
    }

    await tx.gasto.updateMany({
      where: { tipo: tag.nome },
      data: { tipo: TIPO_GASTO_OUTROS },
    })

    await tx.tipoGastoTag.delete({
      where: { id },
    })
  })
}
