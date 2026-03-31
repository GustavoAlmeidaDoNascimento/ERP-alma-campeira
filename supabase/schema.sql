-- ============================================================
-- ERP Alma Campeira — Schema Fase 1
-- Execute no SQL Editor do Supabase Dashboard
-- ============================================================

-- Fornecedores
CREATE TABLE IF NOT EXISTS fornecedores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  telefone    text,
  email       text,
  created_at  timestamptz DEFAULT now()
);

-- Matérias-Primas
CREATE TABLE IF NOT EXISTS materias_primas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo           text UNIQUE NOT NULL,
  nome             text NOT NULL,
  categoria        text NOT NULL DEFAULT 'Bainha',
  fornecedor_id    uuid REFERENCES fornecedores(id) ON DELETE SET NULL,
  foto_url         text,
  preco_custo      numeric(10,2) NOT NULL DEFAULT 0,
  estoque_atual    numeric(10,3) NOT NULL DEFAULT 0,
  estoque_minimo   numeric(10,3) NOT NULL DEFAULT 0,
  created_at       timestamptz DEFAULT now()
);

-- Categorias de Matérias-Primas
CREATE TABLE IF NOT EXISTS categorias_materia_prima (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text UNIQUE NOT NULL,
  ordem       integer NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

-- Facas
CREATE TABLE IF NOT EXISTS facas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo         text UNIQUE NOT NULL,
  nome           text NOT NULL,
  categoria      text NOT NULL,
  foto_url       text,
  taxa_producao  numeric(10,2) NOT NULL DEFAULT 0,
  taxa_venda     numeric(10,2) NOT NULL DEFAULT 0,
  preco_venda    numeric(10,2) NOT NULL DEFAULT 0,
  estoque_atual  integer NOT NULL DEFAULT 0,
  estoque_minimo integer NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

-- BOM — Bill of Materials (faca → matérias-primas)
CREATE TABLE IF NOT EXISTS faca_materias_primas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faca_id           uuid REFERENCES facas(id) ON DELETE CASCADE,
  materia_prima_id  uuid REFERENCES materias_primas(id) ON DELETE RESTRICT,
  quantidade        numeric(10,3) NOT NULL
);

-- ============================================================
-- RLS — Row Level Security
-- ============================================================

ALTER TABLE fornecedores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE materias_primas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_materia_prima ENABLE ROW LEVEL SECURITY;
ALTER TABLE facas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE faca_materias_primas ENABLE ROW LEVEL SECURITY;

-- Política: usuários autenticados têm acesso total (fase 1, sem perfis ainda)
CREATE POLICY "Autenticados podem ler fornecedores"
  ON fornecedores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir fornecedores"
  ON fornecedores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados podem atualizar fornecedores"
  ON fornecedores FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Autenticados podem deletar fornecedores"
  ON fornecedores FOR DELETE TO authenticated USING (true);

CREATE POLICY "Autenticados podem ler materias_primas"
  ON materias_primas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir materias_primas"
  ON materias_primas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados podem atualizar materias_primas"
  ON materias_primas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Autenticados podem deletar materias_primas"
  ON materias_primas FOR DELETE TO authenticated USING (true);

CREATE POLICY "Autenticados podem ler categorias_materia_prima"
  ON categorias_materia_prima FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir categorias_materia_prima"
  ON categorias_materia_prima FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados podem atualizar categorias_materia_prima"
  ON categorias_materia_prima FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Autenticados podem deletar categorias_materia_prima"
  ON categorias_materia_prima FOR DELETE TO authenticated USING (true);

CREATE POLICY "Autenticados podem ler facas"
  ON facas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir facas"
  ON facas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados podem atualizar facas"
  ON facas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Autenticados podem deletar facas"
  ON facas FOR DELETE TO authenticated USING (true);

CREATE POLICY "Autenticados podem ler faca_materias_primas"
  ON faca_materias_primas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Autenticados podem inserir faca_materias_primas"
  ON faca_materias_primas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Autenticados podem atualizar faca_materias_primas"
  ON faca_materias_primas FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Autenticados podem deletar faca_materias_primas"
  ON faca_materias_primas FOR DELETE TO authenticated USING (true);

-- ============================================================
-- Seed — Dados de exemplo
-- ============================================================

INSERT INTO fornecedores (nome, telefone) VALUES
  ('Sergio Rodrigues', '(51) 99999-0001'),
  ('João Mendes',      '(51) 99999-0002'),
  ('Carlos Bainha',    '(51) 99999-0003')
ON CONFLICT DO NOTHING;

INSERT INTO materias_primas (codigo, nome, categoria, fornecedor_id, preco_custo, estoque_atual, estoque_minimo)
SELECT 'MP-0001', 'Lâmina Aço Inox 420', 'Lâmina', id, 12.00, 8,  10 FROM fornecedores WHERE nome = 'Sergio Rodrigues'
ON CONFLICT DO NOTHING;
INSERT INTO materias_primas (codigo, nome, categoria, fornecedor_id, preco_custo, estoque_atual, estoque_minimo)
SELECT 'MP-0002', 'Cabo Madeira Imbuia', 'Cabo', id,  8.50, 6,   6 FROM fornecedores WHERE nome = 'João Mendes'
ON CONFLICT DO NOTHING;
INSERT INTO materias_primas (codigo, nome, categoria, fornecedor_id, preco_custo, estoque_atual, estoque_minimo)
SELECT 'MP-0003', 'Rebite Inox 4mm', 'Botão', id,  0.80, 12,  5 FROM fornecedores WHERE nome = 'João Mendes'
ON CONFLICT DO NOTHING;
INSERT INTO materias_primas (codigo, nome, categoria, fornecedor_id, preco_custo, estoque_atual, estoque_minimo)
SELECT 'MP-0004', 'Bainha Couro Curtido', 'Bainha', id, 22.00, 20,  8 FROM fornecedores WHERE nome = 'Carlos Bainha'
ON CONFLICT DO NOTHING;
INSERT INTO materias_primas (codigo, nome, categoria, fornecedor_id, preco_custo, estoque_atual, estoque_minimo)
SELECT 'MP-0005', 'Correia Couro Ajustável', 'Bainha', id, 15.00, 30, 10 FROM fornecedores WHERE nome = 'Carlos Bainha'
ON CONFLICT DO NOTHING;
INSERT INTO materias_primas (codigo, nome, categoria, fornecedor_id, preco_custo, estoque_atual, estoque_minimo)
SELECT 'MP-0006', 'Lâmina Aço Carbono 1070', 'Lâmina', id, 18.00, 0,   5 FROM fornecedores WHERE nome = 'Sergio Rodrigues'
ON CONFLICT DO NOTHING;

INSERT INTO categorias_materia_prima (nome, ordem) VALUES
  ('Bainha', 1),
  ('Botão', 2),
  ('Lâmina', 3),
  ('Cabo', 4)
ON CONFLICT DO NOTHING;

INSERT INTO facas (codigo, nome, categoria, preco_venda, estoque_atual) VALUES
  ('FK-0001', 'Faca Gauchesca Clássica', 'Gauchesca',  180.00, 12),
  ('FK-0002', 'Facinha Utilitária',      'Utilitária',  95.00,  8),
  ('FK-0003', 'Faca de Colecionador',   'Decorativa',  320.00,  3),
  ('FK-0004', 'Faca de Cozinha',        'Utilitária',  110.00,  0)
ON CONFLICT DO NOTHING;
