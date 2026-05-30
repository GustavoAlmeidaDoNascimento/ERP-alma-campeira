'use server'

import { createClient } from '@/lib/supabase/server'
import { assertPermissao, requireAuthenticatedUserId } from '@/lib/auth'
import { gerarCodigoForte } from '@/lib/utils/codigo'
import type { Orcamento, StatusPedido } from '@/types'

export async function getOrcamentos(limit = 80): Promise<Orcamento[]> {
  await assertPermissao('orcamentos', 'ver')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orcamentos')
    .select(`
      *,
      cliente:clientes(id, nome, tipo, tipo_documento, documento, cidade, estado),
      vendedor:usuarios_perfis(id, nome),
      itens:orcamento_itens(*)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data as Orcamento[]
}

export async function getOrcamentoDetalhe(id: string): Promise<Orcamento> {
  await assertPermissao('orcamentos', 'ver')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('orcamentos')
    .select(`
      *,
      cliente:clientes(id, nome, tipo, tipo_documento, documento, cidade, estado),
      vendedor:usuarios_perfis(id, nome),
      itens:orcamento_itens(*, faca:facas(id, codigo, nome, preco_venda, foto_url)),
      pedido_convertido:pedidos!orcamentos_convertido_pedido_id_fkey(id, codigo, status, data_pedido)
    `)
    .eq('id', id)
    .single()

  if (error || !data) throw new Error(error?.message ?? 'Orçamento não encontrado.')
  return data as Orcamento
}

export type OrcamentoItemInput = {
  faca_id: string
  quantidade: number
  preco_unitario: number
}

export type OrcamentoInput = {
  cliente_id: string | null
  vendedor_id: string | null
  data_orcamento: string
  observacao: string
  frete: number
  desconto_total: number
  itens: OrcamentoItemInput[]
}

function calcularTotal(input: OrcamentoInput) {
  const subtotalItens = input.itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)
  const frete = Math.max(0, input.frete || 0)
  const bruto = subtotalItens + frete
  const desconto_total = Math.min(Math.max(0, input.desconto_total || 0), bruto)
  const valor_total = bruto - desconto_total
  return { frete, desconto_total, valor_total }
}

async function inserirItensOrcamento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orcamentoId: string,
  itens: OrcamentoItemInput[]
) {
  for (const item of itens) {
    const { error } = await supabase.from('orcamento_itens').insert({
      orcamento_id: orcamentoId,
      faca_id: item.faca_id,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
    })
    if (error) throw new Error(error.message)
  }
}

export async function criarOrcamento(input: OrcamentoInput): Promise<{ id: string }> {
  await assertPermissao('orcamentos', 'criar')
  const supabase = await createClient()

  if (input.itens.length === 0) throw new Error('Adicione ao menos um item ao orçamento.')

  const codigo = gerarCodigoForte('OR')
  const { frete, desconto_total, valor_total } = calcularTotal(input)

  const { data: orcamento, error } = await supabase
    .from('orcamentos')
    .insert({
      codigo,
      cliente_id: input.cliente_id || null,
      vendedor_id: input.vendedor_id || null,
      data_orcamento: input.data_orcamento,
      observacao: input.observacao.trim() || null,
      frete,
      desconto_total,
      valor_total,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  if (!orcamento?.id) throw new Error('Não foi possível criar o orçamento (ID não retornado).')

  try {
    await inserirItensOrcamento(supabase, orcamento.id, input.itens)
  } catch (e) {
    // Evita orçamento órfão
    await supabase.from('orcamento_itens').delete().eq('orcamento_id', orcamento.id)
    await supabase.from('orcamentos').delete().eq('id', orcamento.id)
    throw e
  }


  return { id: orcamento.id }
}

export async function atualizarOrcamento(id: string, input: OrcamentoInput) {
  await assertPermissao('orcamentos', 'editar')
  const supabase = await createClient()

  if (input.itens.length === 0) throw new Error('Adicione ao menos um item ao orçamento.')

  // Bloqueia edição de orçamento já convertido em venda — manteria desalinhado com o pedido gerado.
  const { data: atual } = await supabase
    .from('orcamentos')
    .select('convertido_pedido_id')
    .eq('id', id)
    .single()
  if (atual?.convertido_pedido_id) {
    throw new Error('Este orçamento já foi convertido em venda e não pode ser editado.')
  }

  const { frete, desconto_total, valor_total } = calcularTotal(input)

  const { error } = await supabase
    .from('orcamentos')
    .update({
      cliente_id: input.cliente_id || null,
      vendedor_id: input.vendedor_id || null,
      data_orcamento: input.data_orcamento,
      observacao: input.observacao.trim() || null,
      frete,
      desconto_total,
      valor_total,
    })
    .eq('id', id)
  if (error) throw new Error(error.message)

  await sincronizarItensOrcamento(supabase, id, input.itens)

}

/**
 * Sincroniza orcamento_itens fazendo diff por posição (ordenado por created_at).
 * Em vez de apagar tudo e reinserir — que gerava 1 INSERT + 1 DELETE por item no
 * log de auditoria —, só atualiza linhas que de fato mudaram, insere extras
 * novos e deleta os que sobraram. Tipicamente: editar a quantidade de 1 item
 * gera 1 UPDATE no log, e mais nada.
 */
async function sincronizarItensOrcamento(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orcamentoId: string,
  novos: OrcamentoItemInput[],
) {
  const { data: atuais, error: errFetch } = await supabase
    .from('orcamento_itens')
    .select('id, faca_id, quantidade, preco_unitario')
    .eq('orcamento_id', orcamentoId)
    .order('created_at', { ascending: true })
  if (errFetch) throw new Error(errFetch.message)

  const atuaisArr = atuais ?? []
  const max = Math.max(atuaisArr.length, novos.length)

  for (let i = 0; i < max; i++) {
    const atual = atuaisArr[i]
    const novo = novos[i]

    if (atual && novo) {
      const mudou =
        atual.faca_id !== novo.faca_id ||
        Number(atual.quantidade) !== Number(novo.quantidade) ||
        Number(atual.preco_unitario) !== Number(novo.preco_unitario)
      if (mudou) {
        const { error } = await supabase
          .from('orcamento_itens')
          .update({
            faca_id: novo.faca_id,
            quantidade: novo.quantidade,
            preco_unitario: novo.preco_unitario,
          })
          .eq('id', atual.id)
        if (error) throw new Error(error.message)
      }
    } else if (novo) {
      const { error } = await supabase.from('orcamento_itens').insert({
        orcamento_id: orcamentoId,
        faca_id: novo.faca_id,
        quantidade: novo.quantidade,
        preco_unitario: novo.preco_unitario,
      })
      if (error) throw new Error(error.message)
    } else if (atual) {
      const { error } = await supabase
        .from('orcamento_itens')
        .delete()
        .eq('id', atual.id)
      if (error) throw new Error(error.message)
    }
  }
}

export async function deletarOrcamento(id: string) {
  await assertPermissao('orcamentos', 'deletar')
  const supabase = await createClient()

  // Em orçamentos qualquer pode ser excluído (ao contrário de pedidos, não há lock por status).
  const { error } = await supabase.from('orcamentos').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Cria um pedido novo a partir do orçamento e marca o orçamento como convertido.
 *
 * - Não consome estoque automaticamente: a entrega do novo pedido segue o fluxo
 *   normal (avançar para "em produção" e depois "marcar como entregue").
 * - Por isso `statusInicial` é restrito a `em_espera | em_producao`. Se o usuário
 *   quiser entregar imediatamente, ele faz isso pela tela de Vendas.
 */
export async function transformarOrcamentoEmVenda(
  id: string,
  statusInicial: Extract<StatusPedido, 'em_espera' | 'em_producao'>
): Promise<{ pedido_id: string; pedido_codigo: string }> {
  // Precisa de criar venda E editar orçamento (para marcar conversão).
  await assertPermissao('vendas', 'criar')
  await assertPermissao('orcamentos', 'editar')
  const supabase = await createClient()

  const { data: orc, error: orcErr } = await supabase
    .from('orcamentos')
    .select(`
      id, cliente_id, vendedor_id, data_orcamento, observacao, frete, desconto_total, valor_total, convertido_pedido_id,
      itens:orcamento_itens(faca_id, quantidade, preco_unitario)
    `)
    .eq('id', id)
    .single()

  if (orcErr || !orc) throw new Error(orcErr?.message ?? 'Orçamento não encontrado.')
  if (orc.convertido_pedido_id) {
    throw new Error('Este orçamento já foi convertido em venda.')
  }

  const itens = (orc.itens ?? []) as { faca_id: string; quantidade: number; preco_unitario: number }[]
  if (itens.length === 0) throw new Error('Orçamento sem itens não pode virar venda.')
  if (!orc.cliente_id?.trim()) {
    throw new Error('O orçamento precisa ter um cliente cadastrado para virar venda.')
  }
  if (!orc.vendedor_id?.trim()) {
    throw new Error('O orçamento precisa ter um vendedor cadastrado para virar venda.')
  }

  // Validação de estoque para o status pretendido — só faz sentido em em_producao,
  // mas em_espera também não consome; mantemos a validação leve apenas se houver
  // facas inexistentes para evitar FK errado mais à frente.
  const facaIds = [...new Set(itens.map((i) => i.faca_id))]
  const { data: facasExistentes } = await supabase
    .from('facas')
    .select('id')
    .in('id', facaIds)
  const existentes = new Set((facasExistentes ?? []).map((f) => f.id))
  const ausentes = facaIds.filter((fid) => !existentes.has(fid))
  if (ausentes.length > 0) {
    throw new Error('O orçamento contém facas que não existem mais. Edite o orçamento antes de convertê-lo.')
  }

  const codigoPedido = gerarCodigoForte('PD')

  const { data: pedido, error: pedidoErr } = await supabase
    .from('pedidos')
    .insert({
      codigo: codigoPedido,
      cliente_id: orc.cliente_id,
      vendedor_id: orc.vendedor_id,
      data_pedido: orc.data_orcamento,
      observacao: orc.observacao,
      status: statusInicial,
      frete: orc.frete ?? 0,
      desconto_total: orc.desconto_total ?? 0,
      valor_total: orc.valor_total ?? 0,
    })
    .select('id, codigo')
    .single()

  if (pedidoErr || !pedido) throw new Error(pedidoErr?.message ?? 'Erro ao criar venda a partir do orçamento.')

  // Copia itens
  for (const item of itens) {
    const { error: itemErr } = await supabase.from('pedido_itens').insert({
      pedido_id: pedido.id,
      faca_id: item.faca_id,
      quantidade: item.quantidade,
      preco_unitario: item.preco_unitario,
    })
    if (itemErr) {
      // rollback básico
      await supabase.from('pedido_itens').delete().eq('pedido_id', pedido.id)
      await supabase.from('pedidos').delete().eq('id', pedido.id)
      throw new Error(itemErr.message)
    }
  }

  // Marca orçamento como convertido (a auditoria registra o UPDATE com os campos)
  const { error: updErr } = await supabase
    .from('orcamentos')
    .update({
      convertido_pedido_id: pedido.id,
      convertido_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (updErr) {
    // Rollback do pedido criado
    await supabase.from('pedido_itens').delete().eq('pedido_id', pedido.id)
    await supabase.from('pedidos').delete().eq('id', pedido.id)
    throw new Error(`Falha ao marcar orçamento como convertido: ${updErr.message}`)
  }


  return { pedido_id: pedido.id, pedido_codigo: pedido.codigo }
}
