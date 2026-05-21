import { unstable_cache } from 'next/cache'
import { createClient, withSupabaseCookieContext } from '@/lib/supabase/server'
import { withTiming } from '@/lib/perf/timing'
import type {
  MateriaPrima,
  Fornecedor,
  CategoriaMateriaPrimaDB,
  Faca,
  CategoriaFacaDB,
  Cliente,
  OrdemCompra,
  FilaReposicao,
  StatusOC,
} from '@/types'

const STATUS_OC_VALIDOS: readonly StatusOC[] = ['pendente', 'enviada', 'recebida']
function normalizarStatusEPagoCache(row: { status?: unknown; pago?: unknown }): { status: StatusOC; pago: boolean } {
  let status = String(row.status ?? 'pendente')
  let pago = Boolean(row.pago)
  if (status === 'pago') { status = 'enviada'; pago = true }
  if (!STATUS_OC_VALIDOS.includes(status as StatusOC)) status = 'pendente'
  return { status: status as StatusOC, pago }
}
function embedUm<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

type TaxasLucroConfig = {
  taxa_producao: number
  margem_lucro: number
  taxa_comissao: number
}

const LIST_REVALIDATE = 60

function materiasPrimasCache(userId: string) {
  return unstable_cache(
    async (): Promise<MateriaPrima[]> => {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('materias_primas')
        .select('*, fornecedor:fornecedores(id, nome)')
        .order('codigo')
        .limit(120)
      if (error) throw new Error(error.message)
      return data as MateriaPrima[]
    },
    ['list-materias-primas', userId],
    { revalidate: LIST_REVALIDATE, tags: [`list-materias-primas-${userId}`] },
  )
}

function fornecedoresSelectCache(userId: string) {
  return unstable_cache(
    async (): Promise<Pick<Fornecedor, 'id' | 'nome'>[]> => {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('fornecedores')
        .select('id, nome')
        .order('nome')
        .limit(80)
      if (error) throw new Error(error.message)
      return data ?? []
    },
    ['list-fornecedores-select', userId],
    { revalidate: LIST_REVALIDATE, tags: [`list-fornecedores-select-${userId}`] },
  )
}

const CATEGORIAS_PADRAO: CategoriaMateriaPrimaDB[] = [
  { id: 'fallback-bainha', nome: 'Bainha', ordem: 1, created_at: '' },
  { id: 'fallback-botao', nome: 'Botão', ordem: 2, created_at: '' },
  { id: 'fallback-lamina', nome: 'Lâmina', ordem: 3, created_at: '' },
  { id: 'fallback-cabo', nome: 'Cabo', ordem: 4, created_at: '' },
]

function categoriasMPCache(userId: string) {
  return unstable_cache(
    async (): Promise<CategoriaMateriaPrimaDB[]> => {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('categorias_materia_prima')
        .select('*')
        .order('ordem')
      if (error) throw new Error(error.message)
      const categorias = (data ?? []) as CategoriaMateriaPrimaDB[]
      return categorias.length > 0 ? categorias : CATEGORIAS_PADRAO
    },
    ['list-categorias-mp', userId],
    { revalidate: LIST_REVALIDATE, tags: [`list-categorias-mp-${userId}`] },
  )
}

export function fetchMatériasPrimasList(userId: string): Promise<MateriaPrima[]> {
  return withSupabaseCookieContext(() => materiasPrimasCache(userId)())
}

export function fetchFornecedoresSelect(userId: string): Promise<Pick<Fornecedor, 'id' | 'nome'>[]> {
  return withSupabaseCookieContext(() => fornecedoresSelectCache(userId)())
}

export function fetchCategoriasMateriaPrimaList(userId: string): Promise<CategoriaMateriaPrimaDB[]> {
  return withSupabaseCookieContext(() => categoriasMPCache(userId)())
}

// ============================================================
// Facas (com custo calculado via BOM)
// ============================================================

function facasComCustoCache(userId: string) {
  return unstable_cache(
    async (): Promise<Faca[]> => {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('facas')
        .select('*')
        .order('codigo')
        .limit(120)
      if (error) throw new Error(error.message)
      const facas = (data ?? []) as Faca[]
      const ids = facas.map((f) => f.id)
      if (ids.length === 0) return facas
      const { data: boms, error: bomsErr } = await supabase
        .from('faca_materias_primas')
        .select('faca_id, quantidade, materia_prima:materias_primas(preco_custo)')
        .in('faca_id', ids)
      if (bomsErr) throw new Error(bomsErr.message)
      const base = new Map<string, number>()
      for (const b of boms ?? []) {
        const mp = (Array.isArray(b.materia_prima) ? b.materia_prima[0] : b.materia_prima) as
          | { preco_custo: number }
          | null
        const custo = Number(mp?.preco_custo ?? 0)
        const qtd = Number(b.quantidade ?? 0)
        base.set(b.faca_id, (base.get(b.faca_id) ?? 0) + custo * qtd)
      }
      return facas.map((f) => ({
        ...f,
        preco_custo: Math.round((base.get(f.id) ?? 0) * 100) / 100,
      }))
    },
    ['list-facas-com-custo', userId],
    { revalidate: LIST_REVALIDATE, tags: [`list-facas-${userId}`] },
  )
}

export function fetchFacasComCustoList(userId: string): Promise<Faca[]> {
  return withSupabaseCookieContext(() => facasComCustoCache(userId)())
}

// ============================================================
// Categorias de Faca
// ============================================================

function categoriasFacaCache(userId: string) {
  return unstable_cache(
    async (): Promise<CategoriaFacaDB[]> => {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('categorias_faca')
        .select('*')
        .order('ordem')
      if (error) throw new Error(error.message)
      return (data ?? []) as CategoriaFacaDB[]
    },
    ['list-categorias-faca', userId],
    { revalidate: LIST_REVALIDATE, tags: [`list-categorias-faca-${userId}`] },
  )
}

export function fetchCategoriasFacaList(userId: string): Promise<CategoriaFacaDB[]> {
  return withSupabaseCookieContext(() => categoriasFacaCache(userId)())
}

// ============================================================
// Fornecedores (lista completa)
// ============================================================

function fornecedoresFullCache(userId: string) {
  return unstable_cache(
    async (): Promise<Fornecedor[]> => {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('fornecedores')
        .select('*')
        .order('nome')
        .limit(120)
      if (error) throw new Error(error.message)
      return (data ?? []) as Fornecedor[]
    },
    ['list-fornecedores-full', userId],
    { revalidate: LIST_REVALIDATE, tags: [`list-fornecedores-${userId}`] },
  )
}

export function fetchFornecedoresFullList(userId: string): Promise<Fornecedor[]> {
  return withSupabaseCookieContext(() => fornecedoresFullCache(userId)())
}

// ============================================================
// Clientes
// ============================================================

function clientesCache(userId: string) {
  return unstable_cache(
    async (): Promise<Cliente[]> => {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('nome')
        .limit(120)
      if (error) throw new Error(error.message)
      return (data ?? []) as Cliente[]
    },
    ['list-clientes', userId],
    { revalidate: LIST_REVALIDATE, tags: [`list-clientes-${userId}`] },
  )
}

export function fetchClientesList(userId: string): Promise<Cliente[]> {
  return withSupabaseCookieContext(() => clientesCache(userId)())
}

// ============================================================
// Taxas de Lucro (config global)
// ============================================================

const taxasLucroCacheFn = unstable_cache(
  async (): Promise<TaxasLucroConfig> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('app_config')
      .select('taxa_producao_lucro, margem_lucro, taxa_comissao_lucro')
      .eq('id', 1)
      .maybeSingle()
    if (error || !data) return { taxa_producao: 0, margem_lucro: 0, taxa_comissao: 0 }
    return {
      taxa_producao: Number(data.taxa_producao_lucro ?? 0),
      margem_lucro: Number(data.margem_lucro ?? 0),
      taxa_comissao: Number(data.taxa_comissao_lucro ?? 0),
    }
  },
  ['app-config-taxas-lucro'],
  { revalidate: 600, tags: ['app-config-taxas-lucro'] },
)

export function fetchTaxasLucroConfig(): Promise<TaxasLucroConfig> {
  return withSupabaseCookieContext(() => taxasLucroCacheFn())
}

// ============================================================
// Ordens de Compra (lista) — 4 queries em paralelo, depois cacheado.
// IMPORTANTE: NÃO unificar isso num único embed aninhado. Já tentamos
// e o PostgREST gera um SQL com vários LEFT JOIN LATERAL que ESTOURA
// o statement_timeout do Supabase (>30s mesmo em base pequena).
// O padrão atual mantém cada round-trip <1s mesmo cold; combinado
// com unstable_cache (revalidate 60s), F5 vira ~10ms.
// ============================================================

type FornecedorRef = { id: string; nome: string }
type UsuarioRef = { id: string; nome: string }
type MateriaPrimaRef = { id: string; codigo: string; nome: string }

type OcItemRow = {
  id: string
  ordem_compra_id: string
  materia_prima_id: string
  quantidade: number
  quantidade_vendida: number
  quantidade_adicional: number
  preco_unitario: number
  materia_prima: MateriaPrimaRef | MateriaPrimaRef[] | null
}

type FilaRefRow = {
  id: string
  pedido:
    | { id: string; codigo: string; sequencial: number | null; cliente: { id: string; nome: string } | { id: string; nome: string }[] | null }
    | { id: string; codigo: string; sequencial: number | null; cliente: { id: string; nome: string } | { id: string; nome: string }[] | null }[]
    | null
}

function ordensCompraCache(userId: string) {
  return unstable_cache(
    async (): Promise<OrdemCompra[]> => {
      const supabase = await createClient()

      // 1ª round: cabeçalho + embeds rasos (1:1, FK direta — embed barato).
      const { data, error } = await supabase
        .from('ordens_compra')
        .select(`
          *,
          fornecedor:fornecedores!fornecedor_id(id, nome),
          ultima_alteracao_usuario:usuarios_perfis!ultima_alteracao_usuario_id(id, nome)
        `)
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)

      type RowOC = Record<string, unknown> & {
        id: string
        fornecedor?: FornecedorRef | FornecedorRef[] | null
        ultima_alteracao_usuario?: UsuarioRef | UsuarioRef[] | null
        fornecedor_id?: string | null
        fila_reposicao_id?: string | null
      }
      const rows = (data ?? []) as RowOC[]
      const ocIds = rows.map((r) => r.id)
      const filaIds = [
        ...new Set(
          rows
            .map((r) => r.fila_reposicao_id)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        ),
      ]

      // 2ª round: itens e filas em paralelo (2 queries, mas paralelas — 1 RTT efetivo).
      const [itensRes, filaRes] = await Promise.all([
        ocIds.length === 0
          ? Promise.resolve({ data: [] as OcItemRow[], error: null })
          : supabase
              .from('ordem_compra_itens')
              .select(`
                id, ordem_compra_id, materia_prima_id,
                quantidade, quantidade_vendida, quantidade_adicional,
                preco_unitario,
                materia_prima:materias_primas(id, codigo, nome)
              `)
              .in('ordem_compra_id', ocIds),
        filaIds.length === 0
          ? Promise.resolve({ data: [] as FilaRefRow[], error: null })
          : supabase
              .from('fila_reposicao')
              .select(`
                id,
                pedido:pedidos(id, codigo, sequencial, cliente:clientes(id, nome))
              `)
              .in('id', filaIds),
      ])
      if (itensRes.error) throw new Error(itensRes.error.message)
      if (filaRes.error) throw new Error(filaRes.error.message)

      const itensPorOC = new Map<string, OcItemRow[]>()
      for (const it of (itensRes.data ?? []) as OcItemRow[]) {
        const arr = itensPorOC.get(it.ordem_compra_id) ?? []
        arr.push(it)
        itensPorOC.set(it.ordem_compra_id, arr)
      }
      const filaPorId = new Map<string, FilaRefRow>()
      for (const f of (filaRes.data ?? []) as FilaRefRow[]) filaPorId.set(f.id, f)

      return rows.map((row) => {
        const fila = row.fila_reposicao_id ? filaPorId.get(row.fila_reposicao_id) ?? null : null
        const pedido = fila?.pedido ? embedUm(fila.pedido) : null
        const cliente = pedido?.cliente ? embedUm(pedido.cliente) : null
        const fornecedor = embedUm(row.fornecedor ?? null)
        const ultUser = embedUm(row.ultima_alteracao_usuario ?? null)
        const itens = (itensPorOC.get(row.id) ?? []).map((it) => ({
          ...it,
          materia_prima: embedUm(it.materia_prima),
        }))
        const { status, pago } = normalizarStatusEPagoCache(row as { status?: unknown; pago?: unknown })
        return {
          ...row,
          fornecedor,
          ultima_alteracao_usuario: ultUser,
          itens,
          pedido_id: pedido?.id ?? null,
          pedido_codigo: pedido?.codigo ?? null,
          pedido_sequencial: pedido?.sequencial ?? null,
          cliente_nome: cliente?.nome ?? null,
          status,
          pago,
        }
      }) as unknown as OrdemCompra[]
    },
    ['list-ordens-compra', userId],
    { revalidate: 60, tags: [`list-ordens-compra-${userId}`] },
  )
}

export function fetchOrdensCompraList(userId: string): Promise<OrdemCompra[]> {
  return withSupabaseCookieContext(() =>
    withTiming('cache:fetchOrdensCompraList', () => ordensCompraCache(userId)()),
  )
}

// ============================================================
// Fila de Reposição (lista) — só pendentes, com contagem de itens.
// ============================================================

function filaReposicaoCache(userId: string) {
  return unstable_cache(
    async (): Promise<FilaReposicao[]> => {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('fila_reposicao')
        .select(`
          id, pedido_id, status, created_at,
          pedido:pedidos(id, codigo, sequencial, cliente:clientes(id, nome)),
          itens:fila_reposicao_itens(id)
        `)
        .in('status', ['pendente'])
        .order('created_at', { ascending: false })
      if (error) throw new Error(error.message)

      return (data ?? []).map((row) => {
        const pedido = embedUm(row.pedido as { id: string; codigo: string; sequencial: number | null; cliente: { id: string; nome: string } | { id: string; nome: string }[] | null } | { id: string; codigo: string; sequencial: number | null; cliente: { id: string; nome: string } | { id: string; nome: string }[] | null }[] | null)
        const cliente = pedido?.cliente ? embedUm(pedido.cliente) : null
        return {
          id: row.id,
          pedido_id: row.pedido_id,
          pedido_codigo: pedido?.codigo ?? '—',
          pedido_sequencial: pedido?.sequencial ?? null,
          cliente_nome: cliente?.nome ?? '—',
          status: row.status as FilaReposicao['status'],
          created_at: row.created_at ?? '',
          itens_count: Array.isArray(row.itens) ? row.itens.length : 0,
        }
      })
    },
    ['list-fila-reposicao', userId],
    { revalidate: 60, tags: [`list-fila-reposicao-${userId}`] },
  )
}

export function fetchFilaReposicaoList(userId: string): Promise<FilaReposicao[]> {
  return withSupabaseCookieContext(() =>
    withTiming('cache:fetchFilaReposicaoList', () => filaReposicaoCache(userId)()),
  )
}

// ============================================================
// Usuários ativos (para registrar alteração na OC)
// ============================================================

function usuariosRegistroOCCache(userId: string) {
  return unstable_cache(
    async (): Promise<{ id: string; nome: string }[]> => {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from('usuarios_perfis')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome')
      if (error) throw new Error(error.message)
      return data ?? []
    },
    ['list-usuarios-registro-oc', userId],
    { revalidate: 300, tags: [`list-usuarios-registro-oc-${userId}`] },
  )
}

export function fetchUsuariosRegistroOC(userId: string): Promise<{ id: string; nome: string }[]> {
  return withSupabaseCookieContext(() =>
    withTiming('cache:fetchUsuariosRegistroOC', () => usuariosRegistroOCCache(userId)()),
  )
}
