export type ViaCepResposta = {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string
  uf: string
  erro?: boolean
}

export type EnderecoViaCep = {
  logradouro: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
}

/**
 * Consulta pública ViaCEP (sem chave). Use no cliente ou no servidor.
 */
export async function buscarEnderecoPorCep(cepDigitos: string): Promise<EnderecoViaCep | null> {
  const limpo = cepDigitos.replace(/\D/g, '')
  if (limpo.length !== 8) return null

  const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })

  if (!res.ok) return null

  const data = (await res.json()) as ViaCepResposta
  if (!data || data.erro === true) return null

  return {
    logradouro: data.logradouro ?? '',
    complemento: data.complemento ?? '',
    bairro: data.bairro ?? '',
    cidade: data.localidade ?? '',
    uf: data.uf ?? '',
  }
}
