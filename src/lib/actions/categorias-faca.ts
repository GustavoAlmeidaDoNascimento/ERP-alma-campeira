'use server'

import { revalidateTag } from 'next/cache'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import { fetchCategoriasFacaList } from '@/lib/cache/list-data'
import { prisma } from '@/lib/prisma'
import type { CategoriaFacaDB } from '@/types'

function normalizeColor(value: string): string {
  return value.trim()
}

async function revalidateCategoriasFaca() {
  try {
    const userId = await requireAuthenticatedUserId()
    revalidateTag(`list-categorias-faca-${userId}`, 'max')
  } catch {}
}

export async function getCategoriasFaca(): Promise<CategoriaFacaDB[]> {
  const userId = await requireAuthenticatedUserId()
  await assertPermissao('facas', 'ver')
  return fetchCategoriasFacaList(userId)
}

type CategoriaInput = {
  nome: string
  cor_texto: string
  cor_fundo: string
  cor_borda: string
}

export async function criarCategoriaFaca(input: CategoriaInput) {
  await assertPermissao('facas', 'criar')
  const ultimaCategoria = await prisma.categoriaFaca.findFirst({
    select: { ordem: true },
    orderBy: { ordem: 'desc' },
  })

  const ordem = (ultimaCategoria?.ordem ?? 0) + 1

  await prisma.categoriaFaca.create({
    data: {
      nome: input.nome.trim(),
      corTexto: normalizeColor(input.cor_texto),
      corFundo: normalizeColor(input.cor_fundo),
      corBorda: normalizeColor(input.cor_borda),
      ordem,
    },
  })
  await revalidateCategoriasFaca()
}

export async function atualizarCategoriaFaca(id: string, input: CategoriaInput) {
  await assertPermissao('facas', 'editar')
  await prisma.categoriaFaca.updateMany({
    where: { id },
    data: {
      nome: input.nome.trim(),
      corTexto: normalizeColor(input.cor_texto),
      corFundo: normalizeColor(input.cor_fundo),
      corBorda: normalizeColor(input.cor_borda),
    },
  })
  await revalidateCategoriasFaca()
}

export async function deletarCategoriaFaca(id: string) {
  await assertPermissao('facas', 'deletar')
  await prisma.categoriaFaca.deleteMany({
    where: { id },
  })
  await revalidateCategoriasFaca()
}
