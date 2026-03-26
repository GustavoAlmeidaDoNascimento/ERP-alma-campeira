'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { unstable_cache } from 'next/cache'
import { createClient, withSupabaseCookieContext } from '@/lib/supabase/server'
import { assertPermissao, getAuthenticatedUser } from '@/lib/auth'
import type { OrdemCompra, FilaFornecedor } from '@/types'

// ─── Fila de Reposição ────────────────────────────────────────────────────────

async function carregarFilaReposicao(supabase: Awaited<ReturnType<typeof createClient>>): Promise<FilaFornecedor[]> {
  const { data, error } = await supabase
    .from('fila_reposicao')
    .select(`
      materia_prima_id,
      fornecedor_id,
      quantidade_pendente,
      mp:materias_primas(id, codigo, nome, preco_custo),
      fornecedor:fornecedores(id, nome)
    `)

  if (error) throw new Error(error.message)

  const mapa = new Map<string, FilaFornecedor>()
  for (const row of data ?? []) {
    const mp = (Array.isArray(row.mp) ? row.mp[0] : row.mp) as {
      id: string; codigo: string; nome: string; preco_custo: number
    } | null
    const forn = (Array.isArray(row.fornecedor) ? row.fornecedor[0] : row.fornecedor) as {
      id: string; nome: string
    } | null
    if (!mp) continue
    const chave = row.fornecedor_id ?? '__sem_fornecedor__'
    if (!mapa.has(chave)) {
      mapa.set(chave, {
        fornecedor_id: row.fornecedor_id,
        fornecedor_nome: forn?.nome ?? 'Sem fornecedor',
        itens: [],
      })
    }
    const grupo = mapa.get(chave)!
    const existente = grupo.itens.find((i) => i.materia_prima_id === row.materia_prima_id)
    if (existente) {
      existente.quantidade_total += Number(row.quantidade_pendente)
    } else {
      grupo.itens.push({
        materia_prima_id: row.materia_prima_id,
        mp_codigo: mp.codigo,
        mp_nome: mp.nome,
        mp_preco_custo: Number(mp.preco_custo),
        quantidade_total: Number(row.quantidade_pendente),
      })
    }
  }

  return Array.from(mapa.values()).sort((a, b) => a.fornecedor_nome.localeCompare(b.fornecedor_nome))
}

async function backfillFilaReposicaoFromEntregues(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<boolean> {
  // Para evitar trabalho desnecessário, só backfill quando não há nada em fila.
  const { count, error: countErr } = await supabase
    .from('fila_reposicao')
    .select('id', { count: 'exact', head: true })
  if (countErr) throw new Error(countErr.message)
  if (count != null && count > 0) return false

  const { data: entregues, error: entreguesErr } = await supabase
    .from('pedidos')
    .select('id')
    .eq('status', 'entregue')

  if (entreguesErr) throw new Error(entreguesErr.message)
  if (!entregues || entregues.length === 0) return false

  let insertedAny = false

  for (const p of entregues) {
    const { data: exists } = await supabase
      .from('fila_reposicao')
      .select('id')
      .eq('pedido_id', p.id)
      .limit(1)

    if (exists && exists.length > 0) continue

    const { data: itens, error: itensErr } = await supabase
      .from('pedido_itens')
      .select('faca_id, quantidade')
      .eq('pedido_id', p.id)

    if (itensErr) throw new Error(itensErr.message)
    if (!itens || itens.length === 0) continue

    const facaIds = [...new Set(itens.map((i) => i.faca_id))]

    const { data: boms, error: bomsErr } = await supabase
      .from('faca_materias_primas')
      .select('faca_id, materia_prima_id, quantidade, mp:materias_primas(id, fornecedor_id)')
      .in('faca_id', facaIds)

    if (bomsErr) throw new Error(bomsErr.message)
    if (!boms || boms.length === 0) continue

    for (const item of itens) {
      const facaBom = (boms ?? []).filter((b) => b.faca_id === item.faca_id)
      for (const bom of facaBom) {
        const mp = (Array.isArray((bom as any).mp) ? (bom as any).mp[0] : (bom as any).mp) as
          | { id: string; fornecedor_id: string | null }
          | null
        if (!mp) continue

        await supabase.from('fila_reposicao').insert({
          materia_prima_id: (bom as any).materia_prima_id,
          fornecedor_id: mp.fornecedor_id,
          quantidade_pendente: (bom as any).quantidade * item.quantidade,
          pedido_id: p.id,
        })
        insertedAny = true
      }
    }
  }

  return insertedAny
}

const getFilaReposicaoCached = unstable_cache(
  async (): Promise<FilaFornecedor[]> => {
    const supabase = await createClient()
    return carregarFilaReposicao(supabase)
  },
  ['ordens-compra-fila'],
  { revalidate: 30, tags: ['ordens-compra-fila'] }
)

export async function getFilaReposicao(): Promise<FilaFornecedor[]> {
  await assertPermissao('ordens_compra', 'ver')
  return withSupabaseCookieContext(async () => {
    const supabase = await createClient()
    const didBackfill = await backfillFilaReposicaoFromEntregues(supabase)
    if (didBackfill) return carregarFilaReposicao(supabase)
    return getFilaReposicaoCached()
  })
}

// ─── Gerar OC ─────────────────────────────────────────────────────────────────

async function gerarCodigoOC(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data } = await supabase
    .from('ordens_compra')
    .select('codigo')
    .order('codigo', { ascending: false })
    .limit(1)
    .single()

  if (!data) return 'OC-0001'
  const num = parseInt(data.codigo.replace('OC-', ''), 10)
  return `OC-${String(num + 1).padStart(4, '0')}`
}

export async function gerarOC(fornecedor_id: string | null): Promise<string> {
  await assertPermissao('ordens_compra', 'criar')
  const supabase = await createClient()

  // Buscar itens da fila para este fornecedor
  const query = supabase
    .from('fila_reposicao')
    .select('id, materia_prima_id, quantidade_pendente, mp:materias_primas(preco_custo)')

  const { data: filaRows, error: filaErr } =
    fornecedor_id === null
      ? await query.is('fornecedor_id', null)
      : await query.eq('fornecedor_id', fornecedor_id)

  if (filaErr) throw new Error(filaErr.message)
  if (!filaRows || filaRows.length === 0) throw new Error('Nenhum item na fila para este fornecedor.')

  // Agrupar por materia_prima_id
  const agrupado = new Map<string, { quantidade: number; preco_custo: number }>()
  for (const row of filaRows) {
    const mp = (Array.isArray(row.mp) ? row.mp[0] : row.mp) as { preco_custo: number } | null
    const existing = agrupado.get(row.materia_prima_id)
    if (existing) {
      existing.quantidade += Number(row.quantidade_pendente)
    } else {
      agrupado.set(row.materia_prima_id, {
        quantidade: Number(row.quantidade_pendente),
        preco_custo: Number(mp?.preco_custo ?? 0),
      })
    }
  }

  const codigo = await gerarCodigoOC(supabase)

  // Criar OC
  const { data: oc, error: ocErr } = await supabase
    .from('ordens_compra')
    .insert({
      codigo,
      fornecedor_id: fornecedor_id ?? null,
      status: 'pendente',
      data_geracao: new Date().toISOString().split('T')[0],
    })
    .select('id')
    .single()

  if (ocErr || !oc) throw new Error(ocErr?.message ?? 'Erro ao criar OC.')

  // Criar itens
  const itens = Array.from(agrupado.entries()).map(([mp_id, { quantidade, preco_custo }]) => ({
    ordem_compra_id: oc.id,
    materia_prima_id: mp_id,
    quantidade,
    preco_unitario: preco_custo,
  }))

  const { error: itensErr } = await supabase.from('ordem_compra_itens').insert(itens)
  if (itensErr) throw new Error(itensErr.message)

  // Limpar fila
  const idsParaDeletar = filaRows.map((r) => r.id)
  await supabase.from('fila_reposicao').delete().in('id', idsParaDeletar)

  revalidatePath('/ordens-compra')
  revalidateTag('ordens-compra-historico')
  revalidateTag('ordens-compra-fila')
  return codigo
}

export async function gerarTodasOCs(): Promise<number> {
  await assertPermissao('ordens_compra', 'criar')
  const supabase = await createClient()

  // Buscar fornecedores distintos na fila
  const { data, error } = await supabase
    .from('fila_reposicao')
    .select('fornecedor_id')

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('Fila de reposição está vazia.')

  const fornecedorIds = [...new Set(data.map((r) => r.fornecedor_id))]
  let criadas = 0

  for (const fid of fornecedorIds) {
    await gerarOC(fid)
    criadas++
  }

  revalidatePath('/ordens-compra')
  revalidateTag('ordens-compra-historico')
  revalidateTag('ordens-compra-fila')
  return criadas
}

// ─── Consultas de OC ──────────────────────────────────────────────────────────

const getOrdensCompraCached = unstable_cache(
  async (): Promise<OrdemCompra[]> => {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('ordens_compra')
      .select(`
        *,
        fornecedor:fornecedores(id, nome),
        itens:ordem_compra_itens(
          id, ordem_compra_id, materia_prima_id, quantidade, preco_unitario,
          materia_prima:materias_primas(id, codigo, nome)
        )
      `)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data as OrdemCompra[]
  },
  ['ordens-compra-historico'],
  { revalidate: 30, tags: ['ordens-compra-historico'] }
)

export async function getOrdensCompra(): Promise<OrdemCompra[]> {
  await assertPermissao('ordens_compra', 'ver')
  return withSupabaseCookieContext(() => getOrdensCompraCached())
}

// ─── Editar OC ────────────────────────────────────────────────────────────────

export async function atualizarQuantidadeItem(item_id: string, quantidade: number) {
  await assertPermissao('ordens_compra', 'editar')
  if (quantidade <= 0) throw new Error('Quantidade deve ser maior que zero.')

  const supabase = await createClient()
  const { error } = await supabase
    .from('ordem_compra_itens')
    .update({ quantidade })
    .eq('id', item_id)

  if (error) throw new Error(error.message)
  revalidatePath('/ordens-compra')
  revalidateTag('ordens-compra-historico')
}

export async function atualizarObservacaoOC(id: string, observacao: string) {
  await assertPermissao('ordens_compra', 'editar')
  const supabase = await createClient()
  const { error } = await supabase
    .from('ordens_compra')
    .update({ observacao: observacao.trim() || null })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/ordens-compra')
  revalidateTag('ordens-compra-historico')
}

export async function mudarStatusOC(id: string, status: 'pendente' | 'enviada' | 'recebida') {
  await assertPermissao('ordens_compra', 'editar')
  const supabase = await createClient()

  if (status === 'recebida') {
    // Buscar itens da OC
    const { data: itens, error: itensErr } = await supabase
      .from('ordem_compra_itens')
      .select('materia_prima_id, quantidade')
      .eq('ordem_compra_id', id)

    if (itensErr) throw new Error(itensErr.message)

    const user = await getAuthenticatedUser()

    // Incrementar estoque e registrar movimentação
    for (const item of itens ?? []) {
      const { data: mp } = await supabase
        .from('materias_primas')
        .select('estoque_atual')
        .eq('id', item.materia_prima_id)
        .single()

      if (mp) {
        await supabase
          .from('materias_primas')
          .update({ estoque_atual: Number(mp.estoque_atual) + Number(item.quantidade) })
          .eq('id', item.materia_prima_id)
      }

      await supabase.from('movimentacoes_estoque').insert({
        tipo: 'entrada',
        materia_prima_id: item.materia_prima_id,
        quantidade: item.quantidade,
        observacao: `Recebimento OC`,
        usuario_id: user?.id ?? null,
      })
    }
  }

  const { error } = await supabase
    .from('ordens_compra')
    .update({ status })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/ordens-compra')
  revalidateTag('ordens-compra-historico')
}

export async function deletarOC(id: string) {
  await assertPermissao('ordens_compra', 'deletar')
  const supabase = await createClient()

  const { data: oc } = await supabase
    .from('ordens_compra')
    .select('status')
    .eq('id', id)
    .single()

  if (oc?.status !== 'pendente') throw new Error('Apenas OCs pendentes podem ser excluídas.')

  const { error } = await supabase.from('ordens_compra').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/ordens-compra')
  revalidateTag('ordens-compra-historico')
}
