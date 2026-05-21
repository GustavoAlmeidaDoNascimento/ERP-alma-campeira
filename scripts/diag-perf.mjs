// Diagnóstico: mede latência das queries que /ordens-compra dispara, sem passar pela camada Next.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(url, key, { auth: { persistSession: false } })

async function time(label, fn) {
  const t = performance.now()
  try {
    const r = await fn()
    const ms = (performance.now() - t).toFixed(0)
    const n = Array.isArray(r?.data) ? r.data.length : (r?.data ? 1 : 0)
    console.log(`${ms.padStart(6)}ms  ${label}  (rows=${n}${r?.error ? `  ERR=${r.error.message}` : ''})`)
    return r
  } catch (e) {
    const ms = (performance.now() - t).toFixed(0)
    console.log(`${ms.padStart(6)}ms  ${label}  THROW ${e.message}`)
  }
}

console.log('Round 1 — frio')
const tFull = performance.now()

const ocRes = await time('ordens_compra +fornecedor (all)', () =>
  supabase.from('ordens_compra').select(`*, fornecedor:fornecedores!fornecedor_id(id, nome)`).order('created_at', { ascending: false })
)

const ocIds = (ocRes?.data ?? []).map((r) => r.id)
const filaIds = [...new Set((ocRes?.data ?? []).map((r) => r.fila_reposicao_id).filter(Boolean))]

await Promise.all([
  time(`ordem_compra_itens IN(${ocIds.length})`, () =>
    supabase.from('ordem_compra_itens')
      .select(`id, ordem_compra_id, materia_prima_id, quantidade, quantidade_vendida, quantidade_adicional, preco_unitario, materia_prima:materias_primas(id, codigo, nome)`)
      .in('ordem_compra_id', ocIds.length ? ocIds : ['00000000-0000-0000-0000-000000000000'])
  ),
  time(`fila_reposicao IN(${filaIds.length})`, () =>
    supabase.from('fila_reposicao')
      .select(`id, pedido:pedidos(id, codigo, sequencial, cliente:clientes(id, nome))`)
      .in('id', filaIds.length ? filaIds : ['00000000-0000-0000-0000-000000000000'])
  ),
])

await time('usuarios_perfis (registroOC)', () =>
  supabase.from('usuarios_perfis').select('id, nome').eq('ativo', true).order('nome')
)

await time('fila_reposicao list (status=pendente)', () =>
  supabase.from('fila_reposicao').select(`id, pedido_id, status, created_at, pedido:pedidos(id, codigo, sequencial, cliente:clientes(id, nome)), itens:fila_reposicao_itens(id)`).in('status', ['pendente']).order('created_at', { ascending: false })
)

console.log(`TOTAL Round1: ${(performance.now() - tFull).toFixed(0)}ms\n`)

console.log('Round 2 — quente')
const t2 = performance.now()
await time('ordens_compra +fornecedor (all)', () =>
  supabase.from('ordens_compra').select(`*, fornecedor:fornecedores!fornecedor_id(id, nome)`).order('created_at', { ascending: false })
)
await time('materias_primas (lista)', () =>
  supabase.from('materias_primas').select('*, fornecedor:fornecedores(id, nome)').order('codigo').limit(120)
)
console.log(`TOTAL Round2: ${(performance.now() - t2).toFixed(0)}ms`)

// Ping puro
console.log('\nPing puro (3x)')
for (let i = 0; i < 3; i++) {
  await time('ordens_compra count head', () =>
    supabase.from('ordens_compra').select('id', { count: 'exact', head: true })
  )
}
