'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { unstable_cache } from 'next/cache'
import { createClient, withSupabaseCookieContext } from '@/lib/supabase/server'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Faca, FacaMateriaPrima, MovimentacaoEstoque, PedidoItemComPedido, MaterialInsuficiente } from '@/types'
import { gerarCodigoForte } from '@/lib/utils/codigo'

const getFacasCached = unstable_cache(
  async (_userId: string, limit: number): Promise<Faca[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('facas')
      .select('*')
      .order('codigo')
      .limit(limit)
    if (error) throw new Error(error.message)
    const facas = data as Faca[]
    const custoByFaca = await calcularPrecoCustoPorFaca(supabase, facas)
    return facas.map((f) => ({ ...f, preco_custo: custoByFaca.get(f.id) ?? 0 }))
  },
  ['facas-list'],
  { revalidate: 60, tags: ['facas-list'] }
)

export async function getFacas(limit = 80): Promise<Faca[]> {
  const userId = await requireAuthenticatedUserId()
  return withSupabaseCookieContext(() => getFacasCached(userId, limit))
}

export async function gerarCodigoFaca(): Promise<string> {
  return gerarCodigoForte('FK')
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
    taxa_producao: 0,
    taxa_venda: 0,
    preco_venda: input.preco_venda,
    estoque_atual: input.estoque_atual,
    estoque_minimo: input.estoque_minimo,
  })

  if (error) throw new Error(error.message)
  revalidatePath('/facas')
  revalidateTag('facas-list', 'max')
}

export async function atualizarFaca(id: string, input: FacaInput) {
  await assertPermissao('facas', 'editar')
  const supabase = await createClient()

  const { error } = await supabase
    .from('facas')
    .update({
      nome: input.nome.trim(),
      categoria: input.categoria,
      taxa_producao: 0,
      taxa_venda: 0,
      preco_venda: input.preco_venda,
      estoque_atual: input.estoque_atual,
      estoque_minimo: input.estoque_minimo,
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/facas')
  revalidateTag('facas-list', 'max')
  revalidateTag('metricas-estoque', 'max')
}

export type DeletarFacaModo = 'desmontar' | 'apagar_materias_primas'

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
  const estoque_atual = Number(formData.get('estoque_atual'))
  const estoque_minimo = Number(formData.get('estoque_minimo'))
  const foto = formData.get('foto')
  const bomRaw = formData.get('bom')

  if (!nome) throw new Error('Nome é obrigatório.')
  if (!categoria) throw new Error('Categoria é obrigatória.')
  if (!Number.isFinite(estoque_atual)) throw new Error('Estoque atual inválido.')
  if (!Number.isFinite(estoque_minimo)) throw new Error('Estoque mínimo inválido.')

  // Parse e valida BOM
  let bomItens: { materia_prima_id: string; quantidade: number }[] = []
  if (typeof bomRaw === 'string' && bomRaw.length > 0) {
    try { bomItens = JSON.parse(bomRaw) } catch { throw new Error('BOM inválido.') }
  }
  if (bomItens.length === 0) throw new Error('Adicione pelo menos 1 matéria-prima.')
  for (const item of bomItens) {
    if (!item.materia_prima_id || !item.quantidade || item.quantidade <= 0) {
      throw new Error('Cada matéria-prima precisa de uma quantidade válida (> 0).')
    }
  }

  const supabase = await createClient()
  const isEdit = typeof id === 'string' && id.length > 0

  await assertPermissao('facas', isEdit ? 'editar' : 'criar')

  // Calcular custo BOM para auto-calcular preço de venda
  const mpIds = bomItens.map((i) => i.materia_prima_id)
  const { data: mpsData } = await supabase
    .from('materias_primas')
    .select('id, preco_custo')
    .in('id', mpIds)
  const precoCustoById = new Map((mpsData ?? []).map((m: { id: string; preco_custo: number }) => [m.id, Number(m.preco_custo ?? 0)]))
  const custoBom = bomItens.reduce((acc, item) => acc + (precoCustoById.get(item.materia_prima_id) ?? 0) * item.quantidade, 0)

  const { data: configData } = await supabase
    .from('app_config')
    .select('taxa_producao_lucro, margem_lucro')
    .eq('id', 1)
    .maybeSingle()
  const taxas = {
    taxa_producao: Number(configData?.taxa_producao_lucro ?? 0),
    margem_lucro: Number(configData?.margem_lucro ?? 0),
  }
  const custoProd = custoBom + taxas.taxa_producao
  const preco_venda = custoProd * (1 + taxas.margem_lucro / 100)

  let facaId: string

  if (isEdit) {
    facaId = id as string
    const { error } = await supabase.from('facas').update({
      nome,
      categoria,
      taxa_producao: 0,
      taxa_venda: 0,
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
        taxa_producao: 0,
        taxa_venda: 0,
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

  // Salvar BOM: deletar existentes e inserir novos
  const { error: delBomErr } = await supabase
    .from('faca_materias_primas')
    .delete()
    .eq('faca_id', facaId)
  if (delBomErr) throw new Error(delBomErr.message)

  const bomRows = bomItens.map((item) => ({
    faca_id: facaId,
    materia_prima_id: item.materia_prima_id,
    quantidade: item.quantidade,
  }))
  const { error: insBomErr } = await supabase
    .from('faca_materias_primas')
    .insert(bomRows)
  if (insBomErr) throw new Error(insBomErr.message)

  revalidatePath('/facas')
  revalidateTag('facas-list', 'max')
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000
}

export async function deletarFaca(id: string, modo: DeletarFacaModo = 'desmontar') {
  await assertPermissao('facas', 'deletar')
  const supabase = await createClient()

  if (modo === 'desmontar') {
    const { data: faca, error: facaErr } = await supabase
      .from('facas')
      .select('id, codigo, estoque_atual')
      .eq('id', id)
      .single()

    if (facaErr) throw new Error(facaErr.message)
    if (!faca) throw new Error('Faca não encontrada.')

    const estoqueFaca = Number(faca.estoque_atual) || 0
    if (estoqueFaca > 0) {
      const { data: boms, error: bomsErr } = await supabase
        .from('faca_materias_primas')
        .select('materia_prima_id, quantidade')
        .eq('faca_id', id)

      if (bomsErr) throw new Error(bomsErr.message)

      const mpIds = [...new Set((boms ?? []).map((b) => b.materia_prima_id))] as string[]
      if (mpIds.length > 0) {
        const { data: mps, error: mpsErr } = await supabase
          .from('materias_primas')
          .select('id, estoque_atual')
          .in('id', mpIds)

        if (mpsErr) throw new Error(mpsErr.message)

        const mpMap = new Map<string, { estoque_atual: number }>()
        for (const mp of mps ?? []) {
          mpMap.set(mp.id, { estoque_atual: Number(mp.estoque_atual) || 0 })
        }

        const userId = await requireAuthenticatedUserId()

        for (const bom of (boms ?? [])) {
          const mp = mpMap.get(bom.materia_prima_id)
          if (!mp) continue

          const quantidadePorFaca = Number(bom.quantidade) || 0
          const delta = round3(estoqueFaca * quantidadePorFaca)
          if (!delta) continue

          const novoEstoque = round3(mp.estoque_atual + delta)
          mp.estoque_atual = novoEstoque

          const { error: updErr } = await supabase
            .from('materias_primas')
            .update({ estoque_atual: novoEstoque })
            .eq('id', bom.materia_prima_id)
          if (updErr) throw new Error(updErr.message)

          // `movimentacoes_estoque.faca_id` restringe exclusões; mantemos `faca_id` como NULL.
          const { error: movErr } = await supabase.from('movimentacoes_estoque').insert({
            tipo: 'ajuste',
            materia_prima_id: bom.materia_prima_id,
            quantidade: delta,
            observacao: `Desmontar faca ${faca.codigo}`,
            usuario_id: userId,
          })
          if (movErr) throw new Error(movErr.message)
        }
      }
    }

    // Atualiza telas de matérias-primas após devolver o estoque.
    revalidatePath('/materias-primas')
    revalidateTag('materias-primas-list', 'max')
  }

  if (modo === 'apagar_materias_primas') {
    const { data: boms, error: bomsErr } = await supabase
      .from('faca_materias_primas')
      .select('materia_prima_id')
      .eq('faca_id', id)

    if (bomsErr) throw new Error(bomsErr.message)
    const mpIds = [...new Set((boms ?? []).map((b) => b.materia_prima_id))] as string[]

    const { error: delFacaErr } = await supabase.from('facas').delete().eq('id', id)
    if (delFacaErr) throw new Error(delFacaErr.message)

    for (const mpId of mpIds) {
      const { data: uso, error: usoErr } = await supabase
        .from('faca_materias_primas')
        .select('id')
        .eq('materia_prima_id', mpId)
        .limit(1)
      if (usoErr) throw new Error(usoErr.message)

      if (!uso || uso.length === 0) {
        const { error: delMpErr } = await supabase.from('materias_primas').delete().eq('id', mpId)
        if (delMpErr) throw new Error(delMpErr.message)
      }
    }

    revalidatePath('/materias-primas')
    revalidateTag('materias-primas-list', 'max')
  } else {
    const { error } = await supabase.from('facas').delete().eq('id', id)
    if (error) throw new Error(error.message)
  }

  revalidatePath('/facas')
  revalidateTag('facas-list', 'max')
  revalidateTag('faca-detalhe', 'max')
}

// ============================================================
// BOM & Detalhe
// ============================================================

export async function getFacaBOM(facaId: string): Promise<FacaMateriaPrima[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('faca_materias_primas')
    .select('*, materia_prima:materias_primas(id, codigo, nome, preco_custo, estoque_atual, estoque_minimo, foto_url, fornecedor_id, created_at)')
    .eq('faca_id', facaId)
    .order('id')
  if (error) throw new Error(error.message)
  return (data ?? []) as FacaMateriaPrima[]
}

export type FacaDetalheData = {
  faca: Faca
  bom: FacaMateriaPrima[]
  vendas: PedidoItemComPedido[]
  movimentacoes: MovimentacaoEstoque[]
}

const getFacaDetalheCached = unstable_cache(
  async (_userId: string, facaId: string): Promise<FacaDetalheData> => {
    const supabase = await createClient()

    const [facaRes, bomRes, vendasRes, movRes] = await Promise.all([
      supabase.from('facas').select('*').eq('id', facaId).single(),
      supabase
        .from('faca_materias_primas')
        .select('*, materia_prima:materias_primas(id, codigo, nome, preco_custo, estoque_atual, estoque_minimo, foto_url, fornecedor_id, created_at)')
        .eq('faca_id', facaId)
        .order('id'),
      supabase
        .from('pedido_itens')
        .select('*, pedido:pedidos(id, codigo, status, data_pedido)')
        .eq('faca_id', facaId)
        .order('id', { ascending: false })
        .limit(50),
      supabase
        .from('movimentacoes_estoque')
        .select('*, materia_prima:materias_primas(id, codigo, nome), usuario:usuarios_perfis(id, nome)')
        .eq('faca_id', facaId)
        .order('created_at', { ascending: false })
        .limit(50),
    ])

    if (facaRes.error) throw new Error(facaRes.error.message)
    if (!facaRes.data) throw new Error('Faca não encontrada.')

    return {
      faca: facaRes.data as Faca,
      bom: (bomRes.data ?? []) as FacaMateriaPrima[],
      vendas: (vendasRes.data ?? []) as PedidoItemComPedido[],
      movimentacoes: (movRes.data ?? []) as MovimentacaoEstoque[],
    }
  },
  ['faca-detalhe'],
  { revalidate: 30, tags: ['faca-detalhe'] }
)

export async function getFacaDetalhe(facaId: string): Promise<FacaDetalheData> {
  const userId = await requireAuthenticatedUserId()
  return withSupabaseCookieContext(() => getFacaDetalheCached(userId, facaId))
}

async function calcularPrecoCustoPorFaca(
  supabase: Awaited<ReturnType<typeof createClient>>,
  facas: Faca[]
): Promise<Map<string, number>> {
  const facaIds = facas.map((f) => f.id)
  if (facaIds.length === 0) return new Map()

  const { data: boms, error } = await supabase
    .from('faca_materias_primas')
    .select('faca_id, quantidade, materia_prima:materias_primas(preco_custo)')
    .in('faca_id', facaIds)

  if (error) throw new Error(error.message)

  const baseByFaca = new Map<string, number>()
  for (const bom of boms ?? []) {
    const mp = (Array.isArray(bom.materia_prima) ? bom.materia_prima[0] : bom.materia_prima) as { preco_custo: number } | null
    const custoMp = Number(mp?.preco_custo ?? 0)
    const qtd = Number(bom.quantidade ?? 0)
    const atual = baseByFaca.get(bom.faca_id) ?? 0
    baseByFaca.set(bom.faca_id, atual + (custoMp * qtd))
  }

  const custoByFaca = new Map<string, number>()
  for (const faca of facas) {
    const base = baseByFaca.get(faca.id) ?? 0
    custoByFaca.set(faca.id, Math.round(base * 100) / 100)
  }
  return custoByFaca
}

// ============================================================
// Entrada de Estoque (Produção)
// ============================================================

export async function entradaEstoqueFaca(
  facaId: string,
  quantidadeProduzida: number,
  registradoPorId?: string | null
): Promise<{ materiaisConsumidos: { codigo: string; nome: string; consumido: number }[]; movimentacoesCriadas: MovimentacaoEstoque[] }> {
  await assertPermissao('facas', 'editar')

  if (!Number.isFinite(quantidadeProduzida) || quantidadeProduzida <= 0) {
    throw new Error('Quantidade deve ser maior que zero.')
  }

  const supabase = await createClient()

  const { data: faca, error: facaErr } = await supabase
    .from('facas')
    .select('id, codigo, estoque_atual')
    .eq('id', facaId)
    .single()
  if (facaErr) throw new Error(facaErr.message)
  if (!faca) throw new Error('Faca não encontrada.')

  const { data: boms, error: bomsErr } = await supabase
    .from('faca_materias_primas')
    .select('materia_prima_id, quantidade')
    .eq('faca_id', facaId)
  if (bomsErr) throw new Error(bomsErr.message)
  if (!boms || boms.length === 0) throw new Error('Esta faca não tem matérias-primas cadastradas.')

  const mpIds = [...new Set(boms.map((b) => b.materia_prima_id))] as string[]
  const { data: mps, error: mpsErr } = await supabase
    .from('materias_primas')
    .select('id, codigo, nome, estoque_atual')
    .in('id', mpIds)
  if (mpsErr) throw new Error(mpsErr.message)

  const mpMap = new Map<string, { id: string; codigo: string; nome: string; estoque_atual: number }>()
  for (const mp of mps ?? []) {
    mpMap.set(mp.id, { ...mp, estoque_atual: Number(mp.estoque_atual) || 0 })
  }

  const insuficientes: MaterialInsuficiente[] = []
  for (const bom of boms) {
    const mp = mpMap.get(bom.materia_prima_id)
    if (!mp) continue
    const necessario = round3(quantidadeProduzida * (Number(bom.quantidade) || 0))
    if (mp.estoque_atual < necessario) {
      insuficientes.push({
        materia_prima_id: mp.id,
        nome: mp.nome,
        codigo: mp.codigo,
        necessario,
        disponivel: mp.estoque_atual,
        falta: round3(necessario - mp.estoque_atual),
      })
    }
  }

  if (insuficientes.length > 0) {
    const detalhes = insuficientes
      .map((m) => `${m.codigo} (${m.nome}): precisa ${m.necessario}, tem ${m.disponivel}, falta ${m.falta}`)
      .join('\n')
    throw new Error(`Matérias-primas insuficientes:\n${detalhes}`)
  }

  const authUserId = await requireAuthenticatedUserId()
  const userId = registradoPorId || authUserId
  const materiaisConsumidos: { codigo: string; nome: string; consumido: number }[] = []
  const movimentacoesCriadas: MovimentacaoEstoque[] = []

  for (const bom of boms) {
    const mp = mpMap.get(bom.materia_prima_id)
    if (!mp) continue

    const consumo = round3(quantidadeProduzida * (Number(bom.quantidade) || 0))
    if (!consumo) continue

    const novoEstoque = round3(mp.estoque_atual - consumo)

    const { error: updErr } = await supabase
      .from('materias_primas')
      .update({ estoque_atual: novoEstoque })
      .eq('id', bom.materia_prima_id)
    if (updErr) throw new Error(updErr.message)

    const { data: movCriada, error: movErr } = await supabase
      .from('movimentacoes_estoque')
      .insert({
        tipo: 'saida_producao',
        materia_prima_id: bom.materia_prima_id,
        faca_id: facaId,
        quantidade: consumo,
        observacao: `Produção de ${quantidadeProduzida}x ${faca.codigo}`,
        usuario_id: userId,
      })
      .select('*, materia_prima:materias_primas(id, codigo, nome), usuario:usuarios_perfis(id, nome)')
      .single()
    if (movErr) throw new Error(movErr.message)
    if (movCriada) movimentacoesCriadas.push(movCriada as unknown as MovimentacaoEstoque)

    materiaisConsumidos.push({ codigo: mp.codigo, nome: mp.nome, consumido: consumo })
  }

  const novoEstoqueFaca = (Number(faca.estoque_atual) || 0) + quantidadeProduzida
  const { error: updFacaErr } = await supabase
    .from('facas')
    .update({ estoque_atual: novoEstoqueFaca })
    .eq('id', facaId)
  if (updFacaErr) throw new Error(updFacaErr.message)

  revalidatePath('/facas')
  revalidatePath('/materias-primas')
  revalidateTag('facas-list', 'max')
  revalidateTag('materias-primas-list', 'max')
  revalidateTag('faca-detalhe', 'max')

  return { materiaisConsumidos, movimentacoesCriadas }
}

export async function atualizarMovimentacaoFacaProducao(input: {
  movimentacaoId: string
  quantidade: number
  usuarioId: string
  observacao?: string | null
}): Promise<void> {
  await assertPermissao('movimentacoes_estoque', 'editar')
  await assertPermissao('usuarios', 'editar')

  const { movimentacaoId, quantidade, usuarioId, observacao } = input
  if (!movimentacaoId) throw new Error('ID da movimentação é obrigatório.')
  if (!Number.isFinite(quantidade) || quantidade <= 0) throw new Error('Quantidade deve ser maior que zero.')
  if (!usuarioId) throw new Error('Selecione o usuário responsável.')

  const admin = createAdminClient()

  const { data: movAtual, error: movErr } = await admin
    .from('movimentacoes_estoque')
    .select('id, tipo, quantidade, materia_prima_id, faca_id')
    .eq('id', movimentacaoId)
    .single()
  if (movErr) throw new Error(movErr.message)
  if (!movAtual) throw new Error('Movimentação não encontrada.')
  if (movAtual.tipo !== 'saida_producao') throw new Error('Somente movimentações de produção podem ser editadas aqui.')
  if (!movAtual.materia_prima_id) throw new Error('Movimentação sem matéria-prima vinculada.')

  const { data: usuario, error: userErr } = await admin
    .from('usuarios_perfis')
    .select('id')
    .eq('id', usuarioId)
    .single()
  if (userErr) throw new Error(userErr.message)
  if (!usuario) throw new Error('Usuário não encontrado.')

  const { data: mp, error: mpErr } = await admin
    .from('materias_primas')
    .select('id, estoque_atual')
    .eq('id', movAtual.materia_prima_id)
    .single()
  if (mpErr) throw new Error(mpErr.message)
  if (!mp) throw new Error('Matéria-prima vinculada não encontrada.')

  const quantidadeAntiga = Number(movAtual.quantidade)
  const delta = quantidade - quantidadeAntiga
  const novoEstoque = round3(Number(mp.estoque_atual) - delta)
  if (novoEstoque < 0) throw new Error('Operação inválida: o estoque da matéria-prima ficaria negativo.')

  const { error: updMovErr } = await admin
    .from('movimentacoes_estoque')
    .update({
      quantidade,
      usuario_id: usuarioId,
      observacao: observacao?.trim() || null,
    })
    .eq('id', movimentacaoId)
  if (updMovErr) throw new Error(updMovErr.message)

  if (delta !== 0) {
    const { error: updMpErr } = await admin
      .from('materias_primas')
      .update({ estoque_atual: novoEstoque })
      .eq('id', mp.id)
    if (updMpErr) throw new Error(updMpErr.message)
  }

  revalidatePath('/facas')
  if (movAtual.faca_id) revalidatePath(`/facas/${movAtual.faca_id}`)
  revalidatePath('/materias-primas')
  revalidateTag('faca-detalhe', 'max')
  revalidateTag('materias-primas-list', 'max')
}
