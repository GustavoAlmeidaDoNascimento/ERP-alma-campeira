import { createClient } from '@/lib/supabase/server'

type Supabase = Awaited<ReturnType<typeof createClient>>

export type ResultadoAnalise = {
  criouFila: boolean
  quantidadeItens: number
}

/**
 * Algoritmo inteligente de análise de reposição para um pedido entregue.
 *
 * Para cada MP usada pelas facas do pedido:
 *   1. Se MP.estoque_atual >= MP.estoque_minimo → não precisa repor
 *   2. Se abaixo do mínimo: verifica TODAS as facas que usam essa MP
 *      - Se ao menos uma faca estiver abaixo do mínimo → sugere reposição
 *      - Quantidade sugerida = estoque_minimo - estoque_atual
 *
 * Se houver itens sugeridos, cria registro em fila_reposicao + fila_reposicao_itens.
 */
export async function analisarReposicaoParaPedido(
  supabase: Supabase,
  pedido_id: string,
): Promise<ResultadoAnalise> {
  // 1. Busca itens do pedido com as facas
  const { data: pedidoItens, error: pedidoErr } = await supabase
    .from('pedido_itens')
    .select('faca_id, quantidade')
    .eq('pedido_id', pedido_id)

  if (pedidoErr) throw new Error(pedidoErr.message)
  if (!pedidoItens || pedidoItens.length === 0) return { criouFila: false, quantidadeItens: 0 }

  const facaIds = [...new Set(pedidoItens.map((i) => i.faca_id))]

  // 2. Busca BOM das facas do pedido com dados da MP
  const { data: boms, error: bomErr } = await supabase
    .from('faca_materias_primas')
    .select(`
      faca_id,
      materia_prima_id,
      quantidade,
      mp:materias_primas(
        id, codigo, nome, preco_custo, estoque_atual, estoque_minimo,
        fornecedor_id,
        fornecedor:fornecedores(id, nome)
      )
    `)
    .in('faca_id', facaIds)

  if (bomErr) throw new Error(bomErr.message)
  if (!boms || boms.length === 0) return { criouFila: false, quantidadeItens: 0 }

  // 3. Coleta MPs únicas abaixo do mínimo
  type MpInfo = {
    id: string
    codigo: string
    nome: string
    preco_custo: number
    estoque_atual: number
    estoque_minimo: number
    fornecedor_id: string | null
    fornecedor_nome: string | null
  }

  const mpMap = new Map<string, MpInfo>()
  for (const bom of boms) {
    const mp = (Array.isArray(bom.mp) ? bom.mp[0] : bom.mp) as {
      id: string; codigo: string; nome: string; preco_custo: number
      estoque_atual: number; estoque_minimo: number; fornecedor_id: string | null
      fornecedor: { id: string; nome: string } | { id: string; nome: string }[] | null
    } | null
    if (!mp) continue
    if (mpMap.has(mp.id)) continue

    const fornecedor = mp.fornecedor
      ? (Array.isArray(mp.fornecedor) ? mp.fornecedor[0] : mp.fornecedor)
      : null

    mpMap.set(mp.id, {
      id: mp.id,
      codigo: mp.codigo,
      nome: mp.nome,
      preco_custo: Number(mp.preco_custo ?? 0),
      estoque_atual: Number(mp.estoque_atual ?? 0),
      estoque_minimo: Number(mp.estoque_minimo ?? 0),
      fornecedor_id: mp.fornecedor_id,
      fornecedor_nome: fornecedor?.nome ?? null,
    })
  }

  // Filtra apenas MPs abaixo do mínimo
  const mpsBaixas = Array.from(mpMap.values()).filter(
    (mp) => mp.estoque_atual < mp.estoque_minimo,
  )

  if (mpsBaixas.length === 0) return { criouFila: false, quantidadeItens: 0 }

  // 4. Para cada MP abaixo do mínimo, verifica se alguma faca que usa essa MP
  //    está também abaixo do mínimo (globalmente, não só no pedido)
  const mpIdsParaVerificar = mpsBaixas.map((mp) => mp.id)

  // Busca todas as facas que usam essas MPs (globalmente)
  const { data: todasFacasComMp, error: facasErr } = await supabase
    .from('faca_materias_primas')
    .select(`
      faca_id,
      materia_prima_id,
      quantidade,
      faca:facas(id, nome, estoque_atual, estoque_minimo)
    `)
    .in('materia_prima_id', mpIdsParaVerificar)

  if (facasErr) throw new Error(facasErr.message)

  // Agrupa facas por MP
  type FacaInfo = { faca_id: string; faca_nome: string; estoque_atual: number; estoque_minimo: number; quantidade_bom: number }
  const facasPorMp = new Map<string, FacaInfo[]>()
  for (const row of todasFacasComMp ?? []) {
    const faca = (Array.isArray(row.faca) ? row.faca[0] : row.faca) as {
      id: string; nome: string; estoque_atual: number; estoque_minimo: number
    } | null
    if (!faca) continue
    const list = facasPorMp.get(row.materia_prima_id) ?? []
    list.push({
      faca_id: faca.id,
      faca_nome: faca.nome,
      estoque_atual: Number(faca.estoque_atual ?? 0),
      estoque_minimo: Number(faca.estoque_minimo ?? 0),
      quantidade_bom: Number(row.quantidade),
    })
    facasPorMp.set(row.materia_prima_id, list)
  }

  // 5. Decide quais MPs realmente precisam de reposição
  type ItemSugerido = {
    materia_prima_id: string
    quantidade_sugerida: number
  }

  const itensSugeridos: ItemSugerido[] = []

  for (const mp of mpsBaixas) {
    const facas = facasPorMp.get(mp.id) ?? []
    const algumFacaAbaixoMinimo = facas.some((f) => f.estoque_atual < f.estoque_minimo)
    if (!algumFacaAbaixoMinimo) continue

    const quantidade_sugerida = mp.estoque_minimo - mp.estoque_atual
    itensSugeridos.push({ materia_prima_id: mp.id, quantidade_sugerida })
  }

  if (itensSugeridos.length === 0) return { criouFila: false, quantidadeItens: 0 }

  // 6. Cria registro na fila_reposicao
  const { data: filaRecord, error: filaErr } = await supabase
    .from('fila_reposicao')
    .insert({ pedido_id, status: 'pendente' })
    .select('id')
    .single()

  if (filaErr || !filaRecord) throw new Error(filaErr?.message ?? 'Erro ao criar fila.')

  // 7. Cria os itens
  const itensInsert = itensSugeridos.map((item) => ({
    fila_id: filaRecord.id,
    materia_prima_id: item.materia_prima_id,
    quantidade_sugerida: item.quantidade_sugerida,
    quantidade_adicional: 0,
    selecionado: true,
  }))

  const { error: itensErr } = await supabase.from('fila_reposicao_itens').insert(itensInsert)
  if (itensErr) {
    await supabase.from('fila_reposicao').delete().eq('id', filaRecord.id)
    throw new Error(itensErr.message)
  }

  return { criouFila: true, quantidadeItens: itensSugeridos.length }
}
