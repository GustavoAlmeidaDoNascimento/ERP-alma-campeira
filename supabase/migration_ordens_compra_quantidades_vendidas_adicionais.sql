-- =============================================================
-- Ordens de Compra: quantidades vendidas + unidades adicionais
-- =============================================================

alter table ordem_compra_itens
  add column if not exists quantidade_vendida numeric(10,3) not null default 0,
  add column if not exists quantidade_adicional numeric(10,3) not null default 0;

-- (Re)marca dados antigos: antes disso, `quantidade` era o total pedido.
-- Para manter histórico compatível, assumimos que todo total anterior era "vendido"
-- e que novas "unidades adicionais" começam zeradas.
update ordem_compra_itens
set
  quantidade_vendida = quantidade,
  quantidade_adicional = 0
where
  quantidade_vendida = 0
  and quantidade_adicional = 0;

-- Observação: validação de não-negatividade também é feita na aplicação.

