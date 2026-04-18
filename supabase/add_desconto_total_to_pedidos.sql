-- Desconto aplicado sobre o total (itens + frete), em valor monetário.
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS desconto_total numeric(10,2) NOT NULL DEFAULT 0;
