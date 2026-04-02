-- Taxas globais para cálculo de lucro (lista de facas) e novos módulos de permissão.
-- Execute no SQL Editor do Supabase após as migrations de cargos.

CREATE TABLE IF NOT EXISTS app_config (
  id                    smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  taxa_producao_lucro   numeric(10,2) NOT NULL DEFAULT 0,
  taxa_comissao_lucro   numeric(10,2) NOT NULL DEFAULT 0,
  updated_at            timestamptz DEFAULT now()
);

INSERT INTO app_config (id, taxa_producao_lucro, taxa_comissao_lucro)
VALUES (1, 0, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados podem ler app_config" ON app_config;
CREATE POLICY "Autenticados podem ler app_config"
  ON app_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Autenticados podem inserir app_config" ON app_config;
CREATE POLICY "Autenticados podem inserir app_config"
  ON app_config FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Autenticados podem atualizar app_config" ON app_config;
CREATE POLICY "Autenticados podem atualizar app_config"
  ON app_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- Permissões iniciais: espelha facas (ver lucro quem vê facas; editar taxas quem edita facas)
INSERT INTO cargo_permissoes (cargo_id, modulo, ver, criar, editar, deletar)
SELECT c.id, 'lucro', cp.ver, false, false, false
FROM cargos c
JOIN cargo_permissoes cp ON cp.cargo_id = c.id AND cp.modulo = 'facas'
ON CONFLICT (cargo_id, modulo) DO UPDATE SET ver = EXCLUDED.ver;

INSERT INTO cargo_permissoes (cargo_id, modulo, ver, criar, editar, deletar)
SELECT c.id, 'taxas_lucro', cp.ver, false, cp.editar, false
FROM cargos c
JOIN cargo_permissoes cp ON cp.cargo_id = c.id AND cp.modulo = 'facas'
ON CONFLICT (cargo_id, modulo) DO UPDATE SET ver = EXCLUDED.ver, editar = EXCLUDED.editar;
