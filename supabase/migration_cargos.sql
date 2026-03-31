-- ============================================================
-- Migration: Sistema de Cargos e Permissões
-- Execute no SQL Editor do Supabase após migration_usuarios.sql
-- ============================================================

-- Cargos (roles configuráveis)
CREATE TABLE IF NOT EXISTS cargos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL UNIQUE,
  descricao   text,
  cor         text NOT NULL DEFAULT '#6b7280',
  criado_em   timestamptz DEFAULT now()
);

-- Permissões por módulo para cada cargo
CREATE TABLE IF NOT EXISTS cargo_permissoes (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cargo_id  uuid NOT NULL REFERENCES cargos(id) ON DELETE CASCADE,
  modulo    text NOT NULL,
  ver       boolean NOT NULL DEFAULT false,
  criar     boolean NOT NULL DEFAULT false,
  editar    boolean NOT NULL DEFAULT false,
  deletar   boolean NOT NULL DEFAULT false,
  UNIQUE(cargo_id, modulo)
);

-- Adicionar cargo_id em usuarios_perfis
ALTER TABLE usuarios_perfis
  ADD COLUMN IF NOT EXISTS cargo_id uuid REFERENCES cargos(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE cargos            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cargo_permissoes  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados podem ler cargos" ON cargos;
CREATE POLICY "Autenticados podem ler cargos"
  ON cargos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Autenticados podem inserir cargos" ON cargos;
CREATE POLICY "Autenticados podem inserir cargos"
  ON cargos FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Autenticados podem atualizar cargos" ON cargos;
CREATE POLICY "Autenticados podem atualizar cargos"
  ON cargos FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "Autenticados podem deletar cargos" ON cargos;
CREATE POLICY "Autenticados podem deletar cargos"
  ON cargos FOR DELETE TO authenticated USING (true);

DROP POLICY IF EXISTS "Autenticados podem ler cargo_permissoes" ON cargo_permissoes;
CREATE POLICY "Autenticados podem ler cargo_permissoes"
  ON cargo_permissoes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Autenticados podem inserir cargo_permissoes" ON cargo_permissoes;
CREATE POLICY "Autenticados podem inserir cargo_permissoes"
  ON cargo_permissoes FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Autenticados podem atualizar cargo_permissoes" ON cargo_permissoes;
CREATE POLICY "Autenticados podem atualizar cargo_permissoes"
  ON cargo_permissoes FOR UPDATE TO authenticated USING (true);
DROP POLICY IF EXISTS "Autenticados podem deletar cargo_permissoes" ON cargo_permissoes;
CREATE POLICY "Autenticados podem deletar cargo_permissoes"
  ON cargo_permissoes FOR DELETE TO authenticated USING (true);

-- ============================================================
-- Seed: 4 cargos padrão com permissões
-- ============================================================

-- Administrador: acesso total
WITH c AS (
  INSERT INTO cargos (nome, descricao, cor)
  VALUES ('Administrador', 'Acesso total ao sistema', '#7c3aed')
  ON CONFLICT (nome) DO UPDATE SET descricao = EXCLUDED.descricao
  RETURNING id
)
INSERT INTO cargo_permissoes (cargo_id, modulo, ver, criar, editar, deletar)
SELECT c.id, m.modulo, true, true, true, true
FROM c,
  (VALUES
    ('dashboard'),('metricas'),('materias_primas'),('fornecedores'),('facas'),('consumiveis'),
    ('estoque'),('vendas'),('clientes'),('ordens_compra'),('usuarios'),('cargos')
  ) AS m(modulo)
ON CONFLICT (cargo_id, modulo) DO NOTHING;

-- Gerente: tudo exceto usuários e cargos
WITH c AS (
  INSERT INTO cargos (nome, descricao, cor)
  VALUES ('Gerente', 'Acesso a todos os módulos operacionais', '#b45309')
  ON CONFLICT (nome) DO UPDATE SET descricao = EXCLUDED.descricao
  RETURNING id
)
INSERT INTO cargo_permissoes (cargo_id, modulo, ver, criar, editar, deletar)
SELECT c.id, m.modulo, m.ver, m.criar, m.editar, m.deletar
FROM c,
  (VALUES
    ('dashboard',       true,  false, false, false),
    ('metricas',        true,  false, false, false),
    ('materias_primas', true,  true,  true,  true),
    ('fornecedores',    true,  true,  true,  true),
    ('facas',           true,  true,  true,  true),
    ('consumiveis',     true,  true,  true,  true),
    ('estoque',         true,  true,  true,  false),
    ('vendas',          true,  true,  true,  false),
    ('clientes',        true,  true,  true,  true),
    ('ordens_compra',   true,  true,  true,  false),
    ('usuarios',        false, false, false, false),
    ('cargos',          false, false, false, false)
  ) AS m(modulo, ver, criar, editar, deletar)
ON CONFLICT (cargo_id, modulo) DO NOTHING;

-- Produção: estoque e produção
WITH c AS (
  INSERT INTO cargos (nome, descricao, cor)
  VALUES ('Produção', 'Acesso ao estoque, matérias-primas e registro de produção', '#0369a1')
  ON CONFLICT (nome) DO UPDATE SET descricao = EXCLUDED.descricao
  RETURNING id
)
INSERT INTO cargo_permissoes (cargo_id, modulo, ver, criar, editar, deletar)
SELECT c.id, m.modulo, m.ver, m.criar, m.editar, m.deletar
FROM c,
  (VALUES
    ('dashboard',       true,  false, false, false),
    ('metricas',        true,  false, false, false),
    ('materias_primas', true,  false, false, false),
    ('fornecedores',    false, false, false, false),
    ('facas',           true,  false, false, false),
    ('consumiveis',     true,  false, false, false),
    ('estoque',         true,  true,  true,  false),
    ('vendas',          false, false, false, false),
    ('clientes',        false, false, false, false),
    ('ordens_compra',   false, false, false, false),
    ('usuarios',        false, false, false, false),
    ('cargos',          false, false, false, false)
  ) AS m(modulo, ver, criar, editar, deletar)
ON CONFLICT (cargo_id, modulo) DO NOTHING;

-- Vendas: pedidos e clientes
WITH c AS (
  INSERT INTO cargos (nome, descricao, cor)
  VALUES ('Vendas', 'Acesso a pedidos, clientes e catálogo de facas', '#15803d')
  ON CONFLICT (nome) DO UPDATE SET descricao = EXCLUDED.descricao
  RETURNING id
)
INSERT INTO cargo_permissoes (cargo_id, modulo, ver, criar, editar, deletar)
SELECT c.id, m.modulo, m.ver, m.criar, m.editar, m.deletar
FROM c,
  (VALUES
    ('dashboard',       true,  false, false, false),
    ('metricas',        true,  false, false, false),
    ('materias_primas', false, false, false, false),
    ('fornecedores',    false, false, false, false),
    ('facas',           true,  false, false, false),
    ('consumiveis',     false, false, false, false),
    ('estoque',         false, false, false, false),
    ('vendas',          true,  true,  true,  false),
    ('clientes',        true,  true,  true,  false),
    ('ordens_compra',   false, false, false, false),
    ('usuarios',        false, false, false, false),
    ('cargos',          false, false, false, false)
  ) AS m(modulo, ver, criar, editar, deletar)
ON CONFLICT (cargo_id, modulo) DO NOTHING;
