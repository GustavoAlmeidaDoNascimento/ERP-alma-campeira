-- Seed simples de BOM para ambientes de teste/demo.
-- Regra: FK-000x consome MP-000x (quantidade 1).
-- Só insere linhas que ainda não existam em faca_materias_primas.

INSERT INTO faca_materias_primas (faca_id, materia_prima_id, quantidade)
SELECT
  f.id AS faca_id,
  mp.id AS materia_prima_id,
  1::numeric(10,3) AS quantidade
FROM facas f
JOIN materias_primas mp
  ON regexp_replace(f.codigo, '[^0-9]', '', 'g') = regexp_replace(mp.codigo, '[^0-9]', '', 'g')
WHERE f.codigo LIKE 'FK-%'
  AND mp.codigo LIKE 'MP-%'
  AND NOT EXISTS (
    SELECT 1
    FROM faca_materias_primas bom
    WHERE bom.faca_id = f.id
      AND bom.materia_prima_id = mp.id
  );

