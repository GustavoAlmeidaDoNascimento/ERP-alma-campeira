-- Liga cada ordem de compra à entrada da fila de reposição que a originou.
-- Nullable: OCs manuais (criadas via "Nova OC" no UI) não têm fila/pedido de origem.
-- ON DELETE SET NULL: se a fila for removida, a OC persiste sem o vínculo.
ALTER TABLE ordens_compra
  ADD COLUMN IF NOT EXISTS fila_reposicao_id UUID
  REFERENCES fila_reposicao(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ordens_compra_fila ON ordens_compra(fila_reposicao_id);
