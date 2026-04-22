import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { gerarCodigoForte } from '@/lib/utils/codigo'

type Supabase = Awaited<ReturnType<typeof createClient>>

export async function gerarCodigoOC(_supabase: Supabase): Promise<string> {
  return gerarCodigoForte('OC')
}

/**
 * Gera OCs a partir dos itens selecionados de uma entrada da fila de reposição.
 * Agrupa os itens por fornecedor e cria uma OC por fornecedor.
 * Ao final, marca a fila como 'convertida'.
 */
export async function gerarOCsDeFilaItens(
  supabase: Supabase,
  fila_id: string,
): Promise<string[]> {
  // Busca itens selecionados da fila com dados da MP e fornecedor
  const { data: itens, error: itensErr } = await supabase
    .from('fila_reposicao_itens')
    .select(`
      id,
      materia_prima_id,
      quantidade_sugerida,
      quantidade_adicional,
      selecionado,
      mp:materias_primas(id, preco_custo, fornecedor_id)
    `)
    .eq('fila_id', fila_id)
    .eq('selecionado', true)

  if (itensErr) throw new Error(itensErr.message)
  if (!itens || itens.length === 0) throw new Error('Nenhum item selecionado para gerar OC.')

  // Agrupa por fornecedor_id
  type GrupoFornecedor = {
    fornecedor_id: string | null
    itens: { materia_prima_id: string; quantidade: number; preco_unitario: number }[]
  }

  const grupos = new Map<string, GrupoFornecedor>()

  for (const item of itens) {
    const mp = (Array.isArray(item.mp) ? item.mp[0] : item.mp) as {
      id: string; preco_custo: number; fornecedor_id: string | null
    } | null
    if (!mp) continue

    const chave = mp.fornecedor_id ?? '__sem_fornecedor__'
    if (!grupos.has(chave)) {
      grupos.set(chave, { fornecedor_id: mp.fornecedor_id, itens: [] })
    }

    const grupo = grupos.get(chave)!
    const quantidade = Number(item.quantidade_sugerida) + Number(item.quantidade_adicional)
    if (quantidade <= 0) continue

    grupo.itens.push({
      materia_prima_id: item.materia_prima_id,
      quantidade,
      preco_unitario: Number(mp.preco_custo ?? 0),
    })
  }

  if (grupos.size === 0) throw new Error('Nenhum item com quantidade válida para gerar OC.')

  const codigos: string[] = []

  for (const grupo of grupos.values()) {
    if (grupo.itens.length === 0) continue

    const codigo = await gerarCodigoOC(supabase)

    const { data: oc, error: ocErr } = await supabase
      .from('ordens_compra')
      .insert({
        codigo,
        fornecedor_id: grupo.fornecedor_id ?? null,
        status: 'pendente',
        data_geracao: new Date().toISOString().split('T')[0],
      })
      .select('id')
      .single()

    if (ocErr || !oc) throw new Error(ocErr?.message ?? 'Erro ao criar OC.')

    const ocItens = grupo.itens.map((i) => ({
      ordem_compra_id: oc.id,
      materia_prima_id: i.materia_prima_id,
      quantidade_vendida: i.quantidade,
      quantidade_adicional: 0,
      quantidade: i.quantidade,
      preco_unitario: i.preco_unitario,
    }))

    const { error: itensInsertErr } = await supabase.from('ordem_compra_itens').insert(ocItens)
    if (itensInsertErr) throw new Error(itensInsertErr.message)

    codigos.push(codigo)
  }

  // Marca fila como convertida
  await supabase
    .from('fila_reposicao')
    .update({ status: 'convertida', updated_at: new Date().toISOString() })
    .eq('id', fila_id)

  revalidatePath('/ordens-compra')
  revalidateTag('ordens-compra-historico', 'max')
  revalidateTag('ordens-compra-fila', 'max')

  return codigos
}
