-- Documento (CNPJ padrão ou CPF) e endereço nos fornecedores.
-- Execute no Supabase SQL Editor (ou via CLI).

ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS tipo_documento text NOT NULL DEFAULT 'cnpj'
    CHECK (tipo_documento IN ('cnpj', 'cpf'));

ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS documento text;

ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS cep text;

ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS logradouro text;

ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS numero text;

ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS complemento text;

ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS bairro text;

ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS cidade text;

ALTER TABLE fornecedores
  ADD COLUMN IF NOT EXISTS uf text;

COMMENT ON COLUMN fornecedores.tipo_documento IS 'cnpj (padrão) ou cpf';
COMMENT ON COLUMN fornecedores.documento IS 'Apenas dígitos do CNPJ ou CPF';
COMMENT ON COLUMN fornecedores.cep IS 'Apenas 8 dígitos do CEP';
