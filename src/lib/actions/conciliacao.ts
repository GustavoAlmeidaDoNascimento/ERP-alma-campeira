'use server'

import { createClient } from '@/lib/supabase/server'
import { assertPermissao, getAuthenticatedUser, requireAuthenticatedUserId } from '@/lib/auth'
import { revalidatePath, revalidateTag } from 'next/cache'

// ── Tipos ──────────────────────────────────────────────────────────────────────

export type NivelAlerta = 'ok' | 'divergencia'

/**
 * Integridade de estoque por faca.
 * Verifica se: estoque_atual = estoque_implicito_inicial + total_produzido - total_vendido
 * Se o estoque implícito inicial resultar negativo, há extravios não registrados.
 */
export type ConciliacaoFaca = {
  facaId: string
  facaCodigo: string
  facaNome: string
  estoqueAtual: number
  totalProduzido: number   // soma de movimentações tipo='entrada'
  totalVendido: number     // soma de movimentações tipo='saida_venda'
  saldoMovimentos: number  // totalProduzido - totalVendido
  estoqueInicialImplicito: number  // estoqueAtual - saldoMovimentos (deve ser >= 0)
  divergencia: number      // se < 0: há mais saídas registradas do que entradas, impossível
  nivel: NivelAlerta
  detalhe: string
}

/**
 * Consumo de MP vs produção registrada por faca.
 * Verifica se: para cada faca produzida, as MP consumidas batem com o BOM.
 */
export type ConciliacaoProducao = {
  facaId: string
  facaCodigo: string
  facaNome: string
  mpId: string
  mpCodigo: string
  mpNome: string
  totalProduzidoFaca: number   // entradas registradas da faca
  consumoEsperado: number      // totalProduzidoFaca × bom.quantidade
  consumoRegistrado: number    // saida_producao movements para faca+mp
  divergencia: number          // consumoRegistrado - consumoEsperado
  nivel: NivelAlerta
  detalhe: string
}

/**
 * Conciliação de vendas: pedidos entregues vs movimentações de saída.
 * Verifica se para todo pedido entregue há a movimentação correspondente.
 */
export type ConciliacaoVenda = {
  pedidoId: string
  pedidoCodigo: string
  facaId: string
  facaCodigo: string
  facaNome: string
  quantidadePedido: number
  quantidadeMovimento: number
  divergencia: number
  nivel: NivelAlerta
  detalhe: string
}

export type ResultadoConciliacao = {
  geradoEm: string
  tudoOk: boolean
  totalDivergencias: number
  facas: ConciliacaoFaca[]
  producao: ConciliacaoProducao[]
  vendas: ConciliacaoVenda[]
  resumo: {
    facasDivergentes: number
    producaoDivergente: number
    vendasDivergentes: number
  }
}

// ── Action ────────────────────────────────────────────────────────────────────

export async function getConciliacao(): Promise<ResultadoConciliacao> {
  await requireAuthenticatedUserId()
  await assertPermissao('metricas', 'ver')
  const supabase = await createClient()

  // Busca tudo em paralelo
  const [
    { data: facas },
    { data: movimentacoes },
    { data: bom },
    { data: pedidosEntregues },
    { data: pedidoItens },
  ] = await Promise.all([
    supabase.from('facas').select('id, codigo, nome, estoque_atual'),
    supabase.from('movimentacoes_estoque').select('faca_id, materia_prima_id, pedido_id, tipo, quantidade'),
    supabase.from('faca_materias_primas').select('faca_id, materia_prima_id, quantidade, materia_prima:materias_primas(id, codigo, nome)'),
    supabase.from('pedidos').select('id, codigo').eq('status', 'entregue'),
    supabase.from('pedido_itens').select('pedido_id, faca_id, quantidade, faca:facas(id, codigo, nome)'),
  ])

  const movs = movimentacoes ?? []
  const bomItems = bom ?? []
  const pedidos = pedidosEntregues ?? []
  const itens = pedidoItens ?? []

  // ── 1. Integridade de estoque por faca ──────────────────────────────────────

  const resultFacas: ConciliacaoFaca[] = (facas ?? []).map((faca) => {
    const movsFaca = movs.filter((m) => m.faca_id === faca.id)

    const totalProduzido = movsFaca
      .filter((m) => m.tipo === 'entrada')
      .reduce((s, m) => s + m.quantidade, 0)

    const totalVendido = movsFaca
      .filter((m) => m.tipo === 'saida_venda')
      .reduce((s, m) => s + m.quantidade, 0)

    const saldoMovimentos = totalProduzido - totalVendido
    const estoqueInicialImplicito = faca.estoque_atual - saldoMovimentos
    const divergencia = estoqueInicialImplicito  // deve ser >= 0

    const nivel: NivelAlerta = divergencia < 0 ? 'divergencia' : 'ok'
    const detalhe = divergencia < 0
      ? `Estoque impossível: ${Math.abs(divergencia)} unidade(s) saíram sem registro de produção ou venda correspondente.`
      : totalProduzido === 0 && totalVendido === 0
        ? 'Sem movimentações registradas — estoque inicial sem rastreio.'
        : 'Balanço consistente.'

    return {
      facaId: faca.id,
      facaCodigo: faca.codigo,
      facaNome: faca.nome,
      estoqueAtual: faca.estoque_atual,
      totalProduzido,
      totalVendido,
      saldoMovimentos,
      estoqueInicialImplicito,
      divergencia,
      nivel,
      detalhe,
    }
  })

  // ── 2. Consumo de MP vs produção registrada ─────────────────────────────────

  const resultProducao: ConciliacaoProducao[] = []

  for (const faca of facas ?? []) {
    const totalProduzidoFaca = movs
      .filter((m) => m.faca_id === faca.id && m.tipo === 'entrada')
      .reduce((s, m) => s + m.quantidade, 0)

    if (totalProduzidoFaca === 0) continue  // faca sem produção registrada — skip

    const bomFaca = bomItems.filter((b) => b.faca_id === faca.id)

    for (const bomItem of bomFaca) {
      const mp = Array.isArray(bomItem.materia_prima) ? bomItem.materia_prima[0] : bomItem.materia_prima
      if (!mp) continue

      const consumoEsperado = Math.round(totalProduzidoFaca * bomItem.quantidade * 1000) / 1000

      const consumoRegistrado = movs
        .filter(
          (m) =>
            m.faca_id === faca.id &&
            m.materia_prima_id === bomItem.materia_prima_id &&
            m.tipo === 'saida_producao',
        )
        .reduce((s, m) => s + m.quantidade, 0)

      const divergencia = Math.round((consumoRegistrado - consumoEsperado) * 1000) / 1000
      const nivel: NivelAlerta = divergencia !== 0 ? 'divergencia' : 'ok'
      const detalhe = divergencia < 0
        ? `Faltam ${Math.abs(divergencia)} unidade(s) de ${mp.codigo} — menos MP consumida do que o esperado pelo BOM.`
        : divergencia > 0
          ? `Excesso de ${divergencia} unidade(s) de ${mp.codigo} consumidas além do BOM.`
          : 'Consumo de MP consistente com a produção.'

      resultProducao.push({
        facaId: faca.id,
        facaCodigo: faca.codigo,
        facaNome: faca.nome,
        mpId: bomItem.materia_prima_id,
        mpCodigo: mp.codigo,
        mpNome: mp.nome,
        totalProduzidoFaca,
        consumoEsperado,
        consumoRegistrado,
        divergencia,
        nivel,
        detalhe,
      })
    }
  }

  // ── 3. Conciliação de vendas ─────────────────────────────────────────────────

  const resultVendas: ConciliacaoVenda[] = []

  for (const pedido of pedidos) {
    const itensPedido = itens.filter((i) => i.pedido_id === pedido.id)

    for (const item of itensPedido) {
      const faca = Array.isArray(item.faca) ? item.faca[0] : item.faca

      const quantidadeMovimento = movs
        .filter(
          (m) =>
            m.pedido_id === pedido.id &&
            m.faca_id === item.faca_id &&
            m.tipo === 'saida_venda',
        )
        .reduce((s, m) => s + m.quantidade, 0)

      const divergencia = quantidadeMovimento - item.quantidade
      const nivel: NivelAlerta = divergencia !== 0 ? 'divergencia' : 'ok'
      const detalhe = divergencia < 0
        ? `Pedido ${pedido.codigo}: ${Math.abs(divergencia)} unidade(s) entregue(s) sem movimentação de saída registrada.`
        : divergencia > 0
          ? `Pedido ${pedido.codigo}: ${divergencia} movimentação(ões) de saída a mais do que o pedido.`
          : 'Venda conciliada.'

      if (nivel === 'divergencia') {
        resultVendas.push({
          pedidoId: pedido.id,
          pedidoCodigo: pedido.codigo,
          facaId: item.faca_id,
          facaCodigo: faca?.codigo ?? '?',
          facaNome: faca?.nome ?? '?',
          quantidadePedido: item.quantidade,
          quantidadeMovimento,
          divergencia,
          nivel,
          detalhe,
        })
      }
    }
  }

  // ── Resumo ───────────────────────────────────────────────────────────────────

  const facasDivergentes = resultFacas.filter((f) => f.nivel === 'divergencia').length
  const producaoDivergente = resultProducao.filter((p) => p.nivel === 'divergencia').length
  const vendasDivergentes = resultVendas.filter((v) => v.nivel === 'divergencia').length
  const totalDivergencias = facasDivergentes + producaoDivergente + vendasDivergentes

  return {
    geradoEm: new Date().toISOString(),
    tudoOk: totalDivergencias === 0,
    totalDivergencias,
    facas: resultFacas,
    producao: resultProducao,
    vendas: resultVendas,
    resumo: { facasDivergentes, producaoDivergente, vendasDivergentes },
  }
}

export async function corrigirDivergenciaVenda(pedidoId: string, facaId: string): Promise<{ corrigido: number }> {
  await assertPermissao('vendas', 'editar')
  const supabase = await createClient()

  const [{ data: pedido }, { data: item }, { data: movs }] = await Promise.all([
    supabase.from('pedidos').select('id, status').eq('id', pedidoId).maybeSingle(),
    supabase
      .from('pedido_itens')
      .select('pedido_id, faca_id, quantidade')
      .eq('pedido_id', pedidoId)
      .eq('faca_id', facaId)
      .maybeSingle(),
    supabase
      .from('movimentacoes_estoque')
      .select('quantidade')
      .eq('pedido_id', pedidoId)
      .eq('faca_id', facaId)
      .eq('tipo', 'saida_venda'),
  ])

  if (!pedido) throw new Error('Pedido não encontrado.')
  if (pedido.status !== 'entregue') throw new Error('Somente pedidos entregues podem ser conciliados.')
  if (!item) throw new Error('Item do pedido não encontrado para esta faca.')

  const quantidadeMovimentoAtual = (movs ?? []).reduce((s, m) => s + Number(m.quantidade ?? 0), 0)
  const faltante = Number(item.quantidade) - quantidadeMovimentoAtual

  if (faltante <= 0) {
    throw new Error('Não há baixa faltante para este item.')
  }

  const { data: faca } = await supabase
    .from('facas')
    .select('id, nome, estoque_atual')
    .eq('id', facaId)
    .maybeSingle()

  if (!faca) throw new Error('Faca não encontrada.')
  if (faca.estoque_atual < faltante) {
    throw new Error(`Estoque insuficiente para corrigir (${faca.nome}): precisa ${faltante}, tem ${faca.estoque_atual}.`)
  }

  const user = await getAuthenticatedUser()

  const { error: movErr } = await supabase.from('movimentacoes_estoque').insert({
    tipo: 'saida_venda',
    faca_id: facaId,
    pedido_id: pedidoId,
    quantidade: faltante,
    usuario_id: user?.id ?? null,
  })
  if (movErr) throw new Error(`Erro ao registrar baixa: ${movErr.message}`)

  const { error: estoqueErr } = await supabase
    .from('facas')
    .update({ estoque_atual: faca.estoque_atual - faltante })
    .eq('id', facaId)
  if (estoqueErr) throw new Error(`Erro ao atualizar estoque: ${estoqueErr.message}`)

  revalidatePath('/metricas/conciliacao')
  revalidatePath('/vendas')
  revalidatePath('/facas')
  revalidateTag('metricas-conciliacao', 'max')
  revalidateTag('vendas-list', 'max')
  revalidateTag('metricas-vendas', 'max')
  revalidateTag('facas-list', 'max')
  revalidateTag('metricas-estoque', 'max')

  return { corrigido: faltante }
}
