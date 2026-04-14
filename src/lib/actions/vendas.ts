'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { unstable_cache } from 'next/cache'
import { createClient, withSupabaseCookieContext } from '@/lib/supabase/server'
import { assertPermissao, getAuthenticatedUser, requireAuthenticatedUserId } from '@/lib/auth'
import { executarGerarTodasOCsDesdeFilaAutomatico } from '@/lib/ordens-compra/gerar-oc-fila'
import type { Pedido, StatusPedido } from '@/types'
import { gerarCodigoForte } from '@/lib/utils/codigo'

function normalizeStatusPedido(status: string): StatusPedido {
  if (status === 'em_espera' || status === 'em_producao' || status === 'entregue') return status
  if (status === 'orcamento' || status === 'confirmado') return 'em_espera'
  if (status === 'cancelado') return 'entregue'
  return 'em_espera'
}

function normalizePedido(pedido: Pedido): Pedido {
  return { ...pedido, status: normalizeStatusPedido(String(pedido.status)) }
}

const getVendasCached = unstable_cache(
  async (_userId: string, limit: number): Promise<Pedido[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('pedidos')
      .select(`
        *,
        cliente:clientes(id, nome, tipo, tipo_documento, documento, cidade, estado),
        vendedor:usuarios_perfis(id, nome),
        itens:pedido_itens(*)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw new Error(error.message)
    return (data as Pedido[]).map(normalizePedido)
  },
  ['vendas-list'],
  { revalidate: 30, tags: ['vendas-list'] }
)

export async function getVendas(limit = 80): Promise<Pedido[]> {
  const userId = await requireAuthenticatedUserId()
  return withSupabaseCookieContext(() => getVendasCached(userId, limit))
}

export async function getVendaDetalhe(id: string): Promise<Pedido> {
  await requireAuthenticatedUserId()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      *,
      cliente:clientes(id, nome, tipo, tipo_documento, documento, cidade, estado),
      vendedor:usuarios_perfis(id, nome),
      itens:pedido_itens(*, faca:facas(id, codigo, nome, preco_venda, foto_url))
    `)
    .eq('id', id)
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Venda não encontrada.')
  return normalizePedido(data as Pedido)
}

export async function gerarCodigoPedido(): Promise<string> {
  return gerarCodigoForte('PD')
}

export type VendaItemInput = {
  faca_id: string
  quantidade: number
  preco_unitario: number
}

export type VendaInput = {
  cliente_id: string | null
  vendedor_id: string | null
  data_pedido: string
  observacao: string
  status: StatusPedido
  itens: VendaItemInput[]
}

async function inserirItensPedido(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pedidoId: string,
  itens: VendaItemInput[]
) {
  for (const item of itens) {
    const { error } = await supabase.from('pedido_itens').insert({
      pedido_id: pedidoId,
      faca_id: item.faca_id,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
    })

    if (error) {
      throw new Error(error.message)
    }
  }
}

export async function criarVenda(input: VendaInput) {
  await assertPermissao('vendas', 'criar')
  const supabase = await createClient()

  if (input.itens.length === 0) throw new Error('Adicione ao menos um item à venda.')
  if (input.status === 'entregue') {
    throw new Error('Crie a venda como "Em Espera" ou "Em Produção". Para concluir, use "Marcar como entregue".')
  }

  // Validar estoque disponível para cada faca
  const facaIds = [...new Set(input.itens.map((i) => i.faca_id))]
  const { data: facas } = await supabase
    .from('facas')
    .select('id, nome, estoque_atual')
    .in('id', facaIds)

  if (facas) {
    const facaMap = new Map(facas.map((f) => [f.id, f]))
    const insuficientes = input.itens.filter((item) => {
      const faca = facaMap.get(item.faca_id)
      return faca && faca.estoque_atual < item.quantidade
    })
    if (insuficientes.length > 0) {
      const detalhes = insuficientes
        .map((item) => {
          const f = facaMap.get(item.faca_id)
          return `${f?.nome ?? 'Desconhecida'} (solicitado: ${item.quantidade}, disponível: ${f?.estoque_atual ?? 0})`
        })
        .join('; ')
      throw new Error(`Estoque insuficiente: ${detalhes}`)
    }
  }

  const codigo = await gerarCodigoPedido()
  const valor_total = input.itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)

  const { data: pedido, error } = await supabase
    .from('pedidos')
    .insert({
      codigo,
      cliente_id: input.cliente_id || null,
      vendedor_id: input.vendedor_id || null,
      data_pedido: input.data_pedido,
      observacao: input.observacao.trim() || null,
      status: input.status,
      valor_total,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  if (!pedido?.id) throw new Error('Não foi possível criar a venda (ID não retornado).')

  try {
    await inserirItensPedido(supabase, pedido.id, input.itens)
  } catch (e) {
    // Evita pedido órfão quando falha ao gravar itens.
    await supabase.from('pedido_itens').delete().eq('pedido_id', pedido.id)
    await supabase.from('pedidos').delete().eq('id', pedido.id)
    throw e
  }

  revalidatePath('/vendas')
  revalidateTag('vendas-list', 'max')
  revalidateTag('metricas-vendas', 'max')
}

export async function atualizarVenda(id: string, input: VendaInput) {
  await assertPermissao('vendas', 'editar')
  const supabase = await createClient()

  if (input.itens.length === 0) throw new Error('Adicione ao menos um item à venda.')
  if (input.status === 'entregue') {
    throw new Error('Para entregar a venda, use a ação "Marcar como entregue" na tela de detalhes.')
  }

  const { data: pedido } = await supabase
    .from('pedidos')
    .select('status')
    .eq('id', id)
    .single()
  if (!pedido || normalizeStatusPedido(String(pedido.status)) === 'entregue') {
    throw new Error('Vendas entregues não podem ser editadas.')
  }

  // Valida estoque apenas para o delta de aumento de quantidade.
  // Itens já existentes no pedido não consomem estoque até a entrega,
  // então só bloqueamos se a nova quantidade EXCEDER a anterior.
  const { data: itensAtuais } = await supabase
    .from('pedido_itens')
    .select('faca_id, quantidade')
    .eq('pedido_id', id)

  const qtdAtualMap = new Map<string, number>()
  for (const i of itensAtuais ?? []) {
    qtdAtualMap.set(i.faca_id, (qtdAtualMap.get(i.faca_id) ?? 0) + Number(i.quantidade))
  }

  // Por faca, quanto a mais está sendo pedido vs o que já estava no pedido
  const deltaMap = new Map<string, number>()
  for (const item of input.itens) {
    const anterior = qtdAtualMap.get(item.faca_id) ?? 0
    const delta = item.quantidade - anterior
    if (delta > 0) deltaMap.set(item.faca_id, (deltaMap.get(item.faca_id) ?? 0) + delta)
  }

  if (deltaMap.size > 0) {
    const facaIds = [...deltaMap.keys()]
    const { data: facas } = await supabase
      .from('facas')
      .select('id, nome, estoque_atual')
      .in('id', facaIds)

    if (facas) {
      const facaMap = new Map(facas.map((f) => [f.id, f]))
      const insuficientes = facaIds.filter((fid) => {
        const faca = facaMap.get(fid)
        return faca && faca.estoque_atual < (deltaMap.get(fid) ?? 0)
      })
      if (insuficientes.length > 0) {
        const detalhes = insuficientes
          .map((fid) => {
            const f = facaMap.get(fid)
            return `${f?.nome ?? 'Desconhecida'} (adicionar: ${deltaMap.get(fid)}, disponível: ${f?.estoque_atual ?? 0})`
          })
          .join('; ')
        throw new Error(`Estoque insuficiente: ${detalhes}`)
      }
    }
  }

  const valor_total = input.itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)

  const { error } = await supabase
    .from('pedidos')
    .update({
      cliente_id: input.cliente_id || null,
      vendedor_id: input.vendedor_id || null,
      data_pedido: input.data_pedido,
      observacao: input.observacao.trim() || null,
      status: input.status,
      valor_total,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)

  await supabase.from('pedido_itens').delete().eq('pedido_id', id)

  try {
    await inserirItensPedido(supabase, id, input.itens)
  } catch (e) {
    // Não deixa itens parcialmente gravados.
    await supabase.from('pedido_itens').delete().eq('pedido_id', id)
    throw e
  }

  revalidatePath('/vendas')
  revalidateTag('vendas-list', 'max')
  revalidateTag('metricas-vendas', 'max')
}

export async function avancarStatus(id: string, novoStatus: 'em_producao') {
  await assertPermissao('vendas', 'editar')
  const supabase = await createClient()

  const { error } = await supabase
    .from('pedidos')
    .update({ status: novoStatus })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/vendas')
  revalidateTag('vendas-list', 'max')
  revalidateTag('metricas-vendas', 'max')
}

export async function marcarEntregue(id: string) {
  await assertPermissao('vendas', 'editar')
  const supabase = await createClient()

  const { data: pedido, error: pedidoErr } = await supabase
    .from('pedidos')
    .select('*, itens:pedido_itens(*)')
    .eq('id', id)
    .single()

  if (pedidoErr || !pedido) throw new Error('Venda não encontrada.')
  if (normalizeStatusPedido(String(pedido.status)) !== 'em_producao') {
    throw new Error('A venda precisa estar "Em Produção" para ser entregue.')
  }

  const itens = pedido.itens as { faca_id: string; quantidade: number }[]

  const facaIds = [...new Set(itens.map((i) => i.faca_id))]
  const { data: facas } = await supabase
    .from('facas')
    .select('id, nome, estoque_atual')
    .in('id', facaIds)

  const facaMap = new Map((facas ?? []).map((f) => [f.id, f]))

  const insuficientes = itens.filter((item) => {
    const faca = facaMap.get(item.faca_id)
    return !faca || faca.estoque_atual < item.quantidade
  })

  if (insuficientes.length > 0) {
    const detalhes = insuficientes
      .map((item) => {
        const f = facaMap.get(item.faca_id)
        return `${f?.nome ?? 'Desconhecida'} (precisa ${item.quantidade}, tem ${f?.estoque_atual ?? 0})`
      })
      .join('; ')
    throw new Error(`Estoque insuficiente: ${detalhes}`)
  }

  const user = await getAuthenticatedUser()

  const { error: upErr } = await supabase
    .from('pedidos')
    .update({ status: 'entregue', entregue_at: new Date().toISOString() })
    .eq('id', id)
  if (upErr) throw new Error(upErr.message)

  for (const item of itens) {
    const faca = facaMap.get(item.faca_id)!

    const { error: movErr } = await supabase.from('movimentacoes_estoque').insert({
      tipo: 'saida_venda',
      faca_id: item.faca_id,
      pedido_id: id,
      quantidade: item.quantidade,
      usuario_id: user?.id ?? null,
    })
    if (movErr) throw new Error(`Erro ao registrar movimentação para ${faca.nome}: ${movErr.message}`)

    const { error: estoqueErr } = await supabase
      .from('facas')
      .update({ estoque_atual: faca.estoque_atual - item.quantidade })
      .eq('id', item.faca_id)
    if (estoqueErr) throw new Error(`Erro ao atualizar estoque de ${faca.nome}: ${estoqueErr.message}`)
  }

  const { data: boms } = await supabase
    .from('faca_materias_primas')
    .select('faca_id, materia_prima_id, quantidade, mp:materias_primas(id, fornecedor_id)')
    .in('faca_id', facaIds)

  for (const item of itens) {
    const facaBom = (boms ?? []).filter((b) => b.faca_id === item.faca_id)
    for (const bom of facaBom) {
      const mp = (Array.isArray(bom.mp) ? bom.mp[0] : bom.mp) as { id: string; fornecedor_id: string | null }
      const { error: filaErr } = await supabase.from('fila_reposicao').insert({
        materia_prima_id: bom.materia_prima_id,
        fornecedor_id: mp.fornecedor_id,
        quantidade_pendente: bom.quantidade * item.quantidade,
        pedido_id: id,
      })
      if (filaErr) throw new Error(filaErr.message)
    }
  }

  try {
    await executarGerarTodasOCsDesdeFilaAutomatico()
  } catch {
    // Fila já foi preenchida; OC pode ser gerada manualmente (ex.: já existe OC pendente para um fornecedor).
  }

  revalidatePath('/vendas')
  revalidatePath('/facas')
  revalidatePath('/ordens-compra')
  revalidateTag('vendas-list', 'max')
  revalidateTag('metricas-vendas', 'max')
  revalidateTag('facas-list', 'max')
  revalidateTag('metricas-estoque', 'max')
  revalidateTag('ordens-compra-historico', 'max')
  revalidateTag('ordens-compra-fila', 'max')
}

export async function deletarVenda(id: string) {
  await assertPermissao('vendas', 'deletar')
  const supabase = await createClient()

  const { data: pedido } = await supabase
    .from('pedidos')
    .select('status')
    .eq('id', id)
    .single()

  if (!pedido || normalizeStatusPedido(String(pedido.status)) !== 'em_espera') {
    throw new Error('Apenas vendas em espera podem ser excluídas.')
  }

  const { error } = await supabase.from('pedidos').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/vendas')
  revalidateTag('vendas-list', 'max')
  revalidateTag('metricas-vendas', 'max')
}
