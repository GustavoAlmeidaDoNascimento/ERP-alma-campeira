import { TIPOS_CLIENTE, type TipoCliente, type TipoDocumento } from '@/types'
import { apenasDigitos, validarCnpj, validarCpf } from '@/lib/br/documento'

export type CamposCadastroParceiro = {
  nome: string
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
  uf: string
  razao_social?: string
  ie?: string
  codigo_municipio_ibge?: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type OpcoesValidacaoParceiro = {
  emailOpcional?: boolean
  ieOpcional?: boolean
}

function exigirTexto(valor: string, label: string) {
  if (!valor.trim()) throw new Error(`${label} é obrigatório.`)
}

function validarEmail(input: CamposCadastroParceiro, opcoes?: OpcoesValidacaoParceiro) {
  const email = input.email.trim()
  if (!opcoes?.emailOpcional) {
    if (!email) throw new Error('E-mail é obrigatório.')
    if (!EMAIL_RE.test(email)) throw new Error('E-mail inválido.')
    return
  }
  if (email && !EMAIL_RE.test(email)) throw new Error('E-mail inválido.')
}

/** Valida cadastro completo de cliente ou fornecedor (campos visíveis no formulário). */
export function validarCamposObrigatoriosParceiro(
  input: CamposCadastroParceiro,
  opcoes?: OpcoesValidacaoParceiro,
) {
  exigirTexto(input.nome, 'Nome')

  const doc = apenasDigitos(input.documento)
  if (!doc) throw new Error('Documento é obrigatório.')
  if (input.tipo_documento === 'cpf') {
    if (doc.length !== 11) throw new Error('CPF deve ter 11 dígitos.')
    if (!validarCpf(doc)) throw new Error('CPF inválido.')
  } else {
    if (doc.length !== 14) throw new Error('CNPJ deve ter 14 dígitos.')
    if (!validarCnpj(doc)) throw new Error('CNPJ inválido.')
    exigirTexto(input.razao_social ?? '', 'Razão social')
  }

  exigirTexto(input.telefone, 'Telefone')
  if (!/^[\d\s()\-+]+$/.test(input.telefone.trim())) {
    throw new Error('Telefone inválido. Use apenas números, espaços e os caracteres ( ) - +')
  }

  validarEmail(input, opcoes)

  if (!opcoes?.ieOpcional) {
    exigirTexto(input.ie ?? '', 'Inscrição estadual')
  }

  const cep = apenasDigitos(input.cep)
  if (!cep) throw new Error('CEP é obrigatório.')
  if (cep.length !== 8) throw new Error('CEP deve ter 8 dígitos.')

  exigirTexto(input.logradouro, 'Logradouro')
  exigirTexto(input.numero, 'Número')
  exigirTexto(input.bairro, 'Bairro')
  exigirTexto(input.cidade, 'Cidade')

  const uf = input.uf.trim().toUpperCase()
  if (!uf) throw new Error('UF é obrigatória.')
  if (uf.length !== 2) throw new Error('UF deve ter 2 letras.')

  const ibge = apenasDigitos(input.codigo_municipio_ibge ?? '')
  if (!ibge) {
    throw new Error('Código IBGE do município é obrigatório. Use "Buscar pelo CEP" ou informe o código.')
  }
  if (ibge.length !== 7) throw new Error('Código IBGE do município deve ter 7 dígitos.')
}

/** Valida cadastro de fornecedor (e-mail e inscrição estadual opcionais). */
export function validarCamposObrigatoriosFornecedor(input: CamposCadastroParceiro) {
  validarCamposObrigatoriosParceiro(input, { emailOpcional: true, ieOpcional: true })
}

const INDICADORES_IE_VALIDOS = [1, 2, 9] as const

export type CamposCadastroCliente = CamposCadastroParceiro & {
  tipo: string
  indicador_ie: number | null | undefined
}

/** Validação completa de cliente (parceiro + tipo + indicador IE). */
export function validarCamposObrigatoriosCliente(input: CamposCadastroCliente) {
  validarCamposObrigatoriosParceiro(input)

  const tipo = input.tipo.trim()
  if (!tipo) throw new Error('Tipo de cliente é obrigatório.')
  if (!TIPOS_CLIENTE.includes(tipo as TipoCliente)) {
    throw new Error('Tipo de cliente inválido.')
  }

  const ind = Number(input.indicador_ie)
  if (!INDICADORES_IE_VALIDOS.includes(ind as (typeof INDICADORES_IE_VALIDOS)[number])) {
    throw new Error('Indicador IE é obrigatório.')
  }
}
