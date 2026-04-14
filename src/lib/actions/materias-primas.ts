'use server'

import { revalidatePath, revalidateTag, unstable_cache } from 'next/cache'
import { createClient, withSupabaseCookieContext } from '@/lib/supabase/server'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { MateriaPrima, MovimentacaoEstoque, Faca, Fornecedor, CategoriaMateriaPrimaDB } from '@/types'
import { getFornecedores } from '@/lib/actions/fornecedores'
import { getCategoriasMateriaPrima } from '@/lib/actions/categorias-materia-prima'
import { gerarCodigoForte } from '@/lib/utils/codigo'

const getMateriasPrimasCached = unstable_cache(
  async (_userId: string, limit: number): Promise<MateriaPrima[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('materias_primas')
      .select(
        '*, fornecedor:fornecedores(id, nome, telefone, email, created_at, tipo_documento, documento, cep, logradouro, numero, complemento, bairro, cidade, uf)'
      )
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
  return gerarCodigoForte('MP')
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
  usuariosRegistro: { id: string; nome: string }[]
}

const getMPDetalheCached = unstable_cache(
  async (_userId: string, mpId: string): Promise<MPDetalheData> => {
    const supabase = await createClient()
    const admin = createAdminClient()

    const [mpRes, bomRes, movRes, usuariosRes] = await Promise.all([
      supabase
        .from('materias_primas')
        .select(
          '*, fornecedor:fornecedores(id, nome, telefone, email, created_at, tipo_documento, documento, cep, logradouro, numero, complemento, bairro, cidade, uf)'
        )
        .eq('id', mpId)
        .single(),
      supabase
        .from('faca_materias_primas')
        .select('quantidade, faca:facas(id, codigo, nome, categoria, estoque_atual)')
        .eq('materia_prima_id', mpId)
        .order('faca_id'),
      // Não usa join para usuario_id → usuarios_perfis para evitar falha silenciosa
      // caso a FK não esteja declarada no banco. O merge é feito manualmente abaixo.
      admin
        .from('movimentacoes_estoque')
        .select('*, faca:facas(id, codigo, nome)')
        .eq('materia_prima_id', mpId)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('usuarios_perfis')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome'),
    ])

    if (mpRes.error) throw new Error(mpRes.error.message)
    if (!mpRes.data) throw new Error('Matéria-prima não encontrada.')
    if (movRes.error) throw new Error(`Erro ao buscar movimentações: ${movRes.error.message}`)

    const facasQueUsam: FacaComQuantidade[] = (bomRes.data ?? []).map((row) => {
      const faca = (Array.isArray(row.faca) ? row.faca[0] : row.faca) as Pick<Faca, 'id' | 'codigo' | 'nome' | 'categoria' | 'estoque_atual'>
      return { ...faca, quantidade: Number(row.quantidade) || 0 }
    })

    // Monta mapa de usuários para enriquecer movimentações sem depender de FK no banco
    const usuariosMap = new Map(
      (usuariosRes.data ?? []).map((u) => [u.id, { id: u.id, nome: u.nome }])
    )
    const movimentacoes = (movRes.data ?? []).map((mov) => ({
      ...mov,
      usuario: mov.usuario_id ? (usuariosMap.get(mov.usuario_id) ?? null) : null,
    })) as MovimentacaoEstoque[]

    return {
      mp: mpRes.data as MateriaPrima,
      facasQueUsam,
      movimentacoes,
      usuariosRegistro: (usuariosRes.data ?? []) as { id: string; nome: string }[],
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
  observacao: string | undefined,
  usuarioRegistroId: string
): Promise<void> {
  await assertPermissao('materias_primas', 'editar')

  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new Error('Quantidade deve ser maior que zero.')
  }
  if (!usuarioRegistroId) {
    throw new Error('Selecione o usuário que está registrando a entrada.')
  }

  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: mp, error: mpErr } = await supabase
    .from('materias_primas')
    .select('id, estoque_atual')
    .eq('id', mpId)
    .single()
  if (mpErr) throw new Error(mpErr.message)
  if (!mp) throw new Error('Matéria-prima não encontrada.')

  const novoEstoque = Math.round((Number(mp.estoque_atual) + quantidade) * 1000) / 1000

  const { data: usuarioRegistro, error: usuarioErr } = await admin
    .from('usuarios_perfis')
    .select('id')
    .eq('id', usuarioRegistroId)
    .eq('ativo', true)
    .single()
  if (usuarioErr) throw new Error(usuarioErr.message)
  if (!usuarioRegistro) throw new Error('Usuário selecionado não encontrado ou inativo.')

  const { error: movErr } = await admin.from('movimentacoes_estoque').insert({
    tipo: 'entrada',
    materia_prima_id: mpId,
    quantidade,
    observacao: observacao?.trim() || null,
    usuario_id: usuarioRegistroId,
  })
  if (movErr) throw new Error(movErr.message)

  const { error: updErr } = await admin
    .from('materias_primas')
    .update({ estoque_atual: novoEstoque })
    .eq('id', mpId)
  if (updErr) throw new Error(updErr.message)

  revalidatePath('/materias-primas')
  revalidateTag('materias-primas-list', 'max')
  revalidateTag('mp-detalhe', 'max')
  revalidateTag('metricas-estoque', 'max')
}

// ============================================================
// Edição de Movimentação de Estoque
// ============================================================

type AtualizarMovInput = {
  movimentacaoId: string
  quantidade: number
  usuarioId: string
  observacao?: string | null
}

/**
 * Atualiza uma movimentação de estoque existente (quantidade, usuário, observação)
 * e reajusta o `estoque_atual` da matéria-prima relacionada para manter
 * a consistência do saldo — aplicando apenas o DELTA entre o valor antigo e o novo.
 *
 * Regras por tipo:
 *   - `entrada`  → estoque += (nova - antiga)
 *   - `ajuste`   → estoque += (nova - antiga)
 *   - `saida_*`  → estoque -= (nova - antiga)
 *
 * Requer permissão `movimentacoes_estoque.editar`.
 */
export async function atualizarMovimentacaoMP(input: AtualizarMovInput): Promise<void> {
  await assertPermissao('movimentacoes_estoque', 'editar')

  const { movimentacaoId, quantidade, usuarioId, observacao } = input

  if (!movimentacaoId) throw new Error('ID da movimentação é obrigatório.')
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new Error('Quantidade deve ser maior que zero.')
  }
  if (!usuarioId) throw new Error('Selecione o usuário responsável.')

  const admin = createAdminClient()

  // 1. Busca movimentação atual
  const { data: movAtual, error: movErr } = await admin
    .from('movimentacoes_estoque')
    .select('id, tipo, quantidade, materia_prima_id')
    .eq('id', movimentacaoId)
    .single()
  if (movErr) throw new Error(movErr.message)
  if (!movAtual) throw new Error('Movimentação não encontrada.')
  if (!movAtual.materia_prima_id) {
    throw new Error('Esta movimentação não está ligada a uma matéria-prima.')
  }

  // 2. Valida usuário
  const { data: usuario, error: userErr } = await admin
    .from('usuarios_perfis')
    .select('id')
    .eq('id', usuarioId)
    .single()
  if (userErr) throw new Error(userErr.message)
  if (!usuario) throw new Error('Usuário não encontrado.')

  // 3. Busca estoque atual da MP
  const { data: mp, error: mpErr } = await admin
    .from('materias_primas')
    .select('id, estoque_atual')
    .eq('id', movAtual.materia_prima_id)
    .single()
  if (mpErr) throw new Error(mpErr.message)
  if (!mp) throw new Error('Matéria-prima vinculada não encontrada.')

  // 4. Calcula delta e novo estoque de acordo com o tipo
  const quantidadeAntiga = Number(movAtual.quantidade)
  const delta = quantidade - quantidadeAntiga

  let novoEstoque: number
  const tipo = movAtual.tipo as string
  if (tipo === 'entrada' || tipo === 'ajuste') {
    novoEstoque = Number(mp.estoque_atual) + delta
  } else if (tipo.startsWith('saida')) {
    novoEstoque = Number(mp.estoque_atual) - delta
  } else {
    // tipo desconhecido — mantém o estoque, só altera a movimentação
    novoEstoque = Number(mp.estoque_atual)
  }

  novoEstoque = Math.round(novoEstoque * 1000) / 1000
  if (novoEstoque < 0) {
    throw new Error(
      `Operação inválida: o novo estoque ficaria negativo (${novoEstoque}). ` +
        `Ajuste antes o estoque manualmente ou corrija outra movimentação primeiro.`
    )
  }

  // 5. Atualiza a movimentação
  const { error: updMovErr } = await admin
    .from('movimentacoes_estoque')
    .update({
      quantidade,
      usuario_id: usuarioId,
      observacao: observacao?.trim() || null,
    })
    .eq('id', movimentacaoId)
  if (updMovErr) throw new Error(updMovErr.message)

  // 6. Atualiza o estoque (se houve delta)
  if (delta !== 0 && novoEstoque !== Number(mp.estoque_atual)) {
    const { error: updMpErr } = await admin
      .from('materias_primas')
      .update({ estoque_atual: novoEstoque })
      .eq('id', mp.id)
    if (updMpErr) throw new Error(updMpErr.message)
  }

  // 7. Invalida caches relacionados
  revalidatePath('/materias-primas')
  revalidatePath(`/materias-primas/${movAtual.materia_prima_id}`)
  revalidateTag('materias-primas-list')
  revalidateTag('mp-detalhe')
  revalidateTag('metricas-estoque')
}
