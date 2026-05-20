-- Numero sequencial humano para pedidos (#1, #2, ...), além do código aleatório.
-- Útil para identificar rapidamente "em qual pedido estou" sem ler o código forte.

ALTER TABLE pedidos
  ADD COLUMN IF NOT EXISTS sequencial bigint;

-- Backfill em ordem cronológica (created_at) para registros antigos.
WITH ordenados AS (
  SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
  FROM pedidos
  WHERE sequencial IS NULL
)
UPDATE pedidos p
SET sequencial = o.rn
FROM ordenados o
WHERE p.id = o.id;

-- Sequence para novos pedidos, começando após o maior já atribuído.
CREATE SEQUENCE IF NOT EXISTS pedidos_sequencial_seq AS bigint;
SELECT setval(
  'pedidos_sequencial_seq',
  GREATEST(COALESCE((SELECT MAX(sequencial) FROM pedidos), 0), 1),
  true
);

ALTER TABLE pedidos
  ALTER COLUMN sequencial SET DEFAULT nextval('pedidos_sequencial_seq');
ALTER TABLE pedidos
  ALTER COLUMN sequencial SET NOT NULL;
ALTER SEQUENCE pedidos_sequencial_seq OWNED BY pedidos.sequencial;

CREATE UNIQUE INDEX IF NOT EXISTS pedidos_sequencial_key ON pedidos(sequencial);
