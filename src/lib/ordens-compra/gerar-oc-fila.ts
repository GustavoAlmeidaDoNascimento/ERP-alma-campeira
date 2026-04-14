import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { gerarCodigoForte } from '@/lib/utils/codigo'

type Supabase = Awaited<ReturnType<typeof createClient>>

export async function gerarCodigoOC(_supabase: Supabase): Promise<string> {
  return gerarCodigoForte('OC')
}

/**
 * Gera uma OC a partir da fila de reposição (sem checar permissão).
 * Usado pelo fluxo manual (após assert) e pelo fluxo automático pós-entrega de venda.
 */
export async function gerarOCDesdeFilaSupabase(
  supabase: Supabase,
  fornecedor_id: string | null,
  adicionaisPorMateriaPrima: Record<string, number> = {},
): Promise<string> {
  const query = supabase
    .from('fila_reposicao')
    .select('id, materia_prima_id, quantidade_pendente, mp:materias_primas(preco_custo)')

  const { data: filaRows, error: filaErr } =
    fornecedor_id === null
      ? await query.is('fornecedor_id', null)
      : await query.eq('fornecedor_id', fornecedor_id)

  if (filaErr) throw new Error(filaErr.message)
  if (!filaRows || filaRows.length === 0) throw new Error('Nenhum item na fila para este fornecedor.')

  const ocExistenteQuery = supabase
    .from('ordens_compra')
    .select('codigo')
    .eq('status', 'pendente')

  const { data: ocExistente } = fornecedor_id === null
    ? await ocExistenteQuery.is('fornecedor_id', null)
    : await ocExistenteQuery.eq('fornecedor_id', fornecedor_id)

  if (ocExistente && ocExistente.length > 0) {
    const codigos = ocExistente.map((o) => o.codigo).join(', ')
    throw new Error(`Já existe uma OC pendente para este fornecedor (${codigos}). Conclua ou cancele antes de gerar uma nova.`)
  }

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

  const itens = Array.from(agrupado.entries()).map(([mp_id, { quantidade, preco_custo }]) => {
    const adicionalBruto = adicionaisPorMateriaPrima[mp_id] ?? 0
    const quantidade_adicional = Number.isFinite(adicionalBruto) ? Math.max(0, adicionalBruto) : 0
    const quantidade_total = quantidade + quantidade_adicional

    return {
      ordem_compra_id: oc.id,
      materia_prima_id: mp_id,
      quantidade_vendida: quantidade,
      quantidade_adicional,
      quantidade: quantidade_total,
      preco_unitario: preco_custo,
    }
  })

  const { error: itensErr } = await supabase.from('ordem_compra_itens').insert(itens)
  if (itensErr) throw new Error(itensErr.message)

  const delRes =
    fornecedor_id === null
      ? await supabase.from('fila_reposicao').delete().is('fornecedor_id', null)
      : await supabase.from('fila_reposicao').delete().eq('fornecedor_id', fornecedor_id)
  if (delRes.error) throw new Error(delRes.error.message)

  revalidatePath('/ordens-compra')
  revalidateTag('ordens-compra-historico', 'max')
  revalidateTag('ordens-compra-fila', 'max')
  return codigo
}

export type OpcoesGerarTodasDesdeFila = {
  /**
   * Se true (padrão após marcar entrega), tenta todos os fornecedores e ignora falhas por fornecedor.
   * Se false (ação manual "Gerar todas"), a primeira falha propaga o erro.
   */
  continuarEmErro?: boolean
}

/**
 * Para cada fornecedor na fila, gera uma OC. Não verifica permissão (uso após marcar entrega).
 * Com `continuarEmErro` (padrão true), falhas por fornecedor não impedem os demais.
 */
export async function executarGerarTodasOCsDesdeFilaAutomatico(
  opcoes: OpcoesGerarTodasDesdeFila = {},
): Promise<number> {
  const { continuarEmErro = true } = opcoes
  const supabase = await createClient()

  const { data, error } = await supabase.from('fila_reposicao').select('fornecedor_id')

  if (error) throw new Error(error.message)
  if (!data || data.length === 0) throw new Error('Fila de reposição está vazia.')

  const fornecedorIds = [...new Set(data.map((r) => r.fornecedor_id))]
  let criadas = 0

  for (const fid of fornecedorIds) {
    if (continuarEmErro) {
      try {
        await gerarOCDesdeFilaSupabase(supabase, fid, {})
        criadas++
      } catch {
        // Ex.: já existe OC pendente para o fornecedor; segue para os demais.
      }
    } else {
      await gerarOCDesdeFilaSupabase(supabase, fid, {})
      criadas++
    }
  }

  revalidatePath('/ordens-compra')
  revalidateTag('ordens-compra-historico', 'max')
  revalidateTag('ordens-compra-fila', 'max')
  return criadas
}
