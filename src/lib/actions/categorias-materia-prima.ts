'use server'

import { revalidateTag } from 'next/cache'
import { assertPermissao } from '@/lib/auth'
import { requireAuthenticatedUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { CategoriaMateriaPrimaDB } from '@/types'

const CATEGORIAS_PADRAO: CategoriaMateriaPrimaDB[] = [
  { id: 'fallback-bainha', nome: 'Bainha', ordem: 1, created_at: '' },
  { id: 'fallback-botao', nome: 'Botão', ordem: 2, created_at: '' },
  { id: 'fallback-lamina', nome: 'Lâmina', ordem: 3, created_at: '' },
  { id: 'fallback-cabo', nome: 'Cabo', ordem: 4, created_at: '' },
]

function mapCategoriaMateriaPrima(row: {
  id: string
  nome: string
  ordem: number
  createdAt: Date
}): CategoriaMateriaPrimaDB {
  return {
    id: row.id,
    nome: row.nome,
    ordem: row.ordem,
    created_at: row.createdAt.toISOString(),
  }
}

async function revalidateCategoriasMP() {
  try {
    const userId = await requireAuthenticatedUserId()
    revalidateTag(`list-categorias-mp-${userId}`, 'max')
  } catch {}
}

export async function getCategoriasMateriaPrima(): Promise<CategoriaMateriaPrimaDB[]> {
  await assertPermissao('materias_primas', 'ver')
  const categorias = await prisma.categoriaMateriaPrima.findMany({
    select: { id: true, nome: true, ordem: true, createdAt: true },
    orderBy: { ordem: 'asc' },
  })
  const mapped = categorias.map(mapCategoriaMateriaPrima)
  return mapped.length > 0 ? mapped : CATEGORIAS_PADRAO
}

type CategoriaInput = { nome: string }

export async function criarCategoriaMateriaPrima(input: CategoriaInput) {
  await assertPermissao('materias_primas', 'criar')
  const ultimaCategoria = await prisma.categoriaMateriaPrima.findFirst({
    select: { ordem: true },
    orderBy: { ordem: 'desc' },
  })

  const ordem = (ultimaCategoria?.ordem ?? 0) + 1

  await prisma.categoriaMateriaPrima.create({
    data: {
      nome: input.nome.trim(),
      ordem,
    },
  })
  await revalidateCategoriasMP()
}

export async function atualizarCategoriaMateriaPrima(id: string, input: CategoriaInput) {
  await assertPermissao('materias_primas', 'editar')
  await prisma.categoriaMateriaPrima.updateMany({
    where: { id },
    data: { nome: input.nome.trim() },
  })
  await revalidateCategoriasMP()
}

export async function deletarCategoriaMateriaPrima(id: string) {
  await assertPermissao('materias_primas', 'deletar')
  await prisma.categoriaMateriaPrima.deleteMany({
    where: { id },
  })
  await revalidateCategoriasMP()
}
