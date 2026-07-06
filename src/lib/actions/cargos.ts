'use server'

import { revalidateTag } from 'next/cache'
import { assertPermissao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mapCargo } from '@/lib/prisma-auth-mappers'
import type { Cargo, ModuloKey } from '@/types'
import { MODULOS } from '@/types'

export async function getCargos(limit = 50): Promise<Cargo[]> {
  await assertPermissao('cargos', 'ver')
  const cargos = await prisma.cargo.findMany({
    include: { permissions: { orderBy: { modulo: 'asc' } } },
    orderBy: { nome: 'asc' },
    take: limit,
  })
  return cargos.map(mapCargo)
}

type CargoInput = {
  nome: string
  descricao: string
  cor: string
  permissoes: Record<ModuloKey, { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }>
}

export async function criarCargo(input: CargoInput) {
  await assertPermissao('cargos', 'criar')
  await prisma.cargo.create({
    data: {
      nome: input.nome.trim(),
      descricao: input.descricao.trim() || null,
      cor: input.cor,
      permissions: {
        create: MODULOS.map((m) => ({
          modulo: m.key,
          ...input.permissoes[m.key],
        })),
      },
    },
  })

  // Permissões são cacheadas em auth.ts via unstable_cache. Invalidar essa tag
  // específica garante que o próximo `assertPermissao` releia do banco.
  revalidateTag('user-permissions', 'max')
}

export async function atualizarCargo(id: string, input: CargoInput) {
  await assertPermissao('cargos', 'editar')
  await prisma.$transaction(async (tx) => {
    await tx.cargo.update({
      where: { id },
      data: {
        nome: input.nome.trim(),
        descricao: input.descricao.trim() || null,
        cor: input.cor,
      },
    })

    await tx.cargoPermissao.deleteMany({ where: { cargoId: id } })
    await tx.cargoPermissao.createMany({
      data: MODULOS.map((m) => ({
        cargoId: id,
        modulo: m.key,
        ...input.permissoes[m.key],
      })),
    })
  })

  revalidateTag('user-permissions', 'max')
}

export async function deletarCargo(id: string) {
  await assertPermissao('cargos', 'deletar')
  const uso = await prisma.usuarioPerfil.findFirst({
    where: { cargoId: id },
    select: { id: true },
  })

  if (uso) {
    throw new Error('Este cargo está sendo usado por um ou mais usuários.')
  }

  await prisma.cargo.delete({ where: { id } })
}
