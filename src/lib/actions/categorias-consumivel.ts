'use server'

import { assertPermissao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { CategoriaConsumivelDB } from '@/types'

const CATEGORIAS_PADRAO: CategoriaConsumivelDB[] = [
  { id: 'fallback-escritorio', nome: 'Escritório', ordem: 1, created_at: '' },
  { id: 'fallback-limpeza', nome: 'Limpeza', ordem: 2, created_at: '' },
  { id: 'fallback-producao', nome: 'Produção', ordem: 3, created_at: '' },
  { id: 'fallback-seguranca', nome: 'Segurança', ordem: 4, created_at: '' },
]

function mapCategoriaConsumivel(row: {
  id: string
  nome: string
  ordem: number
  createdAt: Date
}): CategoriaConsumivelDB {
  return {
    id: row.id,
    nome: row.nome,
    ordem: row.ordem,
    created_at: row.createdAt.toISOString(),
  }
}

export async function getCategoriasConsumivel(): Promise<CategoriaConsumivelDB[]> {
  await assertPermissao('consumiveis', 'ver')
  const categorias = await prisma.categoriaConsumivel.findMany({
    select: { id: true, nome: true, ordem: true, createdAt: true },
    orderBy: { ordem: 'asc' },
  })
  const mapped = categorias.map(mapCategoriaConsumivel)
  return mapped.length > 0 ? mapped : CATEGORIAS_PADRAO
}

type CategoriaInput = { nome: string }

export async function criarCategoriaConsumivel(input: CategoriaInput) {
  await assertPermissao('consumiveis', 'criar')
  const ultimaCategoria = await prisma.categoriaConsumivel.findFirst({
    select: { ordem: true },
    orderBy: { ordem: 'desc' },
  })

  const ordem = (ultimaCategoria?.ordem ?? 0) + 1

  await prisma.categoriaConsumivel.create({
    data: {
      nome: input.nome.trim(),
      ordem,
    },
  })
}

export async function atualizarCategoriaConsumivel(id: string, input: CategoriaInput) {
  await assertPermissao('consumiveis', 'editar')
  await prisma.categoriaConsumivel.updateMany({
    where: { id },
    data: { nome: input.nome.trim() },
  })
}

export async function deletarCategoriaConsumivel(id: string) {
  await assertPermissao('consumiveis', 'deletar')
  await prisma.categoriaConsumivel.deleteMany({
    where: { id },
  })
}
