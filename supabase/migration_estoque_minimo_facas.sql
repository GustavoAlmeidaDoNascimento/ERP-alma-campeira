-- Adiciona estoque_minimo à tabela facas
ALTER TABLE facas
  ADD COLUMN IF NOT EXISTS estoque_minimo integer NOT NULL DEFAULT 0;
