'use server'

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import { createClient, withSupabaseCookieContext } from '@/lib/supabase/server'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { MateriaPrima, MovimentacaoEstoque, Faca, Fornecedor, CategoriaMateriaPrimaDB } from '@/types'
import { getFornecedores } from '@/lib/actions/fornecedores'
import { getCategoriasMateriaPrima } from '@/lib/actions/categorias-materia-prima'

const getMateriasPrimasCached = unstable_cache(
  async (_userId: string, limit: number): Promise<MateriaPrima[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('materias_primas')
      .select('*, fornecedor:fornecedores(id, nome, telefone, email, created_at)')
      .order('codigo')
      .limit(limit)
    if (error) throw new Error(error.message)
    return data as MateriaPrima[]
  },
  ['materias-primas-list'],
  { revalidate: 60, tags: ['materias-primas-list'] }
)

export async function getMatériasPrimas(limit = 120): Promise<MateriaPrima[]> {
  const userId = await requireAuthenticatedUserId()
  return withSupabaseCookieContext(() => getMateriasPrimasCached(userId, limit))
}

export async function gerarCodigoMP(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('materias_primas')
    .select('codigo')
    .order('codigo', { ascending: false })
    .limit(1)
    .single()

  if (!data) return 'MP-0001'
  const num = parseInt(data.codigo.replace('MP-', ''), 10)
  return `MP-${String(num + 1).padStart(4, '0')}`
}

type MPInput = {
  nome: string
  categoria: string
  fornecedor_id: string | null
  preco_custo: number
  estoque_atual: number
  estoque_minimo: number
}

export async function criarMateriaPrima(input: MPInput) {
  await assertPermissao('materias_primas', 'criar')
  const supabase = await createClient()
  const codigo = await gerarCodigoMP()

  const { error } = await supabase.from('materias_primas').insert({
    codigo,
    nome: input.nome.trim(),
    categoria: input.categoria.trim(),
    fornecedor_id: input.fornecedor_id || null,
    preco_custo: input.preco_custo,
    estoque_atual: input.estoque_atual,
    estoque_minimo: input.estoque_minimo,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/materias-primas')
  revalidateTag('materias-primas-list', 'max')
  revalidateTag('metricas-estoque', 'max')
}

export async function atualizarMateriaPrima(id: string, input: MPInput) {
  await assertPermissao('materias_primas', 'editar')
  const supabase = await createClient()

  const { error } = await supabase
    .from('materias_primas')
    .update({
      nome: input.nome.trim(),
      categoria: input.categoria.trim(),
      fornecedor_id: input.fornecedor_id || null,
      preco_custo: input.preco_custo,
      estoque_atual: input.estoque_atual,
      estoque_minimo: input.estoque_minimo,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/materias-primas')
  revalidateTag('materias-primas-list', 'max')
  revalidateTag('metricas-estoque', 'max')
}

const FOTO_BUCKET_MP = 'materias-primas-fotos'

function extFromFile(file: { type?: string; name?: string }): string {
  const mime = file.type ?? ''
  const n = file.name ?? ''
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('jpeg') || mime.includes('jpg') || mime.includes('pjpeg')) return 'jpg'
  const m = n.match(/\.([a-zA-Z0-9]+)$/)
  return (m?.[1]?.toLowerCase() ?? 'jpg') === 'jpeg' ? 'jpg' : (m?.[1]?.toLowerCase() ?? 'jpg')
}

function isFileLike(v: unknown): v is Blob & { type?: string; name?: string } {
  return typeof v === 'object' && v !== null && typeof (v as Blob).arrayBuffer === 'function'
}

export async function salvarMPComFoto(formData: FormData) {
  const id = formData.get('id')
  const nome = String(formData.get('nome') ?? '').trim()
  const categoria = String(formData.get('categoria') ?? '').trim()
  const fornecedor_id = formData.get('fornecedor_id')
  const preco_custo = Number(formData.get('preco_custo'))
  const estoque_atual = Number(formData.get('estoque_atual'))
  const estoque_minimo = Number(formData.get('estoque_minimo'))
  const foto = formData.get('foto')

  if (!nome) throw new Error('Nome é obrigatório.')
  if (!categoria) throw new Error('Categoria é obrigatória.')
  if (!Number.isFinite(preco_custo)) throw new Error('Preço de custo inválido.')

  const supabase = await createClient()
  const isEdit = typeof id === 'string' && id.length > 0

  await assertPermissao('materias_primas', isEdit ? 'editar' : 'criar')

  let mpId: string

  if (isEdit) {
    mpId = id as string
    const { error } = await supabase.from('materias_primas').update({
      nome,
      categoria,
      fornecedor_id: fornecedor_id ? String(fornecedor_id) : null,
      preco_custo,
      estoque_atual: estoque_atual || 0,
      estoque_minimo: estoque_minimo || 0,
    }).eq('id', mpId)
    if (error) throw new Error(error.message)
  } else {
    const codigo = await gerarCodigoMP()
    const { data, error } = await supabase
      .from('materias_primas')
      .insert({
        codigo,
        nome,
        categoria,
        fornecedor_id: fornecedor_id ? String(fornecedor_id) : null,
        preco_custo,
        estoque_atual: estoque_atual || 0,
        estoque_minimo: estoque_minimo || 0,
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    if (!data?.id) throw new Error('Falha ao criar matéria-prima.')
    mpId = data.id
  }

  // Upload de foto (opcional)
  if (foto && isFileLike(foto)) {
    const admin = createAdminClient()

    const { data: buckets, error: listErr } = await admin.storage.listBuckets()
    if (listErr) throw new Error(listErr.message)

    const exists = (buckets ?? []).some((b) => b.name === FOTO_BUCKET_MP)
    if (!exists) {
      const { error: createErr } = await admin.storage.createBucket(FOTO_BUCKET_MP, {
        public: true,
        allowedMimeTypes: ['image/*'],
      })
      if (createErr) throw new Error(createErr.message)
    }

    const fileExt = extFromFile(foto as unknown as { type?: string; name?: string })
    const filePath = `${mpId}/foto.${fileExt}`

    const { error: upErr } = await admin.storage
      .from(FOTO_BUCKET_MP)
      .upload(filePath, foto, {
        upsert: true,
        contentType: foto.type ?? 'image/jpeg',
        cacheControl: '3600',
      })
    if (upErr) throw new Error(upErr.message)

    const { data: pub } = admin.storage.from(FOTO_BUCKET_MP).getPublicUrl(filePath)
    if (pub?.publicUrl) {
      const { error: fotoUpdateErr } = await supabase
        .from('materias_primas')
        .update({ foto_url: pub.publicUrl })
        .eq('id', mpId)
      if (fotoUpdateErr) throw new Error(fotoUpdateErr.message)
    }
  }

  revalidatePath('/materias-primas')
  revalidateTag('materias-primas-list', 'max')
  revalidateTag('metricas-estoque', 'max')
}

export async function deletarMateriaPrima(id: string) {
  await assertPermissao('materias_primas', 'deletar')
  const supabase = await createClient()

  const { data: uso } = await supabase
    .from('faca_materias_primas')
    .select('id')
    .eq('materia_prima_id', id)
    .limit(1)

  if (uso && uso.length > 0) {
    throw new Error('Esta matéria-prima está vinculada a uma ou mais facas e não pode ser excluída.')
  }

  const { error } = await supabase.from('materias_primas').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/materias-primas')
  revalidateTag('materias-primas-list', 'max')
  revalidateTag('metricas-estoque', 'max')
}

// ============================================================
// Detalhe de Matéria-Prima
// ============================================================

type FacaComQuantidade = Pick<Faca, 'id' | 'codigo' | 'nome' | 'categoria' | 'estoque_atual'> & { quantidade: number }

export type MPDetalheData = {
  mp: MateriaPrima
  facasQueUsam: FacaComQuantidade[]
  movimentacoes: MovimentacaoEstoque[]
}

const getMPDetalheCached = unstable_cache(
  async (_userId: string, mpId: string): Promise<MPDetalheData> => {
    const supabase = await createClient()

    const [mpRes, bomRes, movRes] = await Promise.all([
      supabase
        .from('materias_primas')
        .select('*, fornecedor:fornecedores(id, nome, telefone, email, created_at)')
        .eq('id', mpId)
        .single(),
      supabase
        .from('faca_materias_primas')
        .select('quantidade, faca:facas(id, codigo, nome, categoria, estoque_atual)')
        .eq('materia_prima_id', mpId)
        .order('faca_id'),
      supabase
        .from('movimentacoes_estoque')
        .select('*, faca:facas(id, codigo, nome)')
        .eq('materia_prima_id', mpId)
        .order('created_at', { ascending: false })
        .limit(100),
    ])

    if (mpRes.error) throw new Error(mpRes.error.message)
    if (!mpRes.data) throw new Error('Matéria-prima não encontrada.')

    const facasQueUsam: FacaComQuantidade[] = (bomRes.data ?? []).map((row) => {
      const faca = (Array.isArray(row.faca) ? row.faca[0] : row.faca) as Pick<Faca, 'id' | 'codigo' | 'nome' | 'categoria' | 'estoque_atual'>
      return { ...faca, quantidade: Number(row.quantidade) || 0 }
    })

    return {
      mp: mpRes.data as MateriaPrima,
      facasQueUsam,
      movimentacoes: (movRes.data ?? []) as MovimentacaoEstoque[],
    }
  },
  ['mp-detalhe'],
  { revalidate: 30, tags: ['mp-detalhe'] }
)

export async function getMPDetalhe(mpId: string): Promise<MPDetalheData> {
  const userId = await requireAuthenticatedUserId()
  return withSupabaseCookieContext(() => getMPDetalheCached(userId, mpId))
}

// ============================================================
// Dados para o modal de edição (lazy — só carrega quando necessário)
// ============================================================

export type MPEditModalData = {
  fornecedores: Fornecedor[]
  categoriasMateriaPrima: CategoriaMateriaPrimaDB[]
}

export async function getMPEditModalData(): Promise<MPEditModalData> {
  await assertPermissao('materias_primas', 'editar')
  const [fornecedores, categoriasMateriaPrima] = await Promise.all([
    getFornecedores(80),
    getCategoriasMateriaPrima(),
  ])
  return { fornecedores, categoriasMateriaPrima }
}

// ============================================================
// Entrada de Estoque — Matéria-Prima
// ============================================================

export async function entradaEstoqueMP(
  mpId: string,
  quantidade: number,
  observacao?: string
): Promise<void> {
  await assertPermissao('materias_primas', 'editar')

  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new Error('Quantidade deve ser maior que zero.')
  }

  const supabase = await createClient()

  const { data: mp, error: mpErr } = await supabase
    .from('materias_primas')
    .select('id, estoque_atual')
    .eq('id', mpId)
    .single()
  if (mpErr) throw new Error(mpErr.message)
  if (!mp) throw new Error('Matéria-prima não encontrada.')

  const novoEstoque = Math.round((Number(mp.estoque_atual) + quantidade) * 1000) / 1000

  const userId = await requireAuthenticatedUserId()

  const { error: movErr } = await supabase.from('movimentacoes_estoque').insert({
    tipo: 'entrada',
    materia_prima_id: mpId,
    quantidade,
    observacao: observacao?.trim() || null,
    usuario_id: userId,
  })
  if (movErr) throw new Error(movErr.message)

  const { error: updErr } = await supabase
    .from('materias_primas')
    .update({ estoque_atual: novoEstoque })
    .eq('id', mpId)
  if (updErr) throw new Error(updErr.message)

  revalidatePath('/materias-primas')
  revalidateTag('materias-primas-list', 'max')
  revalidateTag('mp-detalhe', 'max')
  revalidateTag('metricas-estoque', 'max')
}
