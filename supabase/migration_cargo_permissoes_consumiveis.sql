-- ============================================================
-- Permissões: módulo consumiveis (lista, CRUD, entrada/baixa = editar)
-- Espelha materias_primas por cargo e, em overrides, por usuário.
-- ============================================================

-- Cargos: cria "consumiveis" quando ausente, copiando MP.
INSERT INTO cargo_permissoes (cargo_id, modulo, ver, criar, editar, deletar)
SELECT
  mp.cargo_id,
  'consumiveis' AS modulo,
  mp.ver,
  mp.criar,
  mp.editar,
  mp.deletar
FROM cargo_permissoes mp
WHERE mp.modulo = 'materias_primas'
ON CONFLICT (cargo_id, modulo) DO NOTHING;

-- Usuários com permissões customizadas: mesma regra quando têm linha de MP.
INSERT INTO usuario_permissoes (usuario_id, modulo, ver, criar, editar, deletar)
SELECT
  mp.usuario_id,
  'consumiveis' AS modulo,
  mp.ver,
  mp.criar,
  mp.editar,
  mp.deletar
FROM usuario_permissoes mp
WHERE mp.modulo = 'materias_primas'
ON CONFLICT (usuario_id, modulo) DO NOTHING;
