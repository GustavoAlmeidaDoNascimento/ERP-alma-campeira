-- Permite excluir uma venda mesmo quando já existem movimentações de estoque
-- ligadas a ela. O histórico fica preservado, apenas com pedido_id = NULL.
-- A trilha (tipo, faca_id, quantidade, observacao) continua suficiente para
-- auditoria — a observacao da reversão já cita o código da venda.

alter table public.movimentacoes_estoque
  drop constraint if exists movimentacoes_estoque_pedido_id_fkey;

alter table public.movimentacoes_estoque
  add constraint movimentacoes_estoque_pedido_id_fkey
  foreign key (pedido_id) references public.pedidos(id) on delete set null;
