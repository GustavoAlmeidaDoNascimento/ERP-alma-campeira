/** CNPJ (padrão em PJ) ou CPF — armazenado só com dígitos em `documento`. */
export type TipoDocumento = 'cnpj' | 'cpf'

export type Fornecedor = {
  id: string
  nome: string
  telefone: string | null
  email: string | null
  tipo_documento: TipoDocumento
  documento: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  // Campos fiscais (preparação NF-e — opcionais)
  razao_social?: string | null
  ie?: string | null
  codigo_municipio_ibge?: string | null
  created_at: string
}

export type MateriaPrima = {
  id: string
  codigo: string
  sku: string
  nome: string
  categoria: string
  fornecedor_id: string | null
  foto_url: string | null
  preco_custo: number
  estoque_atual: number
  estoque_minimo: number
  created_at: string
  // join
  fornecedor?: Fornecedor | null
}

export type StatusEstoque = 'ok' | 'atencao' | 'critico'

export function statusEstoque(mp: MateriaPrima): StatusEstoque {
  if (mp.estoque_atual === 0) return 'critico'
  if (mp.estoque_atual <= mp.estoque_minimo) return 'atencao'
  return 'ok'
}

export type Faca = {
  id: string
  codigo: string
  sku: string
  nome: string
  categoria: string
  foto_url: string | null
  taxa_producao: number
  taxa_venda: number
  preco_custo?: number
  preco_venda: number
  estoque_atual: number
  estoque_minimo: number
  // Campos fiscais (preparação NF-e — opcionais)
  ncm?: string | null
  cfop_padrao?: string | null
  cst_icms?: string | null
  cst_pis?: string | null
  cst_cofins?: string | null
  origem?: number | null
  unidade?: string | null
  ean_gtin?: string | null
  created_at: string
}

export function statusEstoqueFaca(
  faca: Pick<Faca, 'estoque_atual' | 'estoque_minimo'>
): StatusEstoque {
  if (faca.estoque_atual === 0) return 'critico'
  if (faca.estoque_atual <= faca.estoque_minimo) return 'atencao'
  return 'ok'
}

/**
 * Custo de produção unitário:
 *   custo BOM (matérias-primas) + taxa de produção (valor fixo em R$).
 */
export function custoProducaoFaca(
  preco_custo_bom: number,
  taxa_producao_fixa: number
): number {
  return Math.max(0, Number(preco_custo_bom) || 0) + Math.max(0, Number(taxa_producao_fixa) || 0)
}

/**
 * Preço de venda calculado automaticamente:
 *   custo_producao × (1 + margem_lucro / 100).
 */
export function calcularPrecoVendaFaca(
  preco_custo_bom: number,
  taxas: { taxa_producao: number; margem_lucro: number }
): number {
  const custo = custoProducaoFaca(preco_custo_bom, taxas.taxa_producao)
  const ml = Math.max(0, Number(taxas.margem_lucro) || 0) / 100
  return custo * (1 + ml)
}

/**
 * Lucro unitário:
 *   preço_venda × (1 − comissão%) − custo_producao.
 */
export function lucroUnitarioFaca(
  faca: Pick<Faca, 'preco_venda' | 'preco_custo'>,
  taxas: { taxa_producao: number; margem_lucro: number; taxa_comissao: number }
): number {
  const custoProd = custoProducaoFaca(Number(faca.preco_custo ?? 0), taxas.taxa_producao)
  const venda = Number(faca.preco_venda ?? 0)
  const c = Math.max(0, Number(taxas.taxa_comissao) || 0) / 100
  return venda * (1 - c) - custoProd
}

export type FacaMateriaPrima = {
  id: string
  faca_id: string
  materia_prima_id: string
  quantidade: number
  materia_prima?: MateriaPrima
}

// ============================================================
// Movimentações de Estoque
// ============================================================
export type TipoMovimentacao =
  | 'entrada'
  | 'saida_producao'
  | 'saida_venda'
  | 'saida_consumivel'
  | 'ajuste'

export type MovimentacaoEstoque = {
  id: string
  tipo: TipoMovimentacao
  materia_prima_id: string | null
  faca_id: string | null
  consumivel_id: string | null
  pedido_id: string | null
  quantidade: number
  observacao: string | null
  usuario_id: string | null
  created_at: string
  materia_prima?: Pick<MateriaPrima, 'id' | 'codigo' | 'nome'> | null
  faca?: Pick<Faca, 'id' | 'codigo' | 'nome'> | null
  consumivel?: Pick<Consumivel, 'id' | 'codigo' | 'nome'> | null
  usuario?: { id: string; nome: string } | null
}

export type MaterialInsuficiente = {
  materia_prima_id: string
  nome: string
  codigo: string
  necessario: number
  disponivel: number
  falta: number
}

export type PedidoItemComPedido = PedidoItem & {
  pedido?: Pick<Pedido, 'id' | 'codigo' | 'status' | 'data_pedido'> | null
}

// ============================================================
// Módulos do sistema
// ============================================================
export const MODULOS = [
  { key: 'dashboard',       label: 'Dashboard' },
  { key: 'metricas',        label: 'Relatórios' },
  { key: 'materias_primas', label: 'Matérias-Primas' },
  { key: 'movimentacoes_estoque', label: 'Movimentações de Estoque' },
  { key: 'fornecedores',    label: 'Fornecedores' },
  { key: 'facas',           label: 'Facas' },
  { key: 'consumiveis',     label: 'Consumíveis' },
  { key: 'preco_venda',     label: 'Preço de Venda' },
  { key: 'estoque',         label: 'Estoque / Produção' },
  { key: 'vendas',          label: 'Vendas' },
  { key: 'orcamentos',      label: 'Orçamentos' },
  { key: 'clientes',        label: 'Clientes' },
  { key: 'ordens_compra',   label: 'Ordens de Compra' },
  { key: 'gastos',          label: 'Movimentação' },
  { key: 'boletos',         label: 'Boletos' },
  { key: 'usuarios',        label: 'Usuários' },
  { key: 'cargos',          label: 'Cargos' },
  { key: 'lucro',           label: 'Lucro (facas)' },
  { key: 'taxas_lucro',     label: 'Taxas de lucro (config.)' },
] as const

export type ModuloKey = (typeof MODULOS)[number]['key']

export type CargoPermissao = {
  id: string
  cargo_id: string
  modulo: ModuloKey
  ver: boolean
  criar: boolean
  editar: boolean
  deletar: boolean
}

export type Cargo = {
  id: string
  nome: string
  descricao: string | null
  cor: string
  criado_em: string
  permissoes: CargoPermissao[]
}

export const CORES_CARGO = [
  { label: 'Roxo',    value: '#7c3aed' },
  { label: 'Âmbar',  value: '#b45309' },
  { label: 'Azul',   value: '#0369a1' },
  { label: 'Verde',  value: '#15803d' },
  { label: 'Rosa',   value: '#be185d' },
  { label: 'Vermelho', value: '#dc2626' },
  { label: 'Cinza',  value: '#374151' },
  { label: 'Amarelo', value: '#ca8a04' },
] as const

// ============================================================
// Usuários
// ============================================================
export type PerfilUsuario = 'admin' | 'gerente' | 'producao' | 'vendas'

export const PERFIS_USUARIO: { value: PerfilUsuario; label: string }[] = [
  { value: 'admin',    label: 'Administrador' },
  { value: 'gerente',  label: 'Gerente' },
  { value: 'producao', label: 'Produção' },
  { value: 'vendas',   label: 'Vendas' },
]

export type UsuarioPerfil = {
  id: string
  nome: string
  perfil: PerfilUsuario
  ativo: boolean
  cargo_id: string | null
}

// Usuário completo (perfil + dados do auth)
export type Usuario = UsuarioPerfil & {
  email: string
  created_at: string
  cargo?: Pick<Cargo, 'id' | 'nome' | 'cor' | 'permissoes'> | null
  permissoes_customizadas: boolean  // true = tem overrides na tabela usuario_permissoes
}

// ============================================================
// Clientes & Vendas
// ============================================================
export type TipoCliente = 'Lojista' | 'Revendedor' | 'Pessoa Física'
export const TIPOS_CLIENTE: TipoCliente[] = ['Lojista', 'Revendedor', 'Pessoa Física']

export type Cliente = {
  id: string
  nome: string
  tipo: TipoCliente
  telefone: string | null
  email: string | null
  tipo_documento: TipoDocumento
  documento: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  // Campos fiscais (preparação NF-e — opcionais)
  razao_social?: string | null
  ie?: string | null
  /** 1=Contribuinte, 2=Isento, 9=Não contribuinte (default 9). */
  indicador_ie?: number | null
  codigo_municipio_ibge?: string | null
  created_at: string
}

export type StatusPedido = 'em_espera' | 'em_producao' | 'entregue'

export const STATUS_PEDIDO: Record<StatusPedido, { label: string; color: string; bg: string; border: string }> = {
  em_espera:   { label: 'Aguardando pagamento', color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe' },
  em_producao: { label: 'Em Produção', color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
  entregue:    { label: 'Entregue',    color: '#15803d', bg: '#dcfce7', border: '#bbf7d0' },
}

export type PedidoItem = {
  id: string
  pedido_id: string
  faca_id: string
  quantidade: number
  preco_unitario: number
  subtotal: number
  // Snapshot fiscal copiado da faca no momento da venda (NF-e — opcionais)
  ncm?: string | null
  cfop?: string | null
  faca?: Pick<Faca, 'id' | 'codigo' | 'nome' | 'preco_venda' | 'foto_url' | 'unidade' | 'ean_gtin'>
}

/** Dados do cliente retornados em joins de pedidos (listagem e detalhe). */
export type PedidoClienteJoin = Pick<
  Cliente,
  | 'id'
  | 'nome'
  | 'tipo'
  | 'tipo_documento'
  | 'documento'
  | 'cidade'
  | 'estado'
  | 'telefone'
  | 'email'
  | 'cep'
  | 'logradouro'
  | 'numero'
  | 'complemento'
  | 'bairro'
  | 'razao_social'
  | 'ie'
>

export type Pedido = {
  id: string
  codigo: string
  /** Número sequencial humano (#1, #2, ...) atribuído por sequence no banco. */
  sequencial?: number | null
  cliente_id: string | null
  vendedor_id: string | null
  data_pedido: string
  status: StatusPedido
  observacao: string | null
  valor_total: number | null
  frete: number
  /** Desconto em R$ sobre (soma dos itens + frete). Opcional até migração antiga. */
  desconto_total?: number
  /** Natureza da operação para NF-e (default "VENDA DE MERCADORIA"). */
  natureza_operacao?: string | null
  /** Forma de pagamento escolhida na venda (ver FORMAS_PAGAMENTO_OC). */
  forma_pagamento?: FormaPagamentoOC | null
  /**
   * Pagamento registrado. Independe do fluxo em_espera → em_producao → entregue.
   * Em vendas no boleto este campo é ignorado: o recebimento é controlado pelas
   * parcelas pagas do boleto associado.
   */
  pago?: boolean
  entregue_at: string | null
  created_at: string
  cliente?: PedidoClienteJoin | null
  vendedor?: { id: string; nome: string } | null
  itens?: PedidoItem[]
}

/** Resumo de venda exibido no histórico da ficha do cliente. */
export type PedidoHistoricoResumo = {
  id: string
  codigo: string
  sequencial: number | null
  data_pedido: string
  status: StatusPedido
  valor_total: number | null
  vendedor_nome: string | null
}

// ============================================================
// Orçamentos (não impactam estoque, fila de reposição ou métricas
// de vendas; podem ser convertidos em Pedido a qualquer momento)
// ============================================================
export type OrcamentoItem = {
  id: string
  orcamento_id: string
  faca_id: string
  quantidade: number
  preco_unitario: number
  subtotal: number
  faca?: Pick<Faca, 'id' | 'codigo' | 'nome' | 'preco_venda' | 'foto_url'>
}

export type Orcamento = {
  id: string
  codigo: string
  cliente_id: string | null
  vendedor_id: string | null
  data_orcamento: string
  observacao: string | null
  frete: number
  desconto_total: number
  valor_total: number | null
  /** ID do pedido criado quando o orçamento foi convertido em venda. */
  convertido_pedido_id: string | null
  convertido_at: string | null
  created_at: string
  cliente?: Pick<Cliente, 'id' | 'nome' | 'tipo' | 'tipo_documento' | 'documento' | 'cidade' | 'estado'> | null
  vendedor?: { id: string; nome: string } | null
  itens?: OrcamentoItem[]
  /** Resumo do pedido criado quando o orçamento foi convertido (apenas em queries de detalhe). */
  pedido_convertido?: Pick<Pedido, 'id' | 'codigo' | 'status' | 'data_pedido'> | null
}

export const CATEGORIAS_FACA = [
  'Gauchesca',
  'Utilitária',
  'Decorativa',
  'Cozinha',
  'Esportiva',
  'Outro',
] as const

export type CategoriaFaca = (typeof CATEGORIAS_FACA)[number]

// ============================================================
// Ordens de Compra
// ============================================================

export type StatusOC = 'pendente' | 'enviada' | 'recebida'

export const STATUS_OC: Record<StatusOC, { label: string; color: string; bg: string; border: string }> = {
  pendente: { label: 'Pendente', color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
  enviada:  { label: 'Enviada',  color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe' },
  recebida: { label: 'Recebida', color: '#15803d', bg: '#dcfce7', border: '#bbf7d0' },
}

export type OrdemCompraItem = {
  id: string
  ordem_compra_id: string
  materia_prima_id: string
  quantidade: number
  quantidade_vendida: number
  quantidade_adicional: number
  preco_unitario: number | null
  materia_prima?: Pick<MateriaPrima, 'id' | 'codigo' | 'nome' | 'categoria'>
}

export type OrdemCompra = {
  id: string
  codigo: string
  /** Número sequencial dentro do fornecedor (#1, #2, #3 do mesmo fornecedor). */
  sequencial_fornecedor?: number | null
  fornecedor_id: string | null
  fila_reposicao_id: string | null
  status: StatusOC
  /** Pagamento registrado (independente do status operacional pendente → enviada → recebida). */
  pago: boolean
  forma_pagamento: FormaPagamentoOC | null
  data_geracao: string
  desconto_total: number
  observacao: string | null
  ultima_alteracao_usuario_id?: string | null
  ultima_alteracao_em?: string | null
  ultima_alteracao_usuario?: { id: string; nome: string } | null
  created_at: string
  fornecedor?: Pick<Fornecedor, 'id' | 'nome'> | null
  // Derivados do join fila_reposicao → pedidos → clientes. Null para OCs
  // manuais (criadas via "Nova ordem de compra") que não têm pedido de origem.
  pedido_id?: string | null
  pedido_codigo?: string | null
  pedido_sequencial?: number | null
  cliente_nome?: string | null
  itens?: OrdemCompraItem[]
}

/** Resumo de OC exibido no histórico da ficha do fornecedor. */
export type OrdemCompraHistoricoResumo = {
  id: string
  codigo: string
  sequencial_fornecedor: number | null
  data_geracao: string
  status: StatusOC
  pago: boolean
  valor_total: number
  pedido_codigo: string | null
  pedido_sequencial: number | null
  cliente_nome: string | null
}

export type FilaReposicao = {
  id: string
  pedido_id: string
  pedido_codigo: string
  pedido_sequencial?: number | null
  cliente_nome: string
  status: 'pendente' | 'convertida' | 'dispensada'
  created_at: string
  itens_count: number
}

export type FilaReposicaoItemFacaRelacionada = {
  faca_id: string
  faca_nome: string
  estoque_atual: number
  estoque_minimo: number
  quantidade_bom: number
}

export type FilaReposicaoItem = {
  id: string
  fila_id: string
  materia_prima_id: string
  mp_nome: string
  mp_codigo: string
  categoria: string
  mp_preco_custo: number
  fornecedor_id: string | null
  fornecedor_nome: string | null
  estoque_atual: number
  estoque_minimo: number
  quantidade_sugerida: number
  quantidade_adicional: number
  selecionado: boolean
  facas_relacionadas: FilaReposicaoItemFacaRelacionada[]
}

export type FilaReposicaoPedidoItemMp = {
  mp_id: string
  mp_codigo: string
  mp_nome: string
  /** Quantidade de MP consumida por 1 unidade da faca (BOM). */
  quantidade_por_faca: number
  estoque_atual: number
  estoque_minimo: number
}

export type FilaReposicaoPedidoItem = {
  faca_id: string
  faca_codigo: string
  faca_nome: string
  quantidade: number
  preco_unitario: number
  materias_primas: FilaReposicaoPedidoItemMp[]
}

export type FilaReposicaoDetalhe = {
  fila: FilaReposicao
  itens: FilaReposicaoItem[]
  pedido_itens: FilaReposicaoPedidoItem[]
}

export type CategoriaFacaDB = {
  id: string
  nome: string
  cor_texto: string
  cor_fundo: string
  cor_borda: string
  ordem: number
  created_at: string
}

export type CategoriaMateriaPrimaDB = {
  id: string
  nome: string
  ordem: number
  created_at: string
}

export type Consumivel = {
  id: string
  codigo: string
  sku: string
  nome: string
  categoria: string
  fornecedor_id: string | null
  foto_url: string | null
  preco_custo: number
  estoque_atual: number
  estoque_minimo: number
  created_at: string
  // join
  fornecedor?: Fornecedor | null
}

// ============================================================
// Empresa (emitente NF-e) — single-row
// ============================================================
export type Empresa = {
  id: string
  razao_social: string
  nome_fantasia: string | null
  cnpj: string
  ie: string | null
  im: string | null
  /** CRT: 1=Simples Nacional, 2=Simples excesso, 3=Regime Normal, 4=MEI. */
  crt: number
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  codigo_municipio_ibge: string | null
  telefone: string | null
  email: string | null
  created_at: string
  updated_at: string
}

export type CategoriaConsumivelDB = {
  id: string
  nome: string
  ordem: number
  created_at: string
}

export function statusEstoqueConsumivel(c: Consumivel): StatusEstoque {
  if (c.estoque_atual === 0) return 'critico'
  if (c.estoque_atual <= c.estoque_minimo) return 'atencao'
  return 'ok'
}

// ============================================================
// Financeiro — Gastos
// ============================================================

/**
 * O tipo de gasto agora é uma tag dinâmica gerida pelos usuários: o valor
 * guardado em `gastos.tipo` é o próprio nome legível da tag (ex.: "Material de
 * consumo"). As tags vivem na tabela `tipos_gasto`.
 */
export type TipoGasto = string

export type TipoGastoDB = {
  id: string
  nome: string
  /** Tags de sistema não podem ser removidas (geradas/usadas automaticamente). */
  sistema: boolean
  created_at: string
}

/** Tag de sistema gerada ao pagar OCs/boletos. Não pode ser removida. */
export const TIPO_GASTO_PAGAMENTO_OC = 'Pagamento de OC'
/** Tag de sistema usada como destino dos gastos cujo tipo foi removido. */
export const TIPO_GASTO_OUTROS = 'Outros'

export type TipoGastoMeta = { label: string; color: string; bg: string; border: string }

/** Cores fixas das tags conhecidas (preservam a identidade visual original). */
const TIPOS_GASTO_CORES: Record<string, Omit<TipoGastoMeta, 'label'>> = {
  'Benefícios':          { color: '#0e7490', bg: '#cffafe', border: '#a5f3fc' },
  'Investimento':        { color: '#15803d', bg: '#dcfce7', border: '#bbf7d0' },
  'Material de consumo': { color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
  'Administrativo':      { color: '#4338ca', bg: '#e0e7ff', border: '#c7d2fe' },
  'Pagamento de OC':     { color: '#6d28d9', bg: '#ede9fe', border: '#ddd6fe' },
  'Outros':              { color: '#475569', bg: '#f1f5f9', border: '#e2e8f0' },
}

/** Paleta usada para colorir tags novas de forma determinística pelo nome. */
const PALETA_TIPO_GASTO: Omit<TipoGastoMeta, 'label'>[] = [
  { color: '#0e7490', bg: '#cffafe', border: '#a5f3fc' },
  { color: '#15803d', bg: '#dcfce7', border: '#bbf7d0' },
  { color: '#b45309', bg: '#fef3c7', border: '#fde68a' },
  { color: '#4338ca', bg: '#e0e7ff', border: '#c7d2fe' },
  { color: '#6d28d9', bg: '#ede9fe', border: '#ddd6fe' },
  { color: '#be123c', bg: '#ffe4e6', border: '#fecdd3' },
  { color: '#0f766e', bg: '#ccfbf1', border: '#99f6e4' },
  { color: '#a16207', bg: '#fef9c3', border: '#fde68a' },
  { color: '#7c3aed', bg: '#f3e8ff', border: '#e9d5ff' },
  { color: '#475569', bg: '#f1f5f9', border: '#e2e8f0' },
]

function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

/** Resolve o rótulo/cores de uma tag a partir do seu nome. */
export function metaTipoGasto(nome: string): TipoGastoMeta {
  const label = nome?.trim() || TIPO_GASTO_OUTROS
  const fixa = TIPOS_GASTO_CORES[label]
  if (fixa) return { label, ...fixa }
  const cor = PALETA_TIPO_GASTO[hashString(label) % PALETA_TIPO_GASTO.length]
  return { label, ...cor }
}

/**
 * Padroniza o nome de uma tag: remove espaços extras e deixa a primeira letra
 * de cada palavra em maiúscula. Mantém um padrão e evita duplicatas por
 * diferença de capitalização.
 */
export function capitalizarTipoGasto(nome: string): string {
  return (nome ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|\s)(\p{L})/gu, (_m, sep: string, ch: string) => sep + ch.toLocaleUpperCase('pt-BR'))
}

export type FormaPagamento =
  | 'pix'
  | 'dinheiro'
  | 'cartao_credito'
  | 'cartao_debito'
  | 'boleto'
  | 'cheque'
  | 'link'
  | 'transferencia'
  | 'outro'

export const FORMAS_PAGAMENTO: Record<FormaPagamento, { label: string }> = {
  pix:            { label: 'PIX' },
  dinheiro:       { label: 'Dinheiro' },
  cartao_credito: { label: 'Cartão de crédito' },
  cartao_debito:  { label: 'Cartão de débito' },
  boleto:         { label: 'Boleto' },
  cheque:         { label: 'Cheque' },
  link:           { label: 'Link' },
  transferencia:  { label: 'Transferência' },
  outro:          { label: 'Outro' },
}

export type FormaPagamentoOC =
  | 'pix'
  | 'dinheiro'
  | 'cartao_credito'
  | 'boleto'
  | 'cheque'
  | 'link'

export const FORMAS_PAGAMENTO_OC: Record<FormaPagamentoOC, { label: string }> = {
  pix:            { label: 'PIX' },
  dinheiro:       { label: 'Dinheiro' },
  cartao_credito: { label: 'Cartão de crédito' },
  boleto:         { label: 'Boleto' },
  cheque:         { label: 'Cheque' },
  link:           { label: 'Link' },
}

export type Gasto = {
  id: string
  tipo: TipoGasto
  descricao: string
  valor: number
  forma_pagamento: FormaPagamento
  data_gasto: string
  ordem_compra_id: string | null
  boleto_parcela_id: string | null
  observacao: string | null
  usuario_id: string | null
  created_at: string
  ordem_compra?: Pick<OrdemCompra, 'id' | 'codigo'> | null
  usuario?: { id: string; nome: string } | null
}

// ============================================================
// Entradas manuais (outras receitas lançadas à mão)
// ============================================================

/** Categorias sugeridas para entradas manuais (campo livre, mas ajuda a padronizar). */
export const CATEGORIAS_ENTRADA = [
  'Venda avulsa',
  'Serviço',
  'Aporte',
  'Reembolso',
  'Rendimento',
  'Outros',
] as const

export type Entrada = {
  id: string
  descricao: string
  valor: number
  forma_pagamento: FormaPagamento
  data_entrada: string
  categoria: string | null
  observacao: string | null
  usuario_id: string | null
  created_at: string
  usuario?: { id: string; nome: string } | null
}

// ============================================================
// Movimentação financeira (visão unificada de entradas + saídas)
// ============================================================

export type MovimentacaoDirecao = 'entrada' | 'saida'

/** Origem do registro que alimenta a movimentação (define o detalhe/navegação). */
export type MovimentacaoOrigem = 'gasto' | 'entrada_manual' | 'venda' | 'boleto_entrada'

/**
 * Item unificado exibido na página de Movimentação. É montado em runtime a
 * partir de várias fontes (ver `listarMovimentacoes`), portanto é somente
 * leitura — a edição acontece na origem (gasto, entrada manual, venda, boleto).
 */
export type Movimentacao = {
  /** Chave única estável para React (ex.: "gasto:uuid", "venda:uuid"). */
  key: string
  origem: MovimentacaoOrigem
  direcao: MovimentacaoDirecao
  /** Data do caixa (yyyy-mm-dd): data do gasto, do pagamento da parcela, etc. */
  data: string
  descricao: string
  /** Tipo de gasto, categoria da entrada, ou rótulo da origem ("Venda"/"Boleto"). */
  categoria: string | null
  valor: number
  forma_pagamento: FormaPagamento | null
  usuario_nome: string | null
  /** Id do registro de origem (gasto.id, entrada.id, pedido.id, boleto.id). */
  refId: string
  /** Payload do gasto quando origem === 'gasto' (permite editar no detalhe). */
  gasto?: Gasto | null
  /** Payload da entrada quando origem === 'entrada_manual' (permite editar). */
  entrada?: Entrada | null
  /** Código humano para vendas/boletos (ex.: "PD-123", "BE-4"). */
  codigo?: string | null
}

// ============================================================
// Boletos (financeiro — a pagar / a receber)
// ============================================================
export type BoletoTipo = 'entrada' | 'saida'

export type BoletoParcela = {
  id: string
  boleto_id: string
  numero: number
  vencimento: string
  valor: number
  pago_em: string | null
  valor_pago: number | null
  created_at: string
}

export type Boleto = {
  id: string
  tipo: BoletoTipo
  sequencial: number
  contraparte_nome: string
  cnpj_cpf: string | null
  cliente_id: string | null
  fornecedor_id: string | null
  vendedor_id: string | null
  unidades: number | null
  numero_documento: string | null
  valor_total: number
  emitido_em: string | null
  ordem_compra_id: string | null
  pedido_id: string | null
  observacao: string | null
  criado_por: string | null
  created_at: string
  updated_at: string
  parcelas: BoletoParcela[]
  cliente?: Pick<Cliente, 'id' | 'nome'> | null
  fornecedor?: Pick<Fornecedor, 'id' | 'nome'> | null
  vendedor?: { id: string; nome: string } | null
  criador?: { id: string; nome: string } | null
}

/** Código humano do boleto: "BS-x" (saída) ou "BE-x" (entrada). */
export function codigoBoleto(b: Pick<Boleto, 'tipo' | 'sequencial'>): string {
  const prefixo = b.tipo === 'saida' ? 'BS' : 'BE'
  return `${prefixo}-${b.sequencial}`
}

export type BoletoStatus = 'pago' | 'vencido' | 'aberto'

/** Status agregado a partir das parcelas. "vencido" só vale se houver parcela em aberto cuja data já passou. */
export function statusBoleto(b: Pick<Boleto, 'parcelas'>, hojeISO?: string): BoletoStatus {
  const hoje = hojeISO ?? new Date().toISOString().slice(0, 10)
  let temAberto = false
  let temVencido = false
  for (const p of b.parcelas) {
    if (p.pago_em) continue
    temAberto = true
    if (p.vencimento && p.vencimento < hoje) temVencido = true
  }
  if (!temAberto) return 'pago'
  return temVencido ? 'vencido' : 'aberto'
}

export function totalPagoBoleto(b: Pick<Boleto, 'parcelas'>): number {
  return b.parcelas.reduce((s, p) => s + Number(p.valor_pago ?? 0), 0)
}

export function totalAbertoBoleto(b: Pick<Boleto, 'valor_total' | 'parcelas'>): number {
  return Math.max(0, Number(b.valor_total) - totalPagoBoleto(b))
}
