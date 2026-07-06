'use server'

import { Prisma } from '@prisma/client'
import { assertPermissao } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLocalStorage } from '@/lib/storage'
import { gerarCodigoForte } from '@/lib/utils/codigo'

const FOTO_BUCKET_CONSUMIVEL = 'consumiveis-fotos'

async function gerarCodigoConsumivel(): Promise<string> {
  return gerarCodigoForte('CN')
}

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

function throwFriendlyUniqueError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
    const targets = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : []
    if (targets.includes('sku')) {
      throw new Error('Já existe um consumível com este SKU.')
    }
    if (targets.includes('codigo')) {
      throw new Error('Já existe um consumível com este código.')
    }
  }
  throw error
}

export async function salvarConsumivelComFoto(formData: FormData) {
  const id = formData.get('id')
  const sku = String(formData.get('sku') ?? '').trim()
  const nome = String(formData.get('nome') ?? '').trim()
  const categoria = String(formData.get('categoria') ?? '').trim()
  const fornecedor_id = formData.get('fornecedor_id')
  const preco_custo = Number(formData.get('preco_custo'))
  const estoque_atual = Number(formData.get('estoque_atual'))
  const estoque_minimo = Number(formData.get('estoque_minimo'))
  const foto = formData.get('foto')

  if (!sku) throw new Error('SKU é obrigatório.')
  if (!nome) throw new Error('Nome é obrigatório.')
  if (!categoria) throw new Error('Categoria é obrigatória.')
  if (!Number.isFinite(preco_custo)) throw new Error('Preço de custo inválido.')

  const isEdit = typeof id === 'string' && id.length > 0

  await assertPermissao('consumiveis', isEdit ? 'editar' : 'criar')

  let consumivelId: string

  if (isEdit) {
    consumivelId = id as string
    try {
      await prisma.consumivel.update({
        where: { id: consumivelId },
        data: {
          sku,
          nome,
          categoria,
          fornecedorId: fornecedor_id ? String(fornecedor_id) : null,
          precoCusto: preco_custo,
          estoqueAtual: estoque_atual || 0,
          estoqueMinimo: estoque_minimo || 0,
        },
      })
    } catch (error) {
      throwFriendlyUniqueError(error)
    }
  } else {
    const codigo = await gerarCodigoConsumivel()
    let data: { id: string }
    try {
      data = await prisma.consumivel.create({
        data: {
          codigo,
          sku,
          nome,
          categoria,
          fornecedorId: fornecedor_id ? String(fornecedor_id) : null,
          precoCusto: preco_custo,
          estoqueAtual: estoque_atual || 0,
          estoqueMinimo: estoque_minimo || 0,
        },
        select: { id: true },
      })
    } catch (error) {
      throwFriendlyUniqueError(error)
    }
    consumivelId = data.id
    if (!consumivelId) throw new Error('Falha ao criar consumível.')
  }

  if (foto && isFileLike(foto)) {
    const storage = createLocalStorage()

    const { data: buckets, error: listErr } = await storage.listBuckets()
    if (listErr) throw new Error(listErr.message)

    const exists = (buckets ?? []).some((b: { name: string }) => b.name === FOTO_BUCKET_CONSUMIVEL)
    if (!exists) {
      await storage.createBucket(FOTO_BUCKET_CONSUMIVEL)
    }

    const fileExt = extFromFile(foto as unknown as { type?: string; name?: string })
    const filePath = `${consumivelId}/foto.${fileExt}`

    const { error: upErr } = await storage
      .from(FOTO_BUCKET_CONSUMIVEL)
      .upload(filePath, foto, {
        upsert: true,
        contentType: foto.type ?? 'image/jpeg',
        cacheControl: '3600',
      })
    if (upErr) throw new Error(upErr.message)

    const { data: pub } = storage.from(FOTO_BUCKET_CONSUMIVEL).getPublicUrl(filePath)
    if (pub?.publicUrl) {
      await prisma.consumivel.update({
        where: { id: consumivelId },
        data: { fotoUrl: pub.publicUrl },
      })
    }
  }
}
