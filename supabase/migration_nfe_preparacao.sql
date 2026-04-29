-- ============================================================
-- Preparação para emissão de NF-e
-- ============================================================
-- Adiciona campos fiscais aos cadastros existentes e cria a tabela
-- empresa (emitente). Todas as colunas novas são opcionais para
-- não quebrar fluxos sem dados fiscais. Idempotente.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- 1. Tabela empresa (emitente) - single-row
-- ------------------------------------------------------------
create table if not exists public.empresa (
  id uuid primary key default gen_random_uuid(),
  razao_social text not null,
  nome_fantasia text,
  cnpj text not null,
  ie text,
  im text,
  crt smallint not null default 1,
  -- endereço
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  codigo_municipio_ibge text,
  -- contato
  telefone text,
  email text,
  -- controle
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.empresa enable row level security;

drop policy if exists "empresa_read_authenticated" on public.empresa;
create policy "empresa_read_authenticated"
on public.empresa for select
to authenticated
using (true);

drop policy if exists "empresa_write_authenticated" on public.empresa;
create policy "empresa_write_authenticated"
on public.empresa for all
to authenticated
using (true)
with check (true);

-- Mantém updated_at em sync.
create or replace function public.empresa_set_updated_at()
returns trigger
language plpgsql
as $fn_empresa_upd$
begin
  new.updated_at := now();
  return new;
end;
$fn_empresa_upd$;

drop trigger if exists empresa_set_updated_at on public.empresa;
create trigger empresa_set_updated_at
before update on public.empresa
for each row execute function public.empresa_set_updated_at();

-- ------------------------------------------------------------
-- 2. Clientes - campos fiscais
-- ------------------------------------------------------------
alter table public.clientes
  add column if not exists razao_social text,
  add column if not exists ie text,
  add column if not exists indicador_ie smallint default 9,
  add column if not exists codigo_municipio_ibge text;

-- ------------------------------------------------------------
-- 3. Fornecedores - campos fiscais
-- ------------------------------------------------------------
alter table public.fornecedores
  add column if not exists razao_social text,
  add column if not exists ie text,
  add column if not exists codigo_municipio_ibge text;

-- ------------------------------------------------------------
-- 4. Facas (produtos) - campos fiscais
-- ------------------------------------------------------------
alter table public.facas
  add column if not exists ncm text,
  add column if not exists cfop_padrao text,
  add column if not exists cst_icms text,
  add column if not exists cst_pis text,
  add column if not exists cst_cofins text,
  add column if not exists origem smallint default 0,
  add column if not exists unidade text default 'UN',
  add column if not exists ean_gtin text;

-- ------------------------------------------------------------
-- 5. Pedidos - natureza da operação
-- ------------------------------------------------------------
alter table public.pedidos
  add column if not exists natureza_operacao text default 'VENDA DE MERCADORIA';

-- ------------------------------------------------------------
-- 6. Pedido_itens - snapshot fiscal por item
-- ------------------------------------------------------------
alter table public.pedido_itens
  add column if not exists ncm text,
  add column if not exists cfop text;

-- ------------------------------------------------------------
-- 7. Auditoria da tabela empresa
-- ------------------------------------------------------------
-- A função public._install_audit_trigger é instalada por audit_logs_system.sql.
-- Aqui apenas anexamos o trigger na nova tabela; tolerante caso o sistema
-- de auditoria ainda não tenha sido instalado.
do $do_audit_empresa$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = '_install_audit_trigger'
  ) then
    perform public._install_audit_trigger('empresa');
  else
    raise notice 'audit_logs_system.sql ainda não instalado — pulando trigger de auditoria em empresa';
  end if;
end;
$do_audit_empresa$;
