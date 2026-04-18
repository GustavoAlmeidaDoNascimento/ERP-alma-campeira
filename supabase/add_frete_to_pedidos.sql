-- Adiciona coluna frete à tabela pedidos.
-- O frete é somado ao valor total da venda mas não entra no cálculo de comissão.
ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS frete numeric(10,2) NOT NULL DEFAULT 0;
