-- Movimentações de estoque: vínculo com consumíveis (entrada / baixa)

ALTER TABLE movimentacoes_estoque
  ADD COLUMN IF NOT EXISTS consumivel_id uuid REFERENCES consumiveis(id) ON DELETE SET NULL;

COMMENT ON COLUMN movimentacoes_estoque.consumivel_id IS 'Consumível afetado (entrada ou saida_consumivel)';
