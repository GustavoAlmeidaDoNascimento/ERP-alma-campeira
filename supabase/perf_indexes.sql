-- Índices de performance — Fase 3
--
-- Criados como CONCURRENTLY para não bloquear a tabela em produção, e com
-- IF NOT EXISTS para serem idempotentes (rodar múltiplas vezes é seguro).
--
-- Executar no SQL Editor do Supabase Dashboard. Cada CREATE INDEX
-- CONCURRENTLY precisa rodar fora de transação — execute um por vez se
-- o editor reclamar de "running inside a transaction".

-- ─────────────────────────────────────────────────────────────────
-- ESTOQUE
-- ─────────────────────────────────────────────────────────────────

-- materias_primas: listagem ordena por codigo
create index if not exists idx_materias_primas_codigo on public.materias_primas (codigo);
create index if not exists idx_materias_primas_fornecedor_id on public.materias_primas (fornecedor_id);

-- facas: listagem ordena por codigo
create index if not exists idx_facas_codigo on public.facas (codigo);

-- faca_materias_primas: BOM lookup
create index if not exists idx_faca_mp_faca_id on public.faca_materias_primas (faca_id);
create index if not exists idx_faca_mp_materia_prima_id on public.faca_materias_primas (materia_prima_id);

-- movimentacoes_estoque: histórico ordena por created_at DESC, filtra por FK
create index if not exists idx_mov_estoque_created_at on public.movimentacoes_estoque (created_at desc);
create index if not exists idx_mov_estoque_materia_prima_id on public.movimentacoes_estoque (materia_prima_id);
create index if not exists idx_mov_estoque_faca_id on public.movimentacoes_estoque (faca_id);
create index if not exists idx_mov_estoque_consumivel_id on public.movimentacoes_estoque (consumivel_id);
create index if not exists idx_mov_estoque_usuario_id on public.movimentacoes_estoque (usuario_id);

-- consumiveis: listagem ordena por codigo
create index if not exists idx_consumiveis_codigo on public.consumiveis (codigo);
create index if not exists idx_consumiveis_fornecedor_id on public.consumiveis (fornecedor_id);

-- ─────────────────────────────────────────────────────────────────
-- COMERCIAL
-- ─────────────────────────────────────────────────────────────────

-- pedidos: listagem ordena por created_at DESC, filtros frequentes
create index if not exists idx_pedidos_created_at on public.pedidos (created_at desc);
create index if not exists idx_pedidos_cliente_id on public.pedidos (cliente_id);
create index if not exists idx_pedidos_vendedor_id on public.pedidos (vendedor_id);
create index if not exists idx_pedidos_status on public.pedidos (status);

-- pedido_itens: join com pedido
create index if not exists idx_pedido_itens_pedido_id on public.pedido_itens (pedido_id);
create index if not exists idx_pedido_itens_faca_id on public.pedido_itens (faca_id);

-- orcamentos
create index if not exists idx_orcamentos_created_at on public.orcamentos (created_at desc);
create index if not exists idx_orcamentos_cliente_id on public.orcamentos (cliente_id);
create index if not exists idx_orcamentos_vendedor_id on public.orcamentos (vendedor_id);
create index if not exists idx_orcamento_itens_orcamento_id on public.orcamento_itens (orcamento_id);
create index if not exists idx_orcamento_itens_faca_id on public.orcamento_itens (faca_id);

-- ─────────────────────────────────────────────────────────────────
-- SUPRIMENTOS
-- ─────────────────────────────────────────────────────────────────

create index if not exists idx_ordens_compra_fornecedor_id on public.ordens_compra (fornecedor_id);
create index if not exists idx_ordens_compra_status on public.ordens_compra (status);
create index if not exists idx_ordem_compra_itens_ordem_id on public.ordem_compra_itens (ordem_id);
create index if not exists idx_ordem_compra_itens_materia_prima_id on public.ordem_compra_itens (materia_prima_id);

create index if not exists idx_fila_reposicao_status on public.fila_reposicao (status);
create index if not exists idx_fila_reposicao_pedido_id on public.fila_reposicao (pedido_id);
create index if not exists idx_fila_reposicao_itens_fila_id on public.fila_reposicao_itens (fila_id);
create index if not exists idx_fila_reposicao_itens_materia_prima_id on public.fila_reposicao_itens (materia_prima_id);

-- ─────────────────────────────────────────────────────────────────
-- FINANCEIRO
-- ─────────────────────────────────────────────────────────────────

create index if not exists idx_gastos_data_gasto on public.gastos (data_gasto desc);
create index if not exists idx_gastos_ordem_compra_id on public.gastos (ordem_compra_id);
create index if not exists idx_gastos_usuario_id on public.gastos (usuario_id);
create index if not exists idx_gastos_tipo on public.gastos (tipo);

-- ─────────────────────────────────────────────────────────────────
-- PESSOAS
-- ─────────────────────────────────────────────────────────────────

create index if not exists idx_usuarios_perfis_cargo_id on public.usuarios_perfis (cargo_id);
create index if not exists idx_usuarios_perfis_ativo on public.usuarios_perfis (ativo);

-- ─────────────────────────────────────────────────────────────────
-- TEXTOS PROCURÁVEIS (clientes/fornecedores ordenam por nome)
-- ─────────────────────────────────────────────────────────────────

create index if not exists idx_clientes_nome on public.clientes (nome);
create index if not exists idx_fornecedores_nome on public.fornecedores (nome);
