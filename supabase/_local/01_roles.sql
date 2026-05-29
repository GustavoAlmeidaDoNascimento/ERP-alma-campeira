-- Bootstrap dos roles usados pelo PostgREST + RLS (equivalente ao Supabase).
-- Roda automaticamente na PRIMEIRA subida do container `db` (volume vazio).
--
-- Modelo:
--   anon          -> requisições não autenticadas
--   authenticated -> usuário logado
--   service_role  -> bypassa RLS (server-side, chave service_role)
--   authenticator -> role de login do PostgREST, que faz SET ROLE pros acima

DO $$ BEGIN
  CREATE ROLE anon NOLOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE authenticated NOLOGIN NOINHERIT;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'authenticator';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT anon, authenticated, service_role TO authenticator;

-- Acesso ao schema public
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Tabelas/sequences que JÁ existem (caso o restore venha antes deste script)
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Tabelas/sequences criadas DEPOIS (pelo restore do dump rodando como postgres)
-- herdam estes grants automaticamente.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
