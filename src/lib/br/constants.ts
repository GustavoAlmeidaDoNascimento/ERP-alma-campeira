/**
 * Dados fiscais brasileiros reutilizáveis (preparação para emissão de NF-e).
 * Todos os campos aqui são opcionais no sistema atual — servem como fonte
 * única de verdade para selects e validações futuras.
 */

export type EstadoBR = {
  sigla: string
  nome: string
  /** Código IBGE da UF (2 dígitos). Os 7 dígitos do município começam com este prefixo. */
  codIbge: string
}

export const ESTADOS_BR: EstadoBR[] = [
  { sigla: 'AC', nome: 'Acre',                codIbge: '12' },
  { sigla: 'AL', nome: 'Alagoas',             codIbge: '27' },
  { sigla: 'AP', nome: 'Amapá',               codIbge: '16' },
  { sigla: 'AM', nome: 'Amazonas',            codIbge: '13' },
  { sigla: 'BA', nome: 'Bahia',               codIbge: '29' },
  { sigla: 'CE', nome: 'Ceará',               codIbge: '23' },
  { sigla: 'DF', nome: 'Distrito Federal',    codIbge: '53' },
  { sigla: 'ES', nome: 'Espírito Santo',      codIbge: '32' },
  { sigla: 'GO', nome: 'Goiás',               codIbge: '52' },
  { sigla: 'MA', nome: 'Maranhão',            codIbge: '21' },
  { sigla: 'MT', nome: 'Mato Grosso',         codIbge: '51' },
  { sigla: 'MS', nome: 'Mato Grosso do Sul',  codIbge: '50' },
  { sigla: 'MG', nome: 'Minas Gerais',        codIbge: '31' },
  { sigla: 'PA', nome: 'Pará',                codIbge: '15' },
  { sigla: 'PB', nome: 'Paraíba',             codIbge: '25' },
  { sigla: 'PR', nome: 'Paraná',              codIbge: '41' },
  { sigla: 'PE', nome: 'Pernambuco',          codIbge: '26' },
  { sigla: 'PI', nome: 'Piauí',               codIbge: '22' },
  { sigla: 'RJ', nome: 'Rio de Janeiro',      codIbge: '33' },
  { sigla: 'RN', nome: 'Rio Grande do Norte', codIbge: '24' },
  { sigla: 'RS', nome: 'Rio Grande do Sul',   codIbge: '43' },
  { sigla: 'RO', nome: 'Rondônia',            codIbge: '11' },
  { sigla: 'RR', nome: 'Roraima',             codIbge: '14' },
  { sigla: 'SC', nome: 'Santa Catarina',      codIbge: '42' },
  { sigla: 'SP', nome: 'São Paulo',           codIbge: '35' },
  { sigla: 'SE', nome: 'Sergipe',             codIbge: '28' },
  { sigla: 'TO', nome: 'Tocantins',           codIbge: '17' },
]

/** Lista simplificada das siglas (compatibilidade com componentes que só usam UF). */
export const SIGLAS_UF: string[] = ESTADOS_BR.map((e) => e.sigla)

/** Origem da mercadoria (NF-e — campo obrigatório do produto). */
export type OrigemMercadoria = { codigo: string; descricao: string }
export const ORIGENS_MERCADORIA: OrigemMercadoria[] = [
  { codigo: '0', descricao: 'Nacional, exceto as indicadas em 3 a 5 e 8' },
  { codigo: '1', descricao: 'Estrangeira — importação direta' },
  { codigo: '2', descricao: 'Estrangeira — adquirida no mercado interno' },
  { codigo: '3', descricao: 'Nacional com conteúdo de importação > 40% e ≤ 70%' },
  { codigo: '4', descricao: 'Nacional cuja produção tenha sido feita conforme PPB' },
  { codigo: '5', descricao: 'Nacional com conteúdo de importação ≤ 40%' },
  { codigo: '6', descricao: 'Estrangeira — importação direta sem similar nacional (CAMEX)' },
  { codigo: '7', descricao: 'Estrangeira — adquirida no mercado interno sem similar nacional (CAMEX)' },
  { codigo: '8', descricao: 'Nacional com conteúdo de importação > 70%' },
]

/** Indicador de Inscrição Estadual do destinatário (NF-e — campo indIEDest). */
export type IndicadorIE = { codigo: number; descricao: string }
export const INDICADORES_IE: IndicadorIE[] = [
  { codigo: 1, descricao: 'Contribuinte ICMS' },
  { codigo: 2, descricao: 'Contribuinte isento de Inscrição no cadastro de Contribuintes' },
  { codigo: 9, descricao: 'Não Contribuinte' },
]

/** Código do Regime Tributário (CRT) do emitente. */
export type RegimeTributario = { codigo: number; descricao: string }
export const REGIMES_TRIBUTARIOS: RegimeTributario[] = [
  { codigo: 1, descricao: 'Simples Nacional' },
  { codigo: 2, descricao: 'Simples Nacional — excesso de sublimite de receita bruta' },
  { codigo: 3, descricao: 'Regime Normal' },
  { codigo: 4, descricao: 'Simples Nacional — MEI' },
]

/** Unidades de medida comerciais comuns (NF-e — uCom/uTrib). */
export const UNIDADES_MEDIDA: string[] = [
  'UN', 'PC', 'CX', 'KG', 'G', 'L', 'ML', 'M', 'CM', 'M2', 'M3', 'PAR', 'DZ', 'PCT',
]

/** CFOPs mais usados em cutelaria/manufatura (saída). */
export type CFOP = { codigo: string; descricao: string }
export const CFOPS_SAIDA: CFOP[] = [
  { codigo: '5101', descricao: 'Venda de produção do estabelecimento (dentro do estado)' },
  { codigo: '5102', descricao: 'Venda de mercadoria adquirida ou recebida de terceiros (dentro do estado)' },
  { codigo: '5405', descricao: 'Venda de mercadoria com ST recolhida anteriormente (dentro do estado)' },
  { codigo: '5910', descricao: 'Remessa em bonificação, doação ou brinde (dentro do estado)' },
  { codigo: '5949', descricao: 'Outra saída de mercadoria não especificada (dentro do estado)' },
  { codigo: '6101', descricao: 'Venda de produção do estabelecimento (interestadual)' },
  { codigo: '6102', descricao: 'Venda de mercadoria adquirida ou recebida de terceiros (interestadual)' },
  { codigo: '6108', descricao: 'Venda de mercadoria a não-contribuinte (interestadual)' },
  { codigo: '6404', descricao: 'Venda de mercadoria com ST recolhida anteriormente (interestadual)' },
  { codigo: '6949', descricao: 'Outra saída de mercadoria não especificada (interestadual)' },
]

/** CSTs ICMS (Regime Normal). Para Simples Nacional, usar CSOSN — não listado aqui. */
export type CST = { codigo: string; descricao: string }
export const CST_ICMS: CST[] = [
  { codigo: '00', descricao: 'Tributada integralmente' },
  { codigo: '10', descricao: 'Tributada e com cobrança do ICMS por substituição tributária' },
  { codigo: '20', descricao: 'Com redução de base de cálculo' },
  { codigo: '30', descricao: 'Isenta ou não tributada e com cobrança do ICMS por ST' },
  { codigo: '40', descricao: 'Isenta' },
  { codigo: '41', descricao: 'Não tributada' },
  { codigo: '50', descricao: 'Suspensão' },
  { codigo: '51', descricao: 'Diferimento' },
  { codigo: '60', descricao: 'ICMS cobrado anteriormente por substituição tributária' },
  { codigo: '70', descricao: 'Com redução de base de cálculo e cobrança do ICMS por ST' },
  { codigo: '90', descricao: 'Outras' },
]

/** CSOSN para Simples Nacional. */
export const CSOSN_ICMS: CST[] = [
  { codigo: '101', descricao: 'Tributada pelo Simples Nacional com permissão de crédito' },
  { codigo: '102', descricao: 'Tributada pelo Simples Nacional sem permissão de crédito' },
  { codigo: '103', descricao: 'Isenção do ICMS no Simples Nacional para faixa de receita bruta' },
  { codigo: '201', descricao: 'Tributada pelo Simples Nacional com permissão de crédito e cobrança de ICMS por ST' },
  { codigo: '202', descricao: 'Tributada pelo Simples Nacional sem permissão de crédito e com cobrança de ICMS por ST' },
  { codigo: '203', descricao: 'Isenção do ICMS no Simples Nacional para faixa de receita bruta e com cobrança do ICMS por ST' },
  { codigo: '300', descricao: 'Imune' },
  { codigo: '400', descricao: 'Não tributada pelo Simples Nacional' },
  { codigo: '500', descricao: 'ICMS cobrado anteriormente por ST ou por antecipação' },
  { codigo: '900', descricao: 'Outros' },
]

/** CST PIS/COFINS comuns (a lista completa tem ~70 códigos). */
export const CST_PIS_COFINS: CST[] = [
  { codigo: '01', descricao: 'Operação Tributável com alíquota básica' },
  { codigo: '02', descricao: 'Operação Tributável com alíquota diferenciada' },
  { codigo: '03', descricao: 'Operação Tributável com alíquota por unidade de medida de produto' },
  { codigo: '04', descricao: 'Operação Tributável monofásica — Revenda a alíquota zero' },
  { codigo: '05', descricao: 'Operação Tributável por Substituição Tributária' },
  { codigo: '06', descricao: 'Operação Tributável a alíquota zero' },
  { codigo: '07', descricao: 'Operação Isenta da Contribuição' },
  { codigo: '08', descricao: 'Operação sem Incidência da Contribuição' },
  { codigo: '09', descricao: 'Operação com Suspensão da Contribuição' },
  { codigo: '49', descricao: 'Outras Operações de Saída' },
  { codigo: '99', descricao: 'Outras Operações' },
]
