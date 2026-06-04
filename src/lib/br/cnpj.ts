/**
 * Consulta pública de CNPJ via BrasilAPI (sem chave, com CORS habilitado).
 * Docs: https://brasilapi.com.br/docs#tag/CNPJ
 */

export type EmpresaCnpj = {
  razao_social: string
  nome_fantasia: string
  email: string
  telefone: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  /** Código IBGE de 7 dígitos do município (obrigatório em NF-e). */
  ibge: string
}

type BrasilApiCnpjResposta = {
  razao_social?: string
  nome_fantasia?: string
  email?: string
  ddd_telefone_1?: string
  ddd_telefone_2?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  municipio?: string
  uf?: string
  codigo_municipio_ibge?: string | number
  message?: string
}

function normalizarTelefone(v?: string): string {
  if (!v) return ''
  const d = v.replace(/\D/g, '')
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  return v
}

export async function buscarEmpresaPorCnpj(cnpjDigitos: string): Promise<EmpresaCnpj | null> {
  const limpo = cnpjDigitos.replace(/\D/g, '')
  if (limpo.length !== 14) return null

  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${limpo}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) return null

  const data = (await res.json()) as BrasilApiCnpjResposta
  if (!data || data.message) return null

  const ibgeRaw = data.codigo_municipio_ibge
  const ibge = ibgeRaw == null ? '' : String(ibgeRaw)

  return {
    razao_social: data.razao_social ?? '',
    nome_fantasia: data.nome_fantasia ?? '',
    email: data.email ?? '',
    telefone: normalizarTelefone(data.ddd_telefone_1 || data.ddd_telefone_2),
    cep: data.cep ?? '',
    logradouro: data.logradouro ?? '',
    numero: data.numero ?? '',
    complemento: data.complemento ?? '',
    bairro: data.bairro ?? '',
    cidade: data.municipio ?? '',
    uf: data.uf ?? '',
    ibge,
  }
}
