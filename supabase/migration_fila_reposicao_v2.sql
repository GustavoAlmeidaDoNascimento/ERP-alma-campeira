-- Fila de Reposição v2: estrutura pedido-cêntrica
-- Substitui a fila antiga (por fornecedor) por uma fila por pedido,
-- com análise inteligente de necessidade antes de criar OC.

-- 1. Remover tabela antiga (e dependências via CASCADE)
DROP TABLE IF EXISTS fila_reposicao CASCADE;

-- 2. Nova tabela: um registro por pedido analisado
CREATE TABLE fila_reposicao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'convertida', 'dispensada')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fila_reposicao_pedido ON fila_reposicao(pedido_id);
CREATE INDEX idx_fila_reposicao_status ON fila_reposicao(status);

-- 3. Itens da fila: uma matéria-prima por linha
CREATE TABLE fila_reposicao_itens (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fila_id UUID NOT NULL REFERENCES fila_reposicao(id) ON DELETE CASCADE,
  materia_prima_id UUID NOT NULL REFERENCES materias_primas(id),
  quantidade_sugerida NUMERIC NOT NULL CHECK (quantidade_sugerida >= 0),
  quantidade_adicional NUMERIC NOT NULL DEFAULT 0 CHECK (quantidade_adicional >= 0),
  selecionado BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_fila_reposicao_itens_fila ON fila_reposicao_itens(fila_id);
CREATE INDEX idx_fila_reposicao_itens_mp ON fila_reposicao_itens(materia_prima_id);
