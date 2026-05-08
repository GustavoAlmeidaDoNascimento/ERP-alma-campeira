'use server'

import { createClient } from '@/lib/supabase/server'
import { assertPermissao } from '@/lib/auth'
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

export async function getEmpresa(): Promise<Empresa | null> {
  await assertPermissao('taxas_lucro', 'ver')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('empresa')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) {
    // Se a tabela ainda não existe, devolver null em vez de quebrar a página.
    if (/relation .* does not exist/i.test(error.message)) return null
    throw new Error(error.message)
  }
  return (data as Empresa | null) ?? null
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
  const supabase = await createClient()
  const row = normalizarEmpresa(input)

  const { data: atual } = await supabase
    .from('empresa')
    .select('id')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (atual?.id) {
    const { error } = await supabase.from('empresa').update(row).eq('id', atual.id)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await supabase.from('empresa').insert(row)
    if (error) throw new Error(error.message)
  }
}
