export type Fornecedor = {
  id: string
  nome: string
  telefone: string | null
  email: string | null
  created_at: string
}

export type MateriaPrima = {
  id: string
  codigo: string
  nome: string
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
  nome: string
  categoria: string
  foto_url: string | null
  preco_venda: number
  estoque_atual: number
  created_at: string
}

export type FacaMateriaPrima = {
  id: string
  faca_id: string
  materia_prima_id: string
  quantidade: number
  materia_prima?: MateriaPrima
}

// ============================================================
// Módulos do sistema
// ============================================================
export const MODULOS = [
  { key: 'dashboard',       label: 'Dashboard' },
  { key: 'materias_primas', label: 'Matérias-Primas' },
  { key: 'fornecedores',    label: 'Fornecedores' },
  { key: 'facas',           label: 'Facas' },
  { key: 'estoque',         label: 'Estoque / Produção' },
  { key: 'vendas',          label: 'Vendas' },
  { key: 'clientes',        label: 'Clientes' },
  { key: 'ordens_compra',   label: 'Ordens de Compra' },
  { key: 'usuarios',        label: 'Usuários' },
  { key: 'cargos',          label: 'Cargos' },
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
  cidade: string | null
  estado: string | null
  created_at: string
}

export type StatusPedido = 'em_espera' | 'em_producao' | 'entregue'

export const STATUS_PEDIDO: Record<StatusPedido, { label: string; color: string; bg: string; border: string }> = {
  em_espera:   { label: 'Em espera',   color: '#1d4ed8', bg: '#dbeafe', border: '#bfdbfe' },
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
  faca?: Pick<Faca, 'id' | 'codigo' | 'nome' | 'preco_venda'>
}

export type Pedido = {
  id: string
  codigo: string
  cliente_id: string | null
  data_pedido: string
  status: StatusPedido
  observacao: string | null
  valor_total: number | null
  entregue_at: string | null
  created_at: string
  cliente?: Pick<Cliente, 'id' | 'nome' | 'tipo'> | null
  itens?: PedidoItem[]
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
  preco_unitario: number | null
  materia_prima?: Pick<MateriaPrima, 'id' | 'codigo' | 'nome'>
}

export type OrdemCompra = {
  id: string
  codigo: string
  fornecedor_id: string | null
  status: StatusOC
  data_geracao: string
  observacao: string | null
  created_at: string
  fornecedor?: Pick<Fornecedor, 'id' | 'nome'> | null
  itens?: OrdemCompraItem[]
}

export type FilaItemAgrupado = {
  materia_prima_id: string
  mp_codigo: string
  mp_nome: string
  mp_preco_custo: number
  quantidade_total: number
}

export type FilaFornecedor = {
  fornecedor_id: string | null
  fornecedor_nome: string
  itens: FilaItemAgrupado[]
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
