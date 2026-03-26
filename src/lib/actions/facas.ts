'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { unstable_cache } from 'next/cache'
import { createClient, withSupabaseCookieContext } from '@/lib/supabase/server'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Faca } from '@/types'

const getFacasCached = unstable_cache(
  async (_userId: string, limit: number): Promise<Faca[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('facas')
      .select('*')
      .order('codigo')
      .limit(limit)
    if (error) throw new Error(error.message)
    return data as Faca[]
  },
  ['facas-list'],
  { revalidate: 60, tags: ['facas-list'] }
)

export async function getFacas(limit = 80): Promise<Faca[]> {
  const userId = await requireAuthenticatedUserId()
  return withSupabaseCookieContext(() => getFacasCached(userId, limit))
}

export async function gerarCodigoFaca(): Promise<string> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('facas')
    .select('codigo')
    .order('codigo', { ascending: false })
    .limit(1)
    .single()

  if (!data) return 'FK-0001'
  const num = parseInt(data.codigo.replace('FK-', ''), 10)
  return `FK-${String(num + 1).padStart(4, '0')}`
}

type FacaInput = {
  nome: string
  categoria: string
  preco_venda: number
  estoque_atual: number
  estoque_minimo: number
}

export async function criarFaca(input: FacaInput) {
  await assertPermissao('facas', 'criar')
  const supabase = await createClient()
  const codigo = await gerarCodigoFaca()

  const { error } = await supabase.from('facas').insert({
    codigo,
    nome: input.nome.trim(),
    categoria: input.categoria,
    preco_venda: input.preco_venda,
    estoque_atual: input.estoque_atual,
    estoque_minimo: input.estoque_minimo,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/facas')
  revalidateTag('facas-list')
}

export async function atualizarFaca(id: string, input: FacaInput) {
  await assertPermissao('facas', 'editar')
  const supabase = await createClient()

  const { error } = await supabase
    .from('facas')
    .update({
      nome: input.nome.trim(),
      categoria: input.categoria,
      preco_venda: input.preco_venda,
      estoque_atual: input.estoque_atual,
      estoque_minimo: input.estoque_minimo,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/facas')
  revalidateTag('facas-list')
}

const FOTO_BUCKET_FACAS = 'facas-fotos'

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

export async function salvarFacaComFoto(formData: FormData) {
  const id = formData.get('id')
  const nome = String(formData.get('nome') ?? '').trim()
  const categoria = String(formData.get('categoria') ?? '').trim()
  const preco_venda = Number(formData.get('preco_venda'))
  const estoque_atual = Number(formData.get('estoque_atual'))
  const estoque_minimo = Number(formData.get('estoque_minimo'))
  const foto = formData.get('foto')

  if (!nome) throw new Error('Nome é obrigatório.')
  if (!categoria) throw new Error('Categoria é obrigatória.')
  if (!Number.isFinite(preco_venda)) throw new Error('Preço de venda inválido.')
  if (!Number.isFinite(estoque_atual)) throw new Error('Estoque atual inválido.')
  if (!Number.isFinite(estoque_minimo)) throw new Error('Estoque mínimo inválido.')

  const supabase = await createClient()
  const isEdit = typeof id === 'string' && id.length > 0

  await assertPermissao('facas', isEdit ? 'editar' : 'criar')

  let facaId: string

  if (isEdit) {
    facaId = id as string
    const { error } = await supabase.from('facas').update({
      nome,
      categoria,
      preco_venda,
      estoque_atual,
      estoque_minimo,
    }).eq('id', facaId)
    if (error) throw new Error(error.message)
  } else {
    const codigo = await gerarCodigoFaca()
    const { data, error } = await supabase
      .from('facas')
      .insert({
        codigo,
        nome,
        categoria,
        preco_venda,
        estoque_atual,
        estoque_minimo,
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    if (!data?.id) throw new Error('Falha ao criar faca.')
    facaId = data.id
  }

  // Upload de foto (opcional)
  if (foto && isFileLike(foto)) {
    const admin = createAdminClient()

    // Garante bucket público para download + compactador/transformações.
    const { data: buckets, error: listErr } = await admin.storage.listBuckets()
    if (listErr) throw new Error(listErr.message)

    const exists = (buckets ?? []).some((b) => b.name === FOTO_BUCKET_FACAS)
    if (!exists) {
      const { error: createErr } = await admin.storage.createBucket(FOTO_BUCKET_FACAS, {
        public: true,
        allowedMimeTypes: ['image/*'],
      })
      if (createErr) throw new Error(createErr.message)
    }

    const fileExt = extFromFile(foto as unknown as { type?: string; name?: string })
    const filePath = `${facaId}/foto.${fileExt}`

    const { error: upErr } = await admin.storage
      .from(FOTO_BUCKET_FACAS)
      .upload(filePath, foto, {
        upsert: true,
        contentType: foto.type ?? 'image/jpeg',
        cacheControl: '3600',
      })
    if (upErr) throw new Error(upErr.message)

    const { data: pub } = admin.storage.from(FOTO_BUCKET_FACAS).getPublicUrl(filePath)
    if (pub?.publicUrl) {
      const { error: fotoUpdateErr } = await supabase
        .from('facas')
        .update({ foto_url: pub.publicUrl })
        .eq('id', facaId)
      if (fotoUpdateErr) throw new Error(fotoUpdateErr.message)
    }
  }

  revalidatePath('/facas')
  revalidateTag('facas-list')
}

export async function deletarFaca(id: string) {
  await assertPermissao('facas', 'deletar')
  const supabase = await createClient()
  const { error } = await supabase.from('facas').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/facas')
  revalidateTag('facas-list')
}
