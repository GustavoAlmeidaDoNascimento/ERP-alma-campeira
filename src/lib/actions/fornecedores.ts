'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { unstable_cache } from 'next/cache'
import { createClient, withSupabaseCookieContext } from '@/lib/supabase/server'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import type { Fornecedor, TipoDocumentoFornecedor } from '@/types'
import { apenasDigitos, validarCnpj, validarCpf } from '@/lib/br/documento'

const getFornecedoresCached = unstable_cache(
  async (_userId: string, limit: number): Promise<Fornecedor[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('fornecedores')
      .select('*')
      .order('nome')
      .limit(limit)
    if (error) throw new Error(error.message)
    return data as Fornecedor[]
  },
  ['fornecedores-list'],
  { revalidate: 60, tags: ['fornecedores-list'] }
)

export async function getFornecedores(limit = 50): Promise<Fornecedor[]> {
  const userId = await requireAuthenticatedUserId()
  return withSupabaseCookieContext(() => getFornecedoresCached(userId, limit))
}

type FornecedorInput = {
  nome: string
  telefone: string
  email: string
  tipo_documento: TipoDocumentoFornecedor
  documento: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
}

function normalizarFornecedorPayload(input: FornecedorInput) {
  const doc = apenasDigitos(input.documento)
  if (doc) {
    if (input.tipo_documento === 'cpf') {
      if (!validarCpf(doc)) throw new Error('CPF inválido.')
    } else if (!validarCnpj(doc)) {
      throw new Error('CNPJ inválido.')
    }
  }
  const cep = apenasDigitos(input.cep)
  if (cep && cep.length !== 8) throw new Error('CEP deve ter 8 dígitos.')
  const uf = input.uf.trim().toUpperCase()
  if (uf && uf.length !== 2) throw new Error('UF deve ter 2 letras.')

  return {
    nome: input.nome.trim(),
    telefone: input.telefone.trim() || null,
    email: input.email.trim() || null,
    tipo_documento: input.tipo_documento,
    documento: doc || null,
    cep: cep || null,
    logradouro: input.logradouro.trim() || null,
    numero: input.numero.trim() || null,
    complemento: input.complemento.trim() || null,
    bairro: input.bairro.trim() || null,
    cidade: input.cidade.trim() || null,
    uf: uf || null,
  }
}

export async function criarFornecedor(input: FornecedorInput) {
  await assertPermissao('fornecedores', 'criar')
  const supabase = await createClient()
  const row = normalizarFornecedorPayload(input)
  const { error } = await supabase.from('fornecedores').insert(row)
  if (error) throw new Error(error.message)
  revalidatePath('/fornecedores')
  revalidateTag('fornecedores-list', 'max')
}

export async function atualizarFornecedor(id: string, input: FornecedorInput) {
  await assertPermissao('fornecedores', 'editar')
  const supabase = await createClient()
  const row = normalizarFornecedorPayload(input)
  const { error } = await supabase.from('fornecedores').update(row).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/fornecedores')
  revalidateTag('fornecedores-list', 'max')
}

export async function deletarFornecedor(id: string) {
  await assertPermissao('fornecedores', 'deletar')
  const supabase = await createClient()

  const { data: uso } = await supabase
    .from('materias_primas')
    .select('id')
    .eq('fornecedor_id', id)
    .limit(1)

  if (uso && uso.length > 0) {
    throw new Error('Este fornecedor possui matérias-primas vinculadas e não pode ser excluído.')
  }

  const { error } = await supabase.from('fornecedores').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/fornecedores')
  revalidateTag('fornecedores-list', 'max')
}
