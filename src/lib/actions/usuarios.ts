'use server'

import { revalidateTag } from 'next/cache'
import { hash } from 'bcryptjs'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { mapPermRows, mapUsuario } from '@/lib/prisma-auth-mappers'
import type { Usuario } from '@/types'
import type { PermMap } from '@/lib/permissoes'
import { permissoesFromArray } from '@/lib/permissoes'
import { MODULOS } from '@/types'

export async function getUsuariosPerfisList(): Promise<{ id: string; nome: string }[]> {
  await requireAuthenticatedUserId()
  return prisma.usuarioPerfil.findMany({
    where: { ativo: true },
    select: { id: true, nome: true },
    orderBy: { nome: 'asc' },
  })
}

export async function getUsuarios(limit = 100): Promise<Usuario[]> {
  await assertPermissao('usuarios', 'ver')
  const users = await prisma.user.findMany({
    include: {
      profile: {
        include: {
          cargo: {
            include: {
              permissions: {
                orderBy: { modulo: 'asc' },
              },
            },
          },
        },
      },
      userPermissions: {
        select: { id: true },
        take: 1,
      },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })

  return users.map((user) =>
    mapUsuario({
      ...user,
      profile: user.profile
        ? {
            ...user.profile,
            cargo: user.profile.cargo
              ? {
                  ...user.profile.cargo,
                  permissions: user.profile.cargo.permissions,
                }
              : null,
          }
        : null,
      userPermissions: user.userPermissions,
    })
  ) as Usuario[]
}

export async function getPermissoesUsuario(userId: string): Promise<PermMap | null> {
  await assertPermissao('usuarios', 'ver')
  const data = await prisma.usuarioPermissao.findMany({
    where: { userId },
    orderBy: { modulo: 'asc' },
  })

  if (data.length === 0) return null

  return permissoesFromArray(mapPermRows(data))
}

export async function criarUsuario({
  email, senha, nome, cargo_id,
}: {
  email: string
  senha: string
  nome: string
  cargo_id: string | null
}) {
  await assertPermissao('usuarios', 'criar')
  const normalizedEmail = email.toLowerCase().trim()

  // Verifica se email já existe
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  })
  if (existing) {
    throw new Error('Já existe um usuário com este email.')
  }

  const passwordHash = await hash(senha, 12)
  await prisma.user.create({
    data: {
      email: normalizedEmail,
      passwordHash,
      profile: {
        create: {
          nome: nome.trim(),
          perfil: 'vendas',
          ativo: true,
          cargoId: cargo_id || null,
        },
      },
    },
  })
}

export async function atualizarPerfil(
  id: string,
  {
    nome,
    ativo,
    cargo_id,
    permissoes,
  }: {
    nome: string
    ativo: boolean
    cargo_id: string | null
    permissoes: PermMap | null
  }
) {
  await assertPermissao('usuarios', 'editar')
  await prisma.$transaction(async (tx) => {
    await tx.usuarioPerfil.upsert({
      where: { id },
      create: { id, nome: nome.trim(), perfil: 'vendas', ativo, cargoId: cargo_id || null },
      update: { nome: nome.trim(), perfil: 'vendas', ativo, cargoId: cargo_id || null },
    })

    await tx.usuarioPermissao.deleteMany({ where: { userId: id } })

    if (permissoes !== null) {
      await tx.usuarioPermissao.createMany({
        data: MODULOS.map((m) => ({
          userId: id,
          modulo: m.key,
          ...permissoes[m.key],
        })),
      })
    }
  })

  // Invalida o cache global de permissões (todos os usuários).
  revalidateTag('user-permissions', 'max')
}

export async function deletarUsuario(id: string) {
  await assertPermissao('usuarios', 'deletar')
  const currentId = await requireAuthenticatedUserId()
  if (id === currentId) {
    throw new Error('Não é possível excluir o próprio usuário.')
  }

  await prisma.$transaction(async (tx) => {
    // Referências em tabelas ainda não modeladas no Prisma.
    await tx.pedido.updateMany({
      where: { vendedorId: id },
      data: { vendedorId: null },
    })
    await tx.movimentacaoEstoque.updateMany({
      where: { usuarioId: id },
      data: { usuarioId: null },
    })

    await tx.usuarioPermissao.deleteMany({ where: { userId: id } })
    await tx.usuarioPerfil.deleteMany({ where: { id } })
    await tx.user.delete({ where: { id } })
  })
}
