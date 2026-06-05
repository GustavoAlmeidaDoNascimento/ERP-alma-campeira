'use server'

import { createClient } from '@/lib/supabase/server'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Consumivel } from '@/types'
import { gerarCodigoForte } from '@/lib/utils/codigo'

export async function getConsumiveis(limit = 120): Promise<Consumivel[]> {
  await assertPermissao('consumiveis', 'ver')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('consumiveis')
    .select(
      '*, fornecedor:fornecedores(id, nome, telefone, email, created_at, tipo_documento, documento, cep, logradouro, numero, complemento, bairro, cidade, uf)'
    )
    .order('codigo')
    .limit(limit)
  if (error) throw new Error(error.message)
  return data as Consumivel[]
}

export async function gerarCodigoConsumivel(): Promise<string> {
  return gerarCodigoForte('CN')
}

const FOTO_BUCKET_CONSUMIVEL = 'consumiveis-fotos'

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

export async function salvarConsumivelComFoto(formData: FormData) {
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

  await assertPermissao('consumiveis', isEdit ? 'editar' : 'criar')

  let consumivelId: string

  if (isEdit) {
    consumivelId = id as string
    const { error } = await supabase.from('consumiveis').update({
      nome,
      categoria,
      fornecedor_id: fornecedor_id ? String(fornecedor_id) : null,
      preco_custo,
      estoque_atual: estoque_atual || 0,
      estoque_minimo: estoque_minimo || 0,
    }).eq('id', consumivelId)
    if (error) throw new Error(error.message)
  } else {
    const codigo = await gerarCodigoConsumivel()
    const { data, error } = await supabase
      .from('consumiveis')
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
    if (!data?.id) throw new Error('Falha ao criar consumível.')
    consumivelId = data.id
  }

  // Upload de foto (opcional)
  if (foto && isFileLike(foto)) {
    const admin = createAdminClient()

    const { data: buckets, error: listErr } = await admin.storage.listBuckets()
    if (listErr) throw new Error(listErr.message)

    const exists = (buckets ?? []).some((b: { name: string }) => b.name === FOTO_BUCKET_CONSUMIVEL)
    if (!exists) {
      const { error: createErr } = await admin.storage.createBucket(FOTO_BUCKET_CONSUMIVEL, {
        public: true,
        allowedMimeTypes: ['image/*'],
      })
      if (createErr) throw new Error(createErr.message)
    }

    const fileExt = extFromFile(foto as unknown as { type?: string; name?: string })
    const filePath = `${consumivelId}/foto.${fileExt}`

    const { error: upErr } = await admin.storage
      .from(FOTO_BUCKET_CONSUMIVEL)
      .upload(filePath, foto, {
        upsert: true,
        contentType: foto.type ?? 'image/jpeg',
        cacheControl: '3600',
      })
    if (upErr) throw new Error(upErr.message)

    const { data: pub } = admin.storage.from(FOTO_BUCKET_CONSUMIVEL).getPublicUrl(filePath)
    if (pub?.publicUrl) {
      const { error: fotoUpdateErr } = await supabase
        .from('consumiveis')
        .update({ foto_url: pub.publicUrl })
        .eq('id', consumivelId)
      if (fotoUpdateErr) throw new Error(fotoUpdateErr.message)
    }
  }

}

export async function deletarConsumivel(id: string) {
  await assertPermissao('consumiveis', 'deletar')
  const supabase = await createClient()
  const { error } = await supabase.from('consumiveis').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ============================================================
// Entrada / baixa de estoque — Consumíveis
// ============================================================

export async function entradaEstoqueConsumivel(
  consumivelId: string,
  quantidade: number,
  observacao?: string
): Promise<void> {
  await assertPermissao('consumiveis', 'editar')

  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new Error('Quantidade deve ser maior que zero.')
  }

  const supabase = await createClient()

  const { data: row, error: fetchErr } = await supabase
    .from('consumiveis')
    .select('id, estoque_atual')
    .eq('id', consumivelId)
    .single()
  if (fetchErr) throw new Error(fetchErr.message)
  if (!row) throw new Error('Consumível não encontrado.')

  const novoEstoque = Math.round((Number(row.estoque_atual) + quantidade) * 1000) / 1000
  const userId = await requireAuthenticatedUserId()

  const { error: movErr } = await supabase.from('movimentacoes_estoque').insert({
    tipo: 'entrada',
    consumivel_id: consumivelId,
    quantidade,
    observacao: observacao?.trim() || null,
    usuario_id: userId,
  })
  if (movErr) throw new Error(movErr.message)

  const { error: updErr } = await supabase
    .from('consumiveis')
    .update({ estoque_atual: novoEstoque })
    .eq('id', consumivelId)
  if (updErr) throw new Error(updErr.message)

}

export async function baixaEstoqueConsumivel(
  consumivelId: string,
  quantidade: number,
  observacao?: string
): Promise<void> {
  await assertPermissao('consumiveis', 'editar')

  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new Error('Quantidade deve ser maior que zero.')
  }

  const supabase = await createClient()

  const { data: row, error: fetchErr } = await supabase
    .from('consumiveis')
    .select('id, estoque_atual')
    .eq('id', consumivelId)
    .single()
  if (fetchErr) throw new Error(fetchErr.message)
  if (!row) throw new Error('Consumível não encontrado.')

  const atual = Number(row.estoque_atual)
  if (quantidade > atual) {
    throw new Error('Quantidade maior que o estoque disponível.')
  }

  const novoEstoque = Math.round((atual - quantidade) * 1000) / 1000
  const userId = await requireAuthenticatedUserId()

  const { error: movErr } = await supabase.from('movimentacoes_estoque').insert({
    tipo: 'saida_consumivel',
    consumivel_id: consumivelId,
    quantidade,
    observacao: observacao?.trim() || null,
    usuario_id: userId,
  })
  if (movErr) throw new Error(movErr.message)

  const { error: updErr } = await supabase
    .from('consumiveis')
    .update({ estoque_atual: novoEstoque })
    .eq('id', consumivelId)
  if (updErr) throw new Error(updErr.message)

}
