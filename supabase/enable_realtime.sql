-- Habilita Supabase Realtime (postgres_changes via WebSocket) para as tabelas
-- consumidas pelo frontend. Cada ALTER PUBLICATION é idempotente — rodar várias
-- vezes é seguro.
--
-- Executar no SQL Editor do Supabase Dashboard, na database de produção.

-- Estoque & catálogo
alter publication supabase_realtime add table public.materias_primas;
alter publication supabase_realtime add table public.facas;
alter publication supabase_realtime add table public.faca_materias_primas;
alter publication supabase_realtime add table public.movimentacoes_estoque;
alter publication supabase_realtime add table public.consumiveis;

-- Comercial
alter publication supabase_realtime add table public.pedidos;
alter publication supabase_realtime add table public.pedido_itens;
alter publication supabase_realtime add table public.orcamentos;
alter publication supabase_realtime add table public.orcamento_itens;
alter publication supabase_realtime add table public.clientes;

-- Suprimentos
alter publication supabase_realtime add table public.fornecedores;
alter publication supabase_realtime add table public.ordens_compra;
alter publication supabase_realtime add table public.ordem_compra_itens;
alter publication supabase_realtime add table public.fila_reposicao;
alter publication supabase_realtime add table public.fila_reposicao_itens;

-- Financeiro
alter publication supabase_realtime add table public.gastos;
alter publication supabase_realtime add table public.tipos_gasto;
alter publication supabase_realtime add table public.entradas;

-- Pessoas
alter publication supabase_realtime add table public.usuarios_perfis;
alter publication supabase_realtime add table public.cargos;

-- Categorias
alter publication supabase_realtime add table public.categorias_faca;
alter publication supabase_realtime add table public.categorias_materia_prima;
alter publication supabase_realtime add table public.categorias_consumivel;
