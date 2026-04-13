-- CNPJ/CPF e endereço completo nos clientes (alinhado a fornecedores).
-- Execute no Supabase SQL Editor.

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS tipo_documento text NOT NULL DEFAULT 'cnpj'
    CHECK (tipo_documento IN ('cnpj', 'cpf'));

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS documento text;

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS cep text;

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS logradouro text;

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS numero text;

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS complemento text;

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS bairro text;

COMMENT ON COLUMN clientes.documento IS 'Apenas dígitos do CNPJ ou CPF';
COMMENT ON COLUMN clientes.cep IS 'Apenas 8 dígitos do CEP';
