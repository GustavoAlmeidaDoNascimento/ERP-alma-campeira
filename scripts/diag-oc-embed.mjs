// Verifica que a nova query embed de /ordens-compra funciona.
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const t = performance.now()
const { data, error } = await supabase
  .from('ordens_compra')
  .select(`
    *,
    fornecedor:fornecedores!fornecedor_id(id, nome),
    ultima_alteracao_usuario:usuarios_perfis!ultima_alteracao_usuario_id(id, nome),
    itens:ordem_compra_itens(
      id, ordem_compra_id, materia_prima_id,
      quantidade, quantidade_vendida, quantidade_adicional,
      preco_unitario,
      materia_prima:materias_primas(id, codigo, nome)
    ),
    fila:fila_reposicao!fila_reposicao_id(
      id,
      pedido:pedidos(id, codigo, sequencial, cliente:clientes(id, nome))
    )
  `)
  .order('created_at', { ascending: false })

const ms = (performance.now() - t).toFixed(0)
if (error) {
  console.error('ERRO:', error.message, error.details ?? '')
  process.exit(1)
}
console.log(`OK: ${data.length} ordens em ${ms}ms (era ~3500ms em 5 queries)`)
console.log('Amostra (1ª OC):', JSON.stringify(
  {
    codigo: data[0]?.codigo,
    fornecedor: data[0]?.fornecedor,
    ultima_alteracao_usuario: data[0]?.ultima_alteracao_usuario,
    itens_count: data[0]?.itens?.length,
    fila: data[0]?.fila ? { id: data[0].fila.id, pedido: data[0].fila.pedido } : null,
  },
  null,
  2,
))

// Round 2 (warm)
const t2 = performance.now()
await supabase.from('ordens_compra').select(`*, fornecedor:fornecedores!fornecedor_id(id, nome), ultima_alteracao_usuario:usuarios_perfis!ultima_alteracao_usuario_id(id, nome), itens:ordem_compra_itens(id, ordem_compra_id, materia_prima_id, quantidade, quantidade_vendida, quantidade_adicional, preco_unitario, materia_prima:materias_primas(id, codigo, nome)), fila:fila_reposicao!fila_reposicao_id(id, pedido:pedidos(id, codigo, sequencial, cliente:clientes(id, nome)))`).order('created_at', { ascending: false })
console.log(`Round 2 (warm): ${(performance.now() - t2).toFixed(0)}ms`)
