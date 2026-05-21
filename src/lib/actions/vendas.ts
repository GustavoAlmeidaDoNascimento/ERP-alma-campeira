'use server'

import { createClient } from '@/lib/supabase/server'
import { assertPermissao, getAuthenticatedUser, requireAuthenticatedUserId } from '@/lib/auth'
import { analisarReposicaoParaPedido } from '@/lib/ordens-compra/analisar-reposicao'
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

export async function getVendas(limit = 80): Promise<Pedido[]> {
  await assertPermissao('vendas', 'ver')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      *,
      cliente:clientes(
        id,
        nome,
        tipo,
        tipo_documento,
        documento,
        cidade,
        estado,
        telefone,
        email,
        cep,
        logradouro,
        numero,
        complemento,
        bairro,
        razao_social,
        ie
      ),
      vendedor:usuarios_perfis(id, nome),
      itens:pedido_itens(*)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return (data as Pedido[]).map(normalizePedido)
}

export async function getVendaDetalhe(id: string): Promise<Pedido> {
  await assertPermissao('vendas', 'ver')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('pedidos')
    .select(`
      *,
      cliente:clientes(
        id,
        nome,
        tipo,
        tipo_documento,
        documento,
        cidade,
        estado,
        telefone,
        email,
        cep,
        logradouro,
        numero,
        complemento,
        bairro,
        razao_social,
        ie
      ),
      vendedor:usuarios_perfis(id, nome),
      itens:pedido_itens(*, faca:facas(id, codigo, nome, preco_venda, foto_url, unidade, ean_gtin))
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
  frete: number
  desconto_total: number
  natureza_operacao?: string
  itens: VendaItemInput[]
}

async function inserirItensPedido(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pedidoId: string,
  itens: VendaItemInput[]
) {
  // Snapshot fiscal: copiamos NCM/CFOP atuais da faca para cada item, para
  // que alterações futuras no cadastro não afetem notas já emitidas.
  const facaIds = [...new Set(itens.map((i) => i.faca_id))]
  const fiscalByFaca = new Map<string, { ncm: string | null; cfop: string | null }>()
  if (facaIds.length > 0) {
    const { data: fiscaisFacas } = await supabase
      .from('facas')
      .select('id, ncm, cfop_padrao')
      .in('id', facaIds)
    for (const f of fiscaisFacas ?? []) {
      fiscalByFaca.set(f.id, {
        ncm: (f as { ncm: string | null }).ncm ?? null,
        cfop: (f as { cfop_padrao: string | null }).cfop_padrao ?? null,
      })
    }
  }

  for (const item of itens) {
    const fiscal = fiscalByFaca.get(item.faca_id) ?? { ncm: null, cfop: null }
    const { error } = await supabase.from('pedido_itens').insert({
      pedido_id: pedidoId,
      faca_id: item.faca_id,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
      ncm: fiscal.ncm,
      cfop: fiscal.cfop,
    })

    if (error) {
      throw new Error(error.message)
    }
  }
}

function assertClienteEVendedorObrigatorios(input: VendaInput) {
  if (!input.cliente_id?.trim()) {
    throw new Error('Selecione um cliente.')
  }
  if (!input.vendedor_id?.trim()) {
    throw new Error('Selecione um vendedor.')
  }
}

export async function criarVenda(input: VendaInput) {
  await assertPermissao('vendas', 'criar')
  const supabase = await createClient()

  assertClienteEVendedorObrigatorios(input)

  if (input.itens.length === 0) throw new Error('Adicione ao menos um item à venda.')

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
  const subtotalItens = input.itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)
  const frete = Math.max(0, input.frete || 0)
  const bruto = subtotalItens + frete
  const desconto_total = Math.min(Math.max(0, input.desconto_total || 0), bruto)
  const valor_total = bruto - desconto_total

  // Se já entregue de início, inserimos como em_producao e executarEntregaPedido
  // vai finalizar com status=entregue e entregue_at.
  const statusInsert = input.status === 'entregue' ? 'em_producao' : input.status

  const natureza = (input.natureza_operacao ?? '').trim() || 'VENDA DE MERCADORIA'

  const { data: pedido, error } = await supabase
    .from('pedidos')
    .insert({
      codigo,
      cliente_id: input.cliente_id!.trim(),
      vendedor_id: input.vendedor_id!.trim(),
      data_pedido: input.data_pedido,
      observacao: input.observacao.trim() || null,
      status: statusInsert,
      frete,
      desconto_total,
      valor_total,
      natureza_operacao: natureza,
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

  if (input.status === 'entregue') {
    const itensEntrega = input.itens.map((i) => ({ faca_id: i.faca_id, quantidade: i.quantidade }))
    await executarEntregaPedido(supabase, pedido.id, itensEntrega)
  }

}

export async function atualizarVenda(id: string, input: VendaInput) {
  await assertPermissao('vendas', 'editar')
  const supabase = await createClient()

  assertClienteEVendedorObrigatorios(input)

  if (input.itens.length === 0) throw new Error('Adicione ao menos um item à venda.')

  const { data: pedidoAtual } = await supabase
    .from('pedidos')
    .select('status')
    .eq('id', id)
    .single()
  if (!pedidoAtual || normalizeStatusPedido(String(pedidoAtual.status)) === 'entregue') {
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

  const subtotalItens = input.itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)
  const frete = Math.max(0, input.frete || 0)
  const bruto = subtotalItens + frete
  const desconto_total = Math.min(Math.max(0, input.desconto_total || 0), bruto)
  const valor_total = bruto - desconto_total

  // Se o usuário quer marcar como entregue, o update inicial usa em_producao;
  // executarEntregaPedido fará o update final com status=entregue e entregue_at.
  const statusUpdate = input.status === 'entregue' ? 'em_producao' : input.status

  const naturezaUpd = (input.natureza_operacao ?? '').trim() || 'VENDA DE MERCADORIA'

  const { error } = await supabase
    .from('pedidos')
    .update({
      cliente_id: input.cliente_id!.trim(),
      vendedor_id: input.vendedor_id!.trim(),
      data_pedido: input.data_pedido,
      observacao: input.observacao.trim() || null,
      status: statusUpdate,
      frete,
      desconto_total,
      valor_total,
      natureza_operacao: naturezaUpd,
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

  if (input.status === 'entregue') {
    const itensEntrega = input.itens.map((i) => ({ faca_id: i.faca_id, quantidade: i.quantidade }))
    await executarEntregaPedido(supabase, id, itensEntrega)
  }

}

export async function avancarStatus(id: string, novoStatus: 'em_producao') {
  await assertPermissao('vendas', 'editar')
  const supabase = await createClient()

  const { error } = await supabase
    .from('pedidos')
    .update({ status: novoStatus })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

async function reverterEntregaPedido(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  novoStatus: 'em_espera' | 'em_producao',
) {
  const { data: itens, error: itensErr } = await supabase
    .from('pedido_itens')
    .select('faca_id, quantidade')
    .eq('pedido_id', id)
  if (itensErr) throw new Error(itensErr.message)

  const facaIds = [...new Set((itens ?? []).map((i) => i.faca_id))]
  const { data: facas } = await supabase
    .from('facas')
    .select('id, nome, estoque_atual')
    .in('id', facaIds)
  const facaMap = new Map((facas ?? []).map((f) => [f.id, f]))

  const user = await getAuthenticatedUser()

  for (const item of itens ?? []) {
    const faca = facaMap.get(item.faca_id)
    if (!faca) continue
    const novoEstoque = Number(faca.estoque_atual) + Number(item.quantidade)

    const { error: estoqueErr } = await supabase
      .from('facas')
      .update({ estoque_atual: novoEstoque })
      .eq('id', item.faca_id)
    if (estoqueErr) throw new Error(`Erro ao reverter estoque de ${faca.nome}: ${estoqueErr.message}`)
    faca.estoque_atual = novoEstoque

    const { error: movErr } = await supabase.from('movimentacoes_estoque').insert({
      tipo: 'ajuste',
      faca_id: item.faca_id,
      quantidade: item.quantidade,
      observacao: `Reversão de venda entregue (pedido ${id})`,
      usuario_id: user?.id ?? null,
    })
    if (movErr) throw new Error(`Erro ao registrar reversão para ${faca.nome}: ${movErr.message}`)
  }

  const { error: upErr } = await supabase
    .from('pedidos')
    .update({ status: novoStatus, entregue_at: null })
    .eq('id', id)
  if (upErr) throw new Error(upErr.message)
}

export async function alterarStatus(id: string, novoStatus: StatusPedido) {
  await assertPermissao('vendas', 'editar')
  const supabase = await createClient()

  const { data: pedido, error: pedidoErr } = await supabase
    .from('pedidos')
    .select('status, itens:pedido_itens(faca_id, quantidade)')
    .eq('id', id)
    .single()
  if (pedidoErr || !pedido) throw new Error('Venda não encontrada.')

  const statusAtual = normalizeStatusPedido(String(pedido.status))
  if (statusAtual === novoStatus) return

  if (statusAtual === 'entregue') {
    if (novoStatus === 'em_espera' || novoStatus === 'em_producao') {
      await reverterEntregaPedido(supabase, id, novoStatus)
      return
    }
  }

  if (novoStatus === 'entregue') {
    const itens = (pedido.itens ?? []) as { faca_id: string; quantidade: number }[]
    await executarEntregaPedido(supabase, id, itens)
    return
  }

  const { error } = await supabase
    .from('pedidos')
    .update({ status: novoStatus })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

async function executarEntregaPedido(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  itens: { faca_id: string; quantidade: number }[]
) {
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

  // Não engolir o erro: falhas na análise de reposição estavam silenciando
  // problemas reais de RLS/schema e a fila simplesmente nunca aparecia.
  const resultado = await analisarReposicaoParaPedido(supabase, id)
  console.log(`[fila_reposicao] pedido=${id} criouFila=${resultado.criouFila} itens=${resultado.quantidadeItens}`)
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
  await executarEntregaPedido(supabase, id, itens)

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
    throw new Error('Apenas vendas aguardando pagamento podem ser excluídas.')
  }

  const { error } = await supabase.from('pedidos').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
