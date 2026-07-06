'use server'

import { assertPermissao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import type { Empresa } from '@/types'
import { apenasDigitos, validarCnpj } from '@/lib/br/documento'

export type EmpresaInput = {
  razao_social: string
  nome_fantasia: string
  cnpj: string
  ie: string
  im: string
  crt: number
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  codigo_municipio_ibge: string
  telefone: string
  email: string
}

type EmpresaRow = {
  id: string
  razaoSocial: string
  nomeFantasia: string | null
  cnpj: string
  ie: string | null
  im: string | null
  crt: number
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  codigoMunicipioIbge: string | null
  telefone: string | null
  email: string | null
  createdAt: Date | string
  updatedAt: Date | string
}

function iso(value: Date | string | null | undefined): string {
  if (!value) return ''
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function mapEmpresaRow(row: EmpresaRow): Empresa {
  return {
    id: row.id,
    razao_social: row.razaoSocial,
    nome_fantasia: row.nomeFantasia,
    cnpj: row.cnpj,
    ie: row.ie,
    im: row.im,
    crt: Number(row.crt),
    cep: row.cep,
    logradouro: row.logradouro,
    numero: row.numero,
    complemento: row.complemento,
    bairro: row.bairro,
    cidade: row.cidade,
    uf: row.uf,
    codigo_municipio_ibge: row.codigoMunicipioIbge,
    telefone: row.telefone,
    email: row.email,
    created_at: iso(row.createdAt),
    updated_at: iso(row.updatedAt),
  }
}

export async function getEmpresa(): Promise<Empresa | null> {
  await assertPermissao('taxas_lucro', 'ver')
  const row = await prisma.empresaConfig.findFirst({
    orderBy: { createdAt: 'asc' },
  })
  return row ? mapEmpresaRow(row) : null
}

function normalizarEmpresa(input: EmpresaInput) {
  const razao = input.razao_social.trim()
  if (!razao) throw new Error('Razão social é obrigatória.')

  const cnpj = apenasDigitos(input.cnpj)
  if (!cnpj) throw new Error('CNPJ é obrigatório.')
  if (!validarCnpj(cnpj)) throw new Error('CNPJ inválido.')

  const cep = apenasDigitos(input.cep)
  if (cep && cep.length !== 8) throw new Error('CEP deve ter 8 dígitos.')

  const uf = input.uf.trim().toUpperCase()
  if (uf && uf.length !== 2) throw new Error('UF deve ter 2 letras.')

  const crt = Number(input.crt)
  if (!Number.isFinite(crt) || crt < 1 || crt > 4) throw new Error('Regime tributário (CRT) inválido.')

  const ibge = apenasDigitos(input.codigo_municipio_ibge)
  if (ibge && ibge.length !== 7) throw new Error('Código IBGE do município deve ter 7 dígitos.')

  return {
    razao_social: razao,
    nome_fantasia: input.nome_fantasia.trim() || null,
    cnpj,
    ie: input.ie.trim() || null,
    im: input.im.trim() || null,
    crt,
    cep: cep || null,
    logradouro: input.logradouro.trim() || null,
    numero: input.numero.trim() || null,
    complemento: input.complemento.trim() || null,
    bairro: input.bairro.trim() || null,
    cidade: input.cidade.trim() || null,
    uf: uf || null,
    codigo_municipio_ibge: ibge || null,
    telefone: input.telefone.trim() || null,
    email: input.email.trim() || null,
  }
}

export async function salvarEmpresa(input: EmpresaInput): Promise<void> {
  // Reusa a permissão administrativa já existente.
  await assertPermissao('taxas_lucro', 'editar')
  const row = normalizarEmpresa(input)

  const atual = await prisma.empresaConfig.findFirst({
    select: { id: true },
    orderBy: { createdAt: 'asc' },
  })

  if (atual?.id) {
    await prisma.empresaConfig.update({
      where: { id: atual.id },
      data: {
        razaoSocial: row.razao_social,
        nomeFantasia: row.nome_fantasia,
        cnpj: row.cnpj,
        ie: row.ie,
        im: row.im,
        crt: row.crt,
        cep: row.cep,
        logradouro: row.logradouro,
        numero: row.numero,
        complemento: row.complemento,
        bairro: row.bairro,
        cidade: row.cidade,
        uf: row.uf,
        codigoMunicipioIbge: row.codigo_municipio_ibge,
        telefone: row.telefone,
        email: row.email,
        updatedAt: new Date(),
      },
    })
    return
  }

  await prisma.empresaConfig.create({
    data: {
      razaoSocial: row.razao_social,
      nomeFantasia: row.nome_fantasia,
      cnpj: row.cnpj,
      ie: row.ie,
      im: row.im,
      crt: row.crt,
      cep: row.cep,
      logradouro: row.logradouro,
      numero: row.numero,
      complemento: row.complemento,
      bairro: row.bairro,
      cidade: row.cidade,
      uf: row.uf,
      codigoMunicipioIbge: row.codigo_municipio_ibge,
      telefone: row.telefone,
      email: row.email,
    },
  })
}
