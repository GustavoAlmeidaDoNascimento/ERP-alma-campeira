-- Permite quantidade_adicional negativa na fila de reposição (comprar menos que o sugerido).
-- Total a comprar = quantidade_sugerida + quantidade_adicional, deve permanecer >= 0.

ALTER TABLE fila_reposicao_itens
  DROP CONSTRAINT IF EXISTS fila_reposicao_itens_quantidade_adicional_check;

ALTER TABLE fila_reposicao_itens
  ADD CONSTRAINT fila_reposicao_itens_quantidade_adicional_check
  CHECK (quantidade_adicional >= -quantidade_sugerida);
