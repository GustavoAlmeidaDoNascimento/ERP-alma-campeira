-- ============================================================
-- Migration: adiciona módulo "metricas" nas permissões
-- ============================================================

-- 1) Cargos existentes: cria a permissão "metricas" quando ausente.
--    Regra de bootstrap: ver=true se já podia ver vendas, estoque ou facas.
INSERT INTO cargo_permissoes (cargo_id, modulo, ver, criar, editar, deletar)
SELECT
  c.id AS cargo_id,
  'metricas' AS modulo,
  (COALESCE(v.ver, false) OR COALESCE(e.ver, false) OR COALESCE(f.ver, false)) AS ver,
  false AS criar,
  false AS editar,
  false AS deletar
FROM cargos c
LEFT JOIN cargo_permissoes v ON v.cargo_id = c.id AND v.modulo = 'vendas'
LEFT JOIN cargo_permissoes e ON e.cargo_id = c.id AND e.modulo = 'estoque'
LEFT JOIN cargo_permissoes f ON f.cargo_id = c.id AND f.modulo = 'facas'
ON CONFLICT (cargo_id, modulo) DO NOTHING;

-- 2) Usuários com permissões customizadas: cria "metricas" quando ausente.
--    Mantém o comportamento semelhante ao de cima para não cortar acesso atual.
INSERT INTO usuario_permissoes (usuario_id, modulo, ver, criar, editar, deletar)
SELECT
  u.usuario_id,
  'metricas' AS modulo,
  (COALESCE(v.ver, false) OR COALESCE(e.ver, false) OR COALESCE(f.ver, false)) AS ver,
  false AS criar,
  false AS editar,
  false AS deletar
FROM (SELECT DISTINCT usuario_id FROM usuario_permissoes) u
LEFT JOIN usuario_permissoes v ON v.usuario_id = u.usuario_id AND v.modulo = 'vendas'
LEFT JOIN usuario_permissoes e ON e.usuario_id = u.usuario_id AND e.modulo = 'estoque'
LEFT JOIN usuario_permissoes f ON f.usuario_id = u.usuario_id AND f.modulo = 'facas'
ON CONFLICT (usuario_id, modulo) DO NOTHING;
