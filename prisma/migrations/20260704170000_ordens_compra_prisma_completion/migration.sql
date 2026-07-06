-- Prisma-only completion for ordens_compra + ordem_compra_itens.
-- Porta a modelagem usada historicamente no módulo de OC para o fluxo local via Prisma.

ALTER TABLE "ordens_compra"
  ADD COLUMN IF NOT EXISTS "sequencial_fornecedor" INTEGER,
  ADD COLUMN IF NOT EXISTS "ultima_alteracao_usuario_id" UUID,
  ADD COLUMN IF NOT EXISTS "ultima_alteracao_em" TIMESTAMPTZ(6),
  ADD COLUMN IF NOT EXISTS "forma_pagamento" TEXT,
  ADD COLUMN IF NOT EXISTS "fila_reposicao_id" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ordens_compra_ultima_alteracao_usuario_id_fkey'
  ) THEN
    ALTER TABLE "ordens_compra"
      ADD CONSTRAINT "ordens_compra_ultima_alteracao_usuario_id_fkey"
      FOREIGN KEY ("ultima_alteracao_usuario_id")
      REFERENCES "usuarios_perfis"("id")
      ON DELETE SET NULL
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_ordens_compra_fornecedor" ON "ordens_compra"("fornecedor_id");
CREATE INDEX IF NOT EXISTS "idx_ordens_compra_fila" ON "ordens_compra"("fila_reposicao_id");
CREATE INDEX IF NOT EXISTS "idx_ordens_compra_ultima_alteracao_usuario" ON "ordens_compra"("ultima_alteracao_usuario_id");
CREATE UNIQUE INDEX IF NOT EXISTS "ordens_compra_seq_fornecedor_key"
  ON "ordens_compra"("fornecedor_id", "sequencial_fornecedor");

CREATE TABLE IF NOT EXISTS "ordem_compra_itens" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "ordem_compra_id" UUID NOT NULL,
  "materia_prima_id" UUID NOT NULL,
  "quantidade" DECIMAL(14,4) NOT NULL,
  "quantidade_vendida" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "quantidade_adicional" DECIMAL(14,4) NOT NULL DEFAULT 0,
  "preco_unitario" DECIMAL(14,2),

  CONSTRAINT "ordem_compra_itens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ordem_compra_itens_quantidade_check" CHECK ("quantidade" > 0),
  CONSTRAINT "ordem_compra_itens_quantidade_vendida_check" CHECK ("quantidade_vendida" >= 0),
  CONSTRAINT "ordem_compra_itens_quantidade_adicional_check" CHECK ("quantidade_adicional" >= 0),
  CONSTRAINT "ordem_compra_itens_ordem_compra_id_fkey"
    FOREIGN KEY ("ordem_compra_id") REFERENCES "ordens_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ordem_compra_itens_materia_prima_id_fkey"
    FOREIGN KEY ("materia_prima_id") REFERENCES "materias_primas"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_ordem_compra_itens_oc" ON "ordem_compra_itens"("ordem_compra_id");
CREATE INDEX IF NOT EXISTS "idx_ordem_compra_itens_materia_prima_id" ON "ordem_compra_itens"("materia_prima_id");
