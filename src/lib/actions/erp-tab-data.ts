'use server'

import { getPermissoesEfetivas } from '@/lib/auth'
import { getMatériasPrimas } from '@/lib/actions/materias-primas'
import { getFornecedores } from '@/lib/actions/fornecedores'
import { getFacas, getFacaDetalhe, type FacaDetalheData } from '@/lib/actions/facas'
import { getCategoriasFaca } from '@/lib/actions/categorias-faca'
import { getVendas } from '@/lib/actions/vendas'
import { getClientes } from '@/lib/actions/clientes'
import { getUsuarios } from '@/lib/actions/usuarios'
import { getCargos } from '@/lib/actions/cargos'
import { getFilaReposicao, getOrdensCompra } from '@/lib/actions/ordens-compra'

import type { MateriaPrima, Fornecedor, Faca, CategoriaFacaDB, Pedido, Cliente, Usuario, Cargo } from '@/types'

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean }

export type ErpTabData =
  | {
      kind: 'materias-primas'
      materiasPrimas: MateriaPrima[]
      fornecedores: Fornecedor[]
      perm: Perm
    }
  | {
      kind: 'facas'
      facas: Faca[]
      categorias: CategoriaFacaDB[]
      materiasPrimas: MateriaPrima[]
      perm: Perm
    }
  | {
      kind: 'faca-detalhe'
      detalhe: FacaDetalheData
      materiasPrimas: MateriaPrima[]
      categorias: CategoriaFacaDB[]
      perm: Perm
    }
  | {
      kind: 'fornecedores'
      fornecedores: Fornecedor[]
      perm: Perm
    }
  | {
      kind: 'ordens-compra'
      fila: Awaited<ReturnType<typeof getFilaReposicao>>
      ordens: Awaited<ReturnType<typeof getOrdensCompra>>
      perm: Perm
    }
  | {
      kind: 'vendas'
      pedidos: Pedido[]
      clientes: Cliente[]
      facas: Faca[]
      perm: Perm
    }
  | {
      kind: 'clientes'
      clientes: Cliente[]
      perm: Perm
    }
  | {
      kind: 'usuarios'
      usuarios: Usuario[]
      cargos: Cargo[]
      perm: Perm
    }
  | {
      kind: 'cargos'
      cargos: Cargo[]
      perm: Perm
    }
  | {
      kind: 'configuracoes'
      categorias: CategoriaFacaDB[]
    }

function assertAllowed(perm: Perm | undefined, label: string): void {
  if (!perm || !perm.ver) throw new Error(`Acesso negado: ${label}.`)
}

function normalizePathOnly(href: string) {
  const [pathOnly] = href.split('?')
  return pathOnly
}

export async function getErpTabData(href: string): Promise<ErpTabData> {
  const path = normalizePathOnly(href)

  if (path === '/materias-primas') {
    const [perms, materiasPrimas, fornecedores] = await Promise.all([
      getPermissoesEfetivas(),
      getMatériasPrimas(120),
      getFornecedores(80),
    ])
    const perm = perms.materias_primas as Perm
    assertAllowed(perm, 'materias_primas')
    return { kind: 'materias-primas', materiasPrimas, fornecedores, perm }
  }

  if (path === '/facas') {
    const [perms, facas, categorias, materiasPrimas] = await Promise.all([
      getPermissoesEfetivas(),
      getFacas(120),
      getCategoriasFaca(),
      getMatériasPrimas(200),
    ])
    const perm = perms.facas as Perm
    assertAllowed(perm, 'facas')
    return { kind: 'facas', facas, categorias, materiasPrimas, perm }
  }

  // Detalhe de faca: /facas/{uuid}
  const facaDetalheMatch = path.match(/^\/facas\/([a-f0-9-]+)$/)
  if (facaDetalheMatch) {
    const facaId = facaDetalheMatch[1]
    const [perms, detalhe, materiasPrimas, categorias] = await Promise.all([
      getPermissoesEfetivas(),
      getFacaDetalhe(facaId),
      getMatériasPrimas(200),
      getCategoriasFaca(),
    ])
    const perm = perms.facas as Perm
    assertAllowed(perm, 'facas')
    return { kind: 'faca-detalhe', detalhe, materiasPrimas, categorias, perm }
  }

  if (path === '/fornecedores') {
    const [perms, fornecedores] = await Promise.all([
      getPermissoesEfetivas(),
      getFornecedores(120),
    ])
    const perm = perms.fornecedores as Perm
    assertAllowed(perm, 'fornecedores')
    return { kind: 'fornecedores', fornecedores, perm }
  }

  if (path === '/ordens-compra') {
    const [perms, fila, ordens] = await Promise.all([
      getPermissoesEfetivas(),
      getFilaReposicao(),
      getOrdensCompra(),
    ])
    const perm = perms.ordens_compra as Perm
    assertAllowed(perm, 'ordens_compra')
    return { kind: 'ordens-compra', fila, ordens, perm }
  }

  if (path === '/vendas') {
    const [perms, pedidos, clientes, facas] = await Promise.all([
      getPermissoesEfetivas(),
      getVendas(80),
      getClientes(80),
      getFacas(120),
    ])
    const perm = perms.vendas as Perm
    assertAllowed(perm, 'vendas')
    return { kind: 'vendas', pedidos, clientes, facas, perm }
  }

  if (path === '/clientes') {
    const [perms, clientes] = await Promise.all([
      getPermissoesEfetivas(),
      getClientes(120),
    ])
    const perm = perms.clientes as Perm
    assertAllowed(perm, 'clientes')
    return { kind: 'clientes', clientes, perm }
  }

  if (path === '/usuarios') {
    const [perms, usuarios, cargos] = await Promise.all([
      getPermissoesEfetivas(),
      getUsuarios(120),
      getCargos(80),
    ])
    const perm = perms.usuarios as Perm
    assertAllowed(perm, 'usuarios')
    return { kind: 'usuarios', usuarios, cargos, perm }
  }

  if (path === '/cargos') {
    const [perms, cargos] = await Promise.all([
      getPermissoesEfetivas(),
      getCargos(120),
    ])
    const perm = perms.cargos as Perm
    assertAllowed(perm, 'cargos')
    return { kind: 'cargos', cargos, perm }
  }

  if (path === '/configuracoes') {
    const categorias = await getCategoriasFaca()
    return { kind: 'configuracoes', categorias }
  }

  throw new Error(`Rota de aba não suportada: ${path}`)
}

