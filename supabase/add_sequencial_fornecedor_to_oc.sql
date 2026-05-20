-- Número sequencial por fornecedor para OCs (#1, #2, #3 do fornecedor X).
-- Útil quando o usuário fala "essa é a terceira OC sua, fornecedor".

ALTER TABLE ordens_compra
  ADD COLUMN IF NOT EXISTS sequencial_fornecedor int;

-- Backfill: por fornecedor, ordenado cronologicamente.
WITH ordenados AS (
  SELECT id,
         row_number() OVER (PARTITION BY fornecedor_id ORDER BY created_at, id) AS rn
  FROM ordens_compra
  WHERE sequencial_fornecedor IS NULL
)
UPDATE ordens_compra oc
SET sequencial_fornecedor = o.rn
FROM ordenados o
WHERE oc.id = o.id;

-- Trigger BEFORE INSERT: atribui próximo número dentro do fornecedor.
-- IS NOT DISTINCT FROM trata null = null (fornecedor manual sem fornecedor agrupa junto).
CREATE OR REPLACE FUNCTION set_oc_sequencial_fornecedor()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.sequencial_fornecedor IS NULL THEN
    SELECT COALESCE(MAX(sequencial_fornecedor), 0) + 1
      INTO NEW.sequencial_fornecedor
      FROM ordens_compra
      WHERE fornecedor_id IS NOT DISTINCT FROM NEW.fornecedor_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_oc_sequencial_fornecedor ON ordens_compra;
CREATE TRIGGER trg_oc_sequencial_fornecedor
  BEFORE INSERT ON ordens_compra
  FOR EACH ROW
  EXECUTE FUNCTION set_oc_sequencial_fornecedor();

-- Unique por (fornecedor_id, sequencial) — força detecção de race conditions
-- em vez de duplicar silenciosamente.
CREATE UNIQUE INDEX IF NOT EXISTS ordens_compra_seq_fornecedor_key
  ON ordens_compra(fornecedor_id, sequencial_fornecedor);
