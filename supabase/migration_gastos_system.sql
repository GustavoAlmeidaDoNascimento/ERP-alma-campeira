-- ============================================================
-- Sistema Financeiro — Gastos (+ cadastro mínimo se faltar)
-- ------------------------------------------------------------
-- Autossuficiente no SQL Editor do Supabase (projeto “verde”):
-- cria fornecedores, materias_primas, ordens_compra, ordem_compra_itens
-- e gastos quando ainda não existem.
--
-- Seeds de permissões (cargo_permissoes / usuario_permissoes) só
-- correm se essas tabelas já existirem (ex.: esquema de auth do ERP).
--
-- Idempotente: pode ser re-executado com segurança.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Secção 0 — Fornecedores (cadastro base)
-- ------------------------------------------------------------

create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  telefone text,
  email text,
  tipo_documento text not null default 'cnpj' check (tipo_documento in ('cnpj','cpf')),
  documento text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  razao_social text,
  ie text,
  codigo_municipio_ibge text,
  created_at timestamptz not null default now()
);

alter table public.fornecedores enable row level security;

drop policy if exists "auth fornecedores" on public.fornecedores;
create policy "auth fornecedores"
  on public.fornecedores
  for all
  to authenticated
  using (true)
  with check (true);

create index if not exists idx_fornecedores_nome on public.fornecedores (nome);

-- ------------------------------------------------------------
-- Secção 0b — Matérias-primas (cadastro base)
-- ------------------------------------------------------------

create table if not exists public.materias_primas (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  nome text not null,
  categoria text not null default '',
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  foto_url text,
  preco_custo numeric(14, 4) not null default 0,
  estoque_atual numeric(14, 4) not null default 0,
  estoque_minimo numeric(14, 4) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.materias_primas enable row level security;

drop policy if exists "auth materias_primas" on public.materias_primas;
create policy "auth materias_primas"
  on public.materias_primas
  for all
  to authenticated
  using (true)
  with check (true);

create index if not exists idx_materias_primas_codigo on public.materias_primas (codigo);
create index if not exists idx_materias_primas_fornecedor on public.materias_primas (fornecedor_id);

-- ------------------------------------------------------------
-- Secção 1 — Ordens de compra + itens
-- ------------------------------------------------------------

create table if not exists public.ordens_compra (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  status text not null default 'pendente',
  pago boolean not null default false,
  data_geracao date not null default current_date,
  observacao text,
  ultima_alteracao_usuario_id uuid references public.usuarios_perfis(id) on delete set null,
  ultima_alteracao_em timestamptz,
  created_at timestamptz not null default now(),
  constraint ordens_compra_status_check
    check (status in ('pendente','enviada','recebida'))
);

alter table public.ordens_compra enable row level security;

drop policy if exists "auth ordens_compra" on public.ordens_compra;
create policy "auth ordens_compra"
  on public.ordens_compra
  for all
  to authenticated
  using (true)
  with check (true);

create table if not exists public.ordem_compra_itens (
  id uuid primary key default gen_random_uuid(),
  ordem_compra_id uuid not null references public.ordens_compra(id) on delete cascade,
  materia_prima_id uuid not null references public.materias_primas(id),
  quantidade numeric(14, 4) not null check (quantidade > 0),
  quantidade_vendida numeric(14, 4) not null default 0 check (quantidade_vendida >= 0),
  quantidade_adicional numeric(14, 4) not null default 0 check (quantidade_adicional >= 0),
  preco_unitario numeric(14, 2)
);

alter table public.ordem_compra_itens enable row level security;

drop policy if exists "auth ordem_compra_itens" on public.ordem_compra_itens;
create policy "auth ordem_compra_itens"
  on public.ordem_compra_itens
  for all
  to authenticated
  using (true)
  with check (true);

create index if not exists idx_ordem_compra_itens_oc on public.ordem_compra_itens (ordem_compra_id);
create index if not exists idx_ordens_compra_fornecedor on public.ordens_compra (fornecedor_id);

-- ------------------------------------------------------------
-- Secção 2 — Tabela gastos
-- ------------------------------------------------------------

create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in (
    'beneficios','investimento','material_consumo','administrativo','pagamento_oc','outros'
  )),
  descricao text not null,
  valor numeric(14,2) not null check (valor >= 0),
  forma_pagamento text not null check (forma_pagamento in (
    'pix','dinheiro','cartao_credito','cartao_debito','boleto','transferencia','outro'
  )),
  data_gasto date not null default current_date,
  ordem_compra_id uuid references public.ordens_compra(id) on delete set null,
  observacao text,
  usuario_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_gastos_data on public.gastos (data_gasto desc);
create index if not exists idx_gastos_tipo on public.gastos (tipo);
create index if not exists idx_gastos_oc on public.gastos (ordem_compra_id);

alter table public.gastos enable row level security;

drop policy if exists "gastos_all_authenticated" on public.gastos;
create policy "gastos_all_authenticated"
on public.gastos for all
to authenticated
using (true)
with check (true);

-- ------------------------------------------------------------
-- Permissões — seed do módulo 'gastos' (se tabelas de permissão existirem)
-- ------------------------------------------------------------

do $seed_gastos_perms$
begin
  if to_regclass('public.cargo_permissoes') is not null
     and to_regclass('public.cargos') is not null then
    insert into public.cargo_permissoes (cargo_id, modulo, ver, criar, editar, deletar)
    select
      c.id,
      'gastos',
      coalesce(o.ver,     false),
      coalesce(o.criar,   false),
      coalesce(o.editar,  false),
      coalesce(o.deletar, false)
    from public.cargos c
    left join public.cargo_permissoes o
      on o.cargo_id = c.id and o.modulo = 'ordens_compra'
    on conflict (cargo_id, modulo) do nothing;
  else
    raise notice 'migration_gastos_system: seed cargo_permissoes omitido — cargos/cargo_permissoes ausentes.';
  end if;

  if to_regclass('public.usuario_permissoes') is not null then
    insert into public.usuario_permissoes (usuario_id, modulo, ver, criar, editar, deletar)
    select
      u.usuario_id,
      'gastos',
      coalesce(u.ver,     false),
      coalesce(u.criar,   false),
      coalesce(u.editar,  false),
      coalesce(u.deletar, false)
    from public.usuario_permissoes u
    where u.modulo = 'ordens_compra'
    on conflict (usuario_id, modulo) do nothing;
  else
    raise notice 'migration_gastos_system: seed usuario_permissoes omitido — tabela usuario_permissoes ausente.';
  end if;
end;
$seed_gastos_perms$;

-- ------------------------------------------------------------
-- Auditoria
-- ------------------------------------------------------------

do $do_install_gastos_audit$
declare
  t text;
  tables text[] := array['gastos'];
begin
  foreach t in array tables loop
    begin
      perform public._install_audit_trigger(t);
    exception
      when undefined_function then
        raise notice 'Função _install_audit_trigger não existe — rode audit_logs_system.sql primeiro.';
      when undefined_table then
        raise notice 'Tabela % não existe — pulando', t;
    end;
  end loop;
end;
$do_install_gastos_audit$;
