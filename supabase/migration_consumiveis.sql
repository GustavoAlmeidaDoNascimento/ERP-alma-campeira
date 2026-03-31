-- Migration: Módulo de Consumíveis
-- Cria tabelas para consumíveis (itens usados por produção e escritório, sem vínculo com BOM de facas)

CREATE TABLE IF NOT EXISTS categorias_consumivel (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       text NOT NULL UNIQUE,
  ordem      int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Categorias padrão
INSERT INTO categorias_consumivel (nome, ordem) VALUES
  ('Escritório', 1),
  ('Limpeza', 2),
  ('Produção', 3),
  ('Segurança', 4)
ON CONFLICT (nome) DO NOTHING;

CREATE TABLE IF NOT EXISTS consumiveis (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo         text UNIQUE NOT NULL,
  nome           text NOT NULL,
  categoria      text NOT NULL DEFAULT 'Escritório',
  fornecedor_id  uuid REFERENCES fornecedores(id) ON DELETE SET NULL,
  foto_url       text,
  preco_custo    numeric(10,2) NOT NULL DEFAULT 0,
  estoque_atual  numeric(10,3) NOT NULL DEFAULT 0,
  estoque_minimo numeric(10,3) NOT NULL DEFAULT 0,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE consumiveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias_consumivel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users can read consumiveis"
  ON consumiveis FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth users can insert consumiveis"
  ON consumiveis FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth users can update consumiveis"
  ON consumiveis FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth users can delete consumiveis"
  ON consumiveis FOR DELETE TO authenticated USING (true);

CREATE POLICY "auth users can read categorias_consumivel"
  ON categorias_consumivel FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth users can insert categorias_consumivel"
  ON categorias_consumivel FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth users can update categorias_consumivel"
  ON categorias_consumivel FOR UPDATE TO authenticated USING (true);
CREATE POLICY "auth users can delete categorias_consumivel"
  ON categorias_consumivel FOR DELETE TO authenticated USING (true);
