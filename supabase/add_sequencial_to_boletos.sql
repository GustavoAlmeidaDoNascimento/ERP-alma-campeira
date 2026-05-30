-- Numero sequencial humano por TIPO de boleto, para exibir um codigo amigavel:
--   saida   -> "BS-1", "BS-2", ...  (Boleto de Saida)
--   entrada -> "BE-1", "BE-2", ...  (Boleto de Entrada)
--
-- Cada tipo tem sua propria contagem (sequence independente). O codigo textual
-- ("BS-x"/"BE-x") e montado na aplicacao a partir de (tipo, sequencial).
-- Idempotente.

ALTER TABLE public.boletos
  ADD COLUMN IF NOT EXISTS sequencial bigint;

-- Sequences independentes por tipo.
CREATE SEQUENCE IF NOT EXISTS boletos_saida_seq   AS bigint;
CREATE SEQUENCE IF NOT EXISTS boletos_entrada_seq AS bigint;

-- Backfill em ordem cronologica (created_at), separado por tipo.
WITH ordenados AS (
  SELECT
    id,
    row_number() OVER (PARTITION BY tipo ORDER BY created_at, id) AS rn
  FROM public.boletos
  WHERE sequencial IS NULL
)
UPDATE public.boletos b
SET sequencial = o.rn
FROM ordenados o
WHERE b.id = o.id;

-- Avanca cada sequence para depois do maior valor ja atribuido naquele tipo.
SELECT setval(
  'boletos_saida_seq',
  GREATEST(COALESCE((SELECT MAX(sequencial) FROM public.boletos WHERE tipo = 'saida'), 0), 1),
  COALESCE((SELECT MAX(sequencial) FROM public.boletos WHERE tipo = 'saida'), 0) > 0
);
SELECT setval(
  'boletos_entrada_seq',
  GREATEST(COALESCE((SELECT MAX(sequencial) FROM public.boletos WHERE tipo = 'entrada'), 0), 1),
  COALESCE((SELECT MAX(sequencial) FROM public.boletos WHERE tipo = 'entrada'), 0) > 0
);

-- Trigger BEFORE INSERT: atribui o sequencial a partir da sequence do tipo.
-- (Nao da pra usar DEFAULT porque a sequence depende da coluna `tipo`.)
CREATE OR REPLACE FUNCTION public._boletos_set_sequencial()
RETURNS trigger AS $$
BEGIN
  IF NEW.sequencial IS NULL THEN
    IF NEW.tipo = 'saida' THEN
      NEW.sequencial := nextval('boletos_saida_seq');
    ELSIF NEW.tipo = 'entrada' THEN
      NEW.sequencial := nextval('boletos_entrada_seq');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_boletos_set_sequencial ON public.boletos;
CREATE TRIGGER trg_boletos_set_sequencial
  BEFORE INSERT ON public.boletos
  FOR EACH ROW EXECUTE FUNCTION public._boletos_set_sequencial();

-- Unicidade por (tipo, sequencial): cada tipo numera de 1 em diante.
CREATE UNIQUE INDEX IF NOT EXISTS boletos_tipo_sequencial_key
  ON public.boletos (tipo, sequencial);
