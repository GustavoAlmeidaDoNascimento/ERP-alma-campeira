-- ============================================================
-- Pedidos: campo `pago` (boolean) independente do status operacional.
-- ------------------------------------------------------------
-- Vendas no boleto NÃO usam esse campo (o recebimento é controlado
-- pelas parcelas pagas do boleto). Para as demais formas de pagamento,
-- a venda só entra em "movimentações" depois de marcada como paga.
--
-- Backfill: vendas que já não estavam em `em_espera` antes desta
-- migração já apareciam em movimentações — preservamos esse
-- comportamento marcando-as como pagas.
--
-- Idempotente.
-- ============================================================

alter table public.pedidos add column if not exists pago boolean not null default false;

update public.pedidos
set pago = true
where coalesce(pago, false) = false
  and status in ('em_producao', 'entregue')
  and coalesce(forma_pagamento, '') <> 'boleto';
