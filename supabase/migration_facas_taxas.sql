-- Adiciona taxas de produção e venda às facas
ALTER TABLE facas
  ADD COLUMN IF NOT EXISTS taxa_producao numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS taxa_venda numeric(10,2) NOT NULL DEFAULT 0;
