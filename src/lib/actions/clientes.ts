'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { unstable_cache } from 'next/cache'
import { createClient, withSupabaseCookieContext } from '@/lib/supabase/server'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import type { Cliente, TipoDocumento } from '@/types'
import { apenasDigitos, validarCnpj, validarCpf } from '@/lib/br/documento'

const getClientesCached = unstable_cache(
  async (_userId: string, limit: number): Promise<Cliente[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nome')
      .limit(limit)
    if (error) throw new Error(error.message)
    return data as Cliente[]
  },
  ['clientes-list'],
  { revalidate: 60, tags: ['clientes-list'] }
)

export async function getClientes(limit = 50): Promise<Cliente[]> {
  const userId = await requireAuthenticatedUserId()
  return withSupabaseCookieContext(() => getClientesCached(userId, limit))
}

type ClienteInput = {
  nome: string
  tipo: string
  telefone: string
  email: string
  tipo_documento: TipoDocumento
  documento: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
}

function normalizarClientePayload(input: ClienteInput) {
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
  const estado = input.estado.trim().toUpperCase()
  if (estado && estado.length !== 2) throw new Error('Estado (UF) deve ter 2 letras.')

  return {
    nome: input.nome.trim(),
    tipo: input.tipo,
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
    estado: estado || null,
  }
}

export async function criarCliente(input: ClienteInput) {
  await assertPermissao('clientes', 'criar')
  const supabase = await createClient()
  const row = normalizarClientePayload(input)
  const { error } = await supabase.from('clientes').insert(row)
  if (error) throw new Error(error.message)
  revalidatePath('/clientes')
  revalidateTag('clientes-list', 'max')
}

export async function atualizarCliente(id: string, input: ClienteInput) {
  await assertPermissao('clientes', 'editar')
  const supabase = await createClient()
  const row = normalizarClientePayload(input)
  const { error } = await supabase.from('clientes').update(row).eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/clientes')
  revalidatePath('/vendas')
  revalidateTag('clientes-list', 'max')
  revalidateTag('vendas-list', 'max')
}

export async function deletarCliente(id: string) {
  await assertPermissao('clientes', 'deletar')
  const supabase = await createClient()

  const { data: uso } = await supabase
    .from('pedidos')
    .select('id')
    .eq('cliente_id', id)
    .limit(1)

  if (uso && uso.length > 0) {
    throw new Error('Este cliente possui vendas vinculadas e não pode ser excluído.')
  }

  const { error } = await supabase.from('clientes').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/clientes')
  revalidateTag('clientes-list', 'max')
  revalidateTag('vendas-list', 'max')
}
