'use server'

import { createClient, withSupabaseCookieContext } from '@/lib/supabase/server'
import { assertPermissao, getAuthenticatedUser } from '@/lib/auth'
import {
  gerarCodigoOC,
  gerarOCsDeFilaItens,
} from '@/lib/ordens-compra/gerar-oc-fila'
import type {
  OrdemCompra,
  FilaReposicao,
  FilaReposicaoDetalhe,
  FilaReposicaoItem,
  FilaReposicaoPedidoItem,
  StatusOC,
} from '@/types'

const STATUS_OC_VALIDOS: readonly StatusOC[] = ['pendente', 'enviada', 'recebida']

/** Compat: bases legadas com status `pago` ou sem coluna `pago`. */
function normalizarStatusEPago(row: { status?: unknown; pago?: unknown }): { status: StatusOC; pago: boolean } {
  let status = String(row.status ?? 'pendente')
  let pago = Boolean(row.pago)
  if (status === 'pago') {
    status = 'enviada'
    pago = true
  }
  if (!STATUS_OC_VALIDOS.includes(status as StatusOC)) status = 'pendente'
  return { status: status as StatusOC, pago }
}

async function resolverUsuarioRegistroOC(usuarioRegistroId: string | null | undefined): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.id) throw new Error('Não autenticado.')
  const escolha = typeof usuarioRegistroId === 'string' ? usuarioRegistroId.trim() : ''
  const alvo = escolha || user.id
  if (alvo === user.id) return user.id
  const { data: perfil, error } = await supabase
    .from('usuarios_perfis')
    .select('id')
    .eq('id', alvo)
    .eq('ativo', true)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!perfil) throw new Error('Usuário selecionado inválido ou inativo.')
  return alvo
}

function camposRegistroAlteracao(usuarioId: string) {
  return {
    ultima_alteracao_usuario_id: usuarioId,
    ultima_alteracao_em: new Date().toISOString(),
  }
}

async function marcarUltimaAlteracaoOC(ordemCompraId: string, usuarioId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('ordens_compra')
    .update(camposRegistroAlteracao(usuarioId))
    .eq('id', ordemCompraId)
  if (error) throw new Error(error.message)
}

export async function getUsuariosParaRegistroOC(): Promise<{ id: string; nome: string }[]> {
  await assertPermissao('ordens_compra', 'editar')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('usuarios_perfis')
    .select('id, nome')
    .eq('ativo', true)
    .order('nome')
  if (error) throw new Error(error.message)
  return data ?? []
}

// ─── Fila de Reposição ────────────────────────────────────────────────────────

export async function getFilaReposicaoList(): Promise<FilaReposicao[]> {
  await assertPermissao('ordens_compra', 'ver')
  return withSupabaseCookieContext(async () => {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('fila_reposicao')
      .select(`
        id,
        pedido_id,
        status,
        created_at,
        pedido:pedidos(
          id,
          codigo,
          cliente:clientes(id, nome)
        ),
        itens:fila_reposicao_itens(id)
      `)
      .in('status', ['pendente'])
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)

    return (data ?? []).map((row) => {
      const pedido = (Array.isArray(row.pedido) ? row.pedido[0] : row.pedido) as {
        id: string; codigo: string
        cliente: { id: string; nome: string } | { id: string; nome: string }[] | null
      } | null
      const cliente = pedido?.cliente
        ? (Array.isArray(pedido.cliente) ? pedido.cliente[0] : pedido.cliente)
        : null

      return {
        id: row.id,
        pedido_id: row.pedido_id,
        pedido_codigo: pedido?.codigo ?? '—',
        cliente_nome: cliente?.nome ?? '—',
        status: row.status as FilaReposicao['status'],
        created_at: row.created_at ?? '',
        itens_count: Array.isArray(row.itens) ? row.itens.length : 0,
      }
    })
  })
}

export async function getFilaReposicaoDetalhe(fila_id: string): Promise<FilaReposicaoDetalhe> {
  await assertPermissao('ordens_compra', 'ver')
  return withSupabaseCookieContext(async () => {
    const supabase = await createClient()

    // Uma única query: fila + pedido/cliente + itens + MP + fornecedor + facas que usam a MP.
    // Antes eram 3 queries sequenciais (~3 round-trips). Os FKs já têm índices em
    // perf_indexes.sql, então o embed sai barato.
    const { data: filaRow, error: filaErr } = await supabase
      .from('fila_reposicao')
      .select(`
        id,
        pedido_id,
        status,
        created_at,
        pedido:pedidos(
          id,
          codigo,
          cliente:clientes(id, nome),
          pedido_itens(
            faca_id,
            quantidade,
            preco_unitario,
            faca:facas(
              id, codigo, nome,
              faca_mp:faca_materias_primas(
                quantidade,
                mp:materias_primas(id, codigo, nome, estoque_atual, estoque_minimo)
              )
            )
          )
        ),
        itens:fila_reposicao_itens(
          id,
          fila_id,
          materia_prima_id,
          quantidade_sugerida,
          quantidade_adicional,
          selecionado,
          mp:materias_primas(
            id, codigo, nome, preco_custo, estoque_atual, estoque_minimo,
            fornecedor_id,
            fornecedor:fornecedores(id, nome),
            faca_mp:faca_materias_primas(
              quantidade,
              faca:facas(id, nome, estoque_atual, estoque_minimo)
            )
          )
        )
      `)
      .eq('id', fila_id)
      .single()

    if (filaErr || !filaRow) throw new Error(filaErr?.message ?? 'Fila não encontrada.')

    const pedido = (Array.isArray(filaRow.pedido) ? filaRow.pedido[0] : filaRow.pedido) as {
      id: string; codigo: string
      cliente: { id: string; nome: string } | { id: string; nome: string }[] | null
      pedido_itens: Array<{
        faca_id: string
        quantidade: number
        preco_unitario: number
        faca: FacaWithMp | FacaWithMp[] | null
      }> | null
    } | null

    type MpRel = {
      id: string; codigo: string; nome: string
      estoque_atual: number; estoque_minimo: number
    }
    type FacaWithMp = {
      id: string; codigo: string; nome: string
      faca_mp: Array<{
        quantidade: number
        mp: MpRel | MpRel[] | null
      }> | null
    }
    const cliente = pedido?.cliente
      ? (Array.isArray(pedido.cliente) ? pedido.cliente[0] : pedido.cliente)
      : null

    const pedido_itens: FilaReposicaoPedidoItem[] = (pedido?.pedido_itens ?? []).map((pi) => {
      const faca = Array.isArray(pi.faca) ? pi.faca[0] : pi.faca
      const materias_primas: FilaReposicaoPedidoItem['materias_primas'] = []
      for (const fm of faca?.faca_mp ?? []) {
        const mp = Array.isArray(fm.mp) ? fm.mp[0] : fm.mp
        if (!mp) continue
        materias_primas.push({
          mp_id: mp.id,
          mp_codigo: mp.codigo,
          mp_nome: mp.nome,
          quantidade_por_faca: Number(fm.quantidade),
          estoque_atual: Number(mp.estoque_atual ?? 0),
          estoque_minimo: Number(mp.estoque_minimo ?? 0),
        })
      }
      return {
        faca_id: pi.faca_id,
        faca_codigo: faca?.codigo ?? '—',
        faca_nome: faca?.nome ?? '—',
        quantidade: Number(pi.quantidade),
        preco_unitario: Number(pi.preco_unitario),
        materias_primas,
      }
    })

    const itensRows = (filaRow.itens ?? []) as Array<{
      id: string; fila_id: string; materia_prima_id: string
      quantidade_sugerida: number; quantidade_adicional: number; selecionado: boolean
      mp: unknown
    }>

    const fila: FilaReposicao = {
      id: filaRow.id,
      pedido_id: filaRow.pedido_id,
      pedido_codigo: pedido?.codigo ?? '—',
      cliente_nome: cliente?.nome ?? '—',
      status: filaRow.status as FilaReposicao['status'],
      created_at: filaRow.created_at ?? '',
      itens_count: itensRows.length,
    }

    const itens: FilaReposicaoItem[] = itensRows.map((row) => {
      const mp = (Array.isArray(row.mp) ? row.mp[0] : row.mp) as {
        id: string; codigo: string; nome: string; preco_custo: number
        estoque_atual: number; estoque_minimo: number; fornecedor_id: string | null
        fornecedor: { id: string; nome: string } | { id: string; nome: string }[] | null
        faca_mp: Array<{
          quantidade: number
          faca: { id: string; nome: string; estoque_atual: number; estoque_minimo: number }
            | { id: string; nome: string; estoque_atual: number; estoque_minimo: number }[]
            | null
        }> | null
      } | null

      const fornecedor = mp?.fornecedor
        ? (Array.isArray(mp.fornecedor) ? mp.fornecedor[0] : mp.fornecedor)
        : null

      const facas_relacionadas: FilaReposicaoItem['facas_relacionadas'] = []
      for (const fm of mp?.faca_mp ?? []) {
        const faca = Array.isArray(fm.faca) ? fm.faca[0] : fm.faca
        if (!faca) continue
        facas_relacionadas.push({
          faca_id: faca.id,
          faca_nome: faca.nome,
          estoque_atual: Number(faca.estoque_atual ?? 0),
          estoque_minimo: Number(faca.estoque_minimo ?? 0),
          quantidade_bom: Number(fm.quantidade),
        })
      }

      return {
        id: row.id,
        fila_id: row.fila_id,
        materia_prima_id: row.materia_prima_id,
        mp_nome: mp?.nome ?? '—',
        mp_codigo: mp?.codigo ?? '—',
        mp_preco_custo: Number(mp?.preco_custo ?? 0),
        fornecedor_id: mp?.fornecedor_id ?? null,
        fornecedor_nome: fornecedor?.nome ?? null,
        estoque_atual: Number(mp?.estoque_atual ?? 0),
        estoque_minimo: Number(mp?.estoque_minimo ?? 0),
        quantidade_sugerida: Number(row.quantidade_sugerida),
        quantidade_adicional: Number(row.quantidade_adicional),
        selecionado: row.selecionado,
        facas_relacionadas,
      }
    })

    return { fila, itens, pedido_itens }
  })
}

export async function atualizarItemFila(
  item_id: string,
  patch: { selecionado?: boolean; quantidade_adicional?: number },
) {
  await assertPermissao('ordens_compra', 'editar')
  const supabase = await createClient()

  const update: Record<string, unknown> = {}
  if (patch.selecionado !== undefined) update.selecionado = patch.selecionado
  if (patch.quantidade_adicional !== undefined) {
    if (!Number.isFinite(patch.quantidade_adicional) || patch.quantidade_adicional < 0) {
      throw new Error('Quantidade adicional inválida.')
    }
    update.quantidade_adicional = patch.quantidade_adicional
  }

  const { error } = await supabase
    .from('fila_reposicao_itens')
    .update(update)
    .eq('id', item_id)

  if (error) throw new Error(error.message)
}

export async function gerarOCsDaFila(fila_id: string): Promise<string[]> {
  await assertPermissao('ordens_compra', 'criar')
  const supabase = await createClient()
  const uid = await resolverUsuarioRegistroOC(undefined)
  const codigos = await gerarOCsDeFilaItens(supabase, fila_id, uid)
  return codigos
}

export async function dispensarFila(fila_id: string): Promise<void> {
  await assertPermissao('ordens_compra', 'editar')
  const supabase = await createClient()

  const { error } = await supabase
    .from('fila_reposicao')
    .update({ status: 'dispensada', updated_at: new Date().toISOString() })
    .eq('id', fila_id)

  if (error) throw new Error(error.message)
}

// ─── OC Manual ────────────────────────────────────────────────────────────────

export type CriarOcItemManual = {
  materia_prima_id: string
  quantidade: number
  /** Se omitido, usa o preço de custo cadastrado na matéria-prima. */
  preco_unitario?: number | null
}

/**
 * Cria uma OC manualmente (sem passar pela fila de reposição).
 */
export async function criarOrdemCompraManual(input: {
  fornecedor_id: string | null
  observacao?: string | null
  itens: CriarOcItemManual[]
}): Promise<string> {
  await assertPermissao('ordens_compra', 'criar')
  const linhas = input.itens?.filter((i) => i.materia_prima_id) ?? []
  if (linhas.length === 0) throw new Error('Adicione ao menos um item com matéria-prima.')

  const supabase = await createClient()
  const mpIds = [...new Set(linhas.map((i) => i.materia_prima_id))]

  const { data: mps, error: mpErr } = await supabase
    .from('materias_primas')
    .select('id, preco_custo')
    .in('id', mpIds)

  if (mpErr) throw new Error(mpErr.message)
  if (!mps || mps.length !== mpIds.length) {
    throw new Error('Uma ou mais matérias-primas não foram encontradas.')
  }

  const custoPorId = new Map(mps.map((m) => [m.id, Number(m.preco_custo ?? 0)]))

  const agregado = new Map<string, { quantidade: number; subtotal: number }>()
  for (const row of linhas) {
    const q = Number(row.quantidade)
    if (!Number.isFinite(q) || q <= 0) throw new Error('Cada quantidade deve ser maior que zero.')

    let unit: number
    if (row.preco_unitario != null) {
      const p = Number(row.preco_unitario)
      if (!Number.isFinite(p) || p < 0) throw new Error('Preço unitário inválido.')
      unit = p
    } else {
      unit = custoPorId.get(row.materia_prima_id) ?? 0
    }

    const prev = agregado.get(row.materia_prima_id)
    const sub = q * unit
    if (!prev) {
      agregado.set(row.materia_prima_id, { quantidade: q, subtotal: sub })
    } else {
      agregado.set(row.materia_prima_id, {
        quantidade: prev.quantidade + q,
        subtotal: prev.subtotal + sub,
      })
    }
  }

  const itensInsert = Array.from(agregado.entries()).map(([materia_prima_id, { quantidade, subtotal }]) => {
    const preco_unitario = quantidade > 0 ? subtotal / quantidade : 0
    return { materia_prima_id, quantidade, preco_unitario }
  })

  const codigo = await gerarCodigoOC(supabase)

  const uidCriacao = await resolverUsuarioRegistroOC(undefined)
  const agora = new Date().toISOString()

  const { data: oc, error: ocErr } = await supabase
    .from('ordens_compra')
    .insert({
      codigo,
      fornecedor_id: input.fornecedor_id ?? null,
      status: 'pendente',
      data_geracao: new Date().toISOString().split('T')[0],
      observacao: input.observacao?.trim() || null,
      ultima_alteracao_usuario_id: uidCriacao,
      ultima_alteracao_em: agora,
    })
    .select('id')
    .single()

  if (ocErr || !oc) throw new Error(ocErr?.message ?? 'Erro ao criar OC.')

  const rows = itensInsert.map((r) => ({
    ordem_compra_id: oc.id,
    materia_prima_id: r.materia_prima_id,
    quantidade_vendida: 0,
    quantidade_adicional: r.quantidade,
    quantidade: r.quantidade,
    preco_unitario: r.preco_unitario,
  }))

  const { error: itensErr } = await supabase.from('ordem_compra_itens').insert(rows)
  if (itensErr) {
    await supabase.from('ordens_compra').delete().eq('id', oc.id)
    throw new Error(itensErr.message)
  }

  return codigo
}

// ─── Consultas de OC ──────────────────────────────────────────────────────────

/** PostgREST pode devolver embed 1:1 como objeto ou array com um elemento. */
function embedUm<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

async function getOrdensCompraQuery(): Promise<OrdemCompra[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('ordens_compra')
    .select(`
      *,
      fornecedor:fornecedores!fornecedor_id(id, nome),
      fila:fila_reposicao(
        id,
        pedido:pedidos(
          id,
          codigo,
          cliente:clientes(id, nome)
        )
      ),
      itens:ordem_compra_itens(
        id, ordem_compra_id, materia_prima_id,
        quantidade, quantidade_vendida, quantidade_adicional,
        preco_unitario,
        materia_prima:materias_primas(id, codigo, nome)
      ),
      ultima_alteracao_usuario:usuarios_perfis!ultima_alteracao_usuario_id(id, nome)
    `)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  type RowOC = Record<string, unknown> & {
    fornecedor?: unknown
    fornecedores?: unknown
    fornecedor_id?: string | null
  }

  const mapped = (data ?? []).map((row: RowOC) => {
    const fila = (Array.isArray(row.fila) ? row.fila[0] : row.fila) as {
      id: string
      pedido: { id: string; codigo: string; cliente: { nome: string } | { nome: string }[] | null } | { id: string; codigo: string; cliente: { nome: string } | { nome: string }[] | null }[] | null
    } | null
    const pedido = fila?.pedido
      ? (Array.isArray(fila.pedido) ? fila.pedido[0] : fila.pedido)
      : null
    const cliente = pedido?.cliente
      ? (Array.isArray(pedido.cliente) ? pedido.cliente[0] : pedido.cliente)
      : null
    const fornecedor =
      embedUm(row.fornecedor as { id: string; nome: string } | { id: string; nome: string }[] | null) ??
      embedUm(row.fornecedores as { id: string; nome: string } | { id: string; nome: string }[] | null)
    const ultima_alteracao_usuario = embedUm(
      row.ultima_alteracao_usuario as
        | { id: string; nome: string }
        | { id: string; nome: string }[]
        | null,
    )
    const mappedRow = {
      ...row,
      fornecedor,
      ultima_alteracao_usuario,
      pedido_id: pedido?.id ?? null,
      pedido_codigo: pedido?.codigo ?? null,
      cliente_nome: cliente?.nome ?? null,
    }
    const { status, pago } = normalizarStatusEPago(row as { status?: unknown; pago?: unknown })
    return { ...mappedRow, status, pago }
  }) as OrdemCompra[]

  const idsFaltando = [
    ...new Set(
      mapped
        .filter((oc) => oc.fornecedor_id && !oc.fornecedor?.nome)
        .map((oc) => oc.fornecedor_id as string),
    ),
  ]

  if (idsFaltando.length === 0) return mapped

  const { data: fornecedoresExtras, error: fnErr } = await supabase
    .from('fornecedores')
    .select('id, nome')
    .in('id', idsFaltando)

  if (fnErr) throw new Error(fnErr.message)

  const porId = new Map((fornecedoresExtras ?? []).map((f) => [f.id, f]))

  return mapped.map((oc) => ({
    ...oc,
    fornecedor: oc.fornecedor?.nome
      ? oc.fornecedor
      : oc.fornecedor_id
        ? (porId.get(oc.fornecedor_id) ?? oc.fornecedor ?? null)
        : (oc.fornecedor ?? null),
  }))
}

export async function getOrdensCompra(): Promise<OrdemCompra[]> {
  await assertPermissao('ordens_compra', 'ver')
  return withSupabaseCookieContext(() => getOrdensCompraQuery())
}

// ─── Editar OC ────────────────────────────────────────────────────────────────

export async function atualizarQuantidadeItem(item_id: string, quantidade: number, usuarioRegistroId?: string | null) {
  await assertPermissao('ordens_compra', 'editar')
  if (quantidade <= 0) throw new Error('Quantidade deve ser maior que zero.')

  const supabase = await createClient()
  const uid = await resolverUsuarioRegistroOC(usuarioRegistroId)
  const { data: item, error: itemErr } = await supabase
    .from('ordem_compra_itens')
    .select('quantidade_vendida, quantidade, ordem_compra_id')
    .eq('id', item_id)
    .single()

  if (itemErr) throw new Error(itemErr.message)
  if (!item) throw new Error('Item não encontrado.')

  const quantidade_vendida = Number(item.quantidade_vendida ?? item.quantidade)
  const quantidade_adicional = Math.max(0, quantidade - quantidade_vendida)

  const { error } = await supabase
    .from('ordem_compra_itens')
    .update({ quantidade, quantidade_adicional })
    .eq('id', item_id)

  if (error) throw new Error(error.message)

  await marcarUltimaAlteracaoOC(item.ordem_compra_id, uid)
}

export async function atualizarUnidadesAdicionaisItem(
  item_id: string,
  quantidade_adicional: number,
  usuarioRegistroId?: string | null,
) {
  await assertPermissao('ordens_compra', 'editar')
  if (!Number.isFinite(quantidade_adicional) || quantidade_adicional < 0) {
    throw new Error('Unidades adicionais inválidas.')
  }

  const supabase = await createClient()
  const uid = await resolverUsuarioRegistroOC(usuarioRegistroId)
  const { data: item, error: itemErr } = await supabase
    .from('ordem_compra_itens')
    .select('quantidade_vendida, ordem_compra_id')
    .eq('id', item_id)
    .single()

  if (itemErr) throw new Error(itemErr.message)
  if (!item) throw new Error('Item não encontrado.')

  const quantidade_vendida = Number(item.quantidade_vendida ?? 0)
  const quantidade_total = quantidade_vendida + Number(quantidade_adicional)

  if (quantidade_total <= 0) throw new Error('Quantidade total inválida.')

  const { error } = await supabase
    .from('ordem_compra_itens')
    .update({ quantidade_adicional, quantidade: quantidade_total })
    .eq('id', item_id)

  if (error) throw new Error(error.message)

  await marcarUltimaAlteracaoOC(item.ordem_compra_id, uid)
}

export async function criarItemOrdemCompra(
  ordem_compra_id: string,
  materia_prima_id: string,
  quantidade_adicional: number,
  usuarioRegistroId?: string | null,
) {
  await assertPermissao('ordens_compra', 'editar')
  if (!Number.isFinite(quantidade_adicional) || quantidade_adicional <= 0) {
    throw new Error('Unidades adicionais devem ser maiores que zero.')
  }

  const supabase = await createClient()
  const uid = await resolverUsuarioRegistroOC(usuarioRegistroId)
  const { data: mp, error: mpErr } = await supabase
    .from('materias_primas')
    .select('preco_custo')
    .eq('id', materia_prima_id)
    .single()

  if (mpErr) throw new Error(mpErr.message)
  if (!mp) throw new Error('Matéria-prima não encontrada.')

  const { error } = await supabase.from('ordem_compra_itens').insert({
    ordem_compra_id,
    materia_prima_id,
    quantidade_vendida: 0,
    quantidade_adicional,
    quantidade: quantidade_adicional,
    preco_unitario: mp.preco_custo ?? null,
  })

  if (error) throw new Error(error.message)

  await marcarUltimaAlteracaoOC(ordem_compra_id, uid)
}

export async function atualizarObservacaoOC(
  id: string,
  observacao: string,
  usuarioRegistroId?: string | null,
) {
  await assertPermissao('ordens_compra', 'editar')
  const supabase = await createClient()
  const uid = await resolverUsuarioRegistroOC(usuarioRegistroId)
  const { error } = await supabase
    .from('ordens_compra')
    .update({
      observacao: observacao.trim() || null,
      ...camposRegistroAlteracao(uid),
    })
    .eq('id', id)
    .select('id, observacao')
    .single()

  if (error) throw new Error(error.message)
}

export async function mudarStatusOC(
  id: string,
  status: StatusOC,
  usuarioRegistroId?: string | null,
) {
  await assertPermissao('ordens_compra', 'editar')
  const supabase = await createClient()
  const uid = await resolverUsuarioRegistroOC(usuarioRegistroId)

  if (status === 'recebida') {
    const { data: ocCabecalho, error: ocErr } = await supabase
      .from('ordens_compra')
      .select('codigo')
      .eq('id', id)
      .single()

    if (ocErr) throw new Error(ocErr.message)

    const { data: itens, error: itensErr } = await supabase
      .from('ordem_compra_itens')
      .select('materia_prima_id, quantidade')
      .eq('ordem_compra_id', id)

    if (itensErr) throw new Error(itensErr.message)

    const observacaoRecebimento = ocCabecalho?.codigo
      ? `Recebimento — ${ocCabecalho.codigo}`
      : 'Recebimento OC'

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
        observacao: observacaoRecebimento,
        usuario_id: uid,
      })
    }
  }

  const { error } = await supabase
    .from('ordens_compra')
    .update({ status, ...camposRegistroAlteracao(uid) })
    .eq('id', id)

  if (error) throw new Error(error.message)
}

/**
 * Marca se a OC foi paga (estado independente do fluxo pendente → enviada → recebida).
 * Ao marcar pago: cria gasto automático `pagamento_oc` se ainda não existir um vinculado à OC.
 * Ao desmarcar: remove gastos automáticos desse tipo vinculados à OC.
 */
export async function definirPagoOrdemCompra(id: string, pago: boolean) {
  await assertPermissao('ordens_compra', 'editar')
  const supabase = await createClient()
  const user = await getAuthenticatedUser()

  if (pago) {
    const { data: ocCabecalho, error: ocErr } = await supabase
      .from('ordens_compra')
      .select('codigo, fornecedor:fornecedores(nome)')
      .eq('id', id)
      .single()

    if (ocErr) throw new Error(ocErr.message)

    const { data: itens, error: itensErr } = await supabase
      .from('ordem_compra_itens')
      .select('quantidade, preco_unitario')
      .eq('ordem_compra_id', id)

    if (itensErr) throw new Error(itensErr.message)

    const valorTotal = (itens ?? []).reduce(
      (s, it) => s + Number(it.quantidade ?? 0) * Number(it.preco_unitario ?? 0),
      0,
    )

    const fornecedor = Array.isArray(ocCabecalho?.fornecedor)
      ? ocCabecalho?.fornecedor[0]
      : ocCabecalho?.fornecedor
    const fornecedorNome = fornecedor?.nome ?? null
    const codigoOC = ocCabecalho?.codigo ?? ''
    const descricao = fornecedorNome
      ? `Pagamento OC ${codigoOC} — ${fornecedorNome}`
      : `Pagamento OC ${codigoOC}`

    const { data: gastoExistente } = await supabase
      .from('gastos')
      .select('id')
      .eq('ordem_compra_id', id)
      .eq('tipo', 'pagamento_oc')
      .limit(1)
      .maybeSingle()

    if (!gastoExistente) {
      const hoje = new Date().toISOString().slice(0, 10)
      const { error: gastoErr } = await supabase.from('gastos').insert({
        tipo: 'pagamento_oc',
        descricao,
        valor: valorTotal,
        forma_pagamento: 'transferencia',
        data_gasto: hoje,
        ordem_compra_id: id,
        usuario_id: user?.id ?? null,
      })
      if (gastoErr) throw new Error(gastoErr.message)
    }
  } else {
    const { error: delErr } = await supabase
      .from('gastos')
      .delete()
      .eq('ordem_compra_id', id)
      .eq('tipo', 'pagamento_oc')
    if (delErr) throw new Error(delErr.message)
  }

  const { error } = await supabase.from('ordens_compra').update({ pago }).eq('id', id)
  if (error) throw new Error(error.message)
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
}
