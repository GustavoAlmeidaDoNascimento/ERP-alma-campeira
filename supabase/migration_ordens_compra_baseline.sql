-- ============================================================
-- Baseline: Ordens de Compra + Itens
-- ------------------------------------------------------------
-- Pré-requisitos: public.fornecedores e public.materias_primas
-- já devem existir (cadastro base do ERP).
--
-- Pode rodar sozinho, ou usar só migration_gastos_system.sql (já inclui
-- esta secção). Depois, se precisar: migration_oc_fila_link.sql
-- (coluna fila_reposicao_id).
--
-- Idempotente: usa IF NOT EXISTS onde aplicável.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- ordens_compra
-- ------------------------------------------------------------
create table if not exists public.ordens_compra (
  id uuid primary key default gen_random_uuid(),
  codigo text unique not null,
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  status text not null default 'pendente',
  data_geracao date not null default current_date,
  observacao text,
  created_at timestamptz not null default now(),
  constraint ordens_compra_status_check
    check (status in ('pendente','enviada','pago','recebida'))
);

alter table public.ordens_compra enable row level security;

drop policy if exists "auth ordens_compra" on public.ordens_compra;
create policy "auth ordens_compra"
  on public.ordens_compra
  for all
  to authenticated
  using (true)
  with check (true);

-- ------------------------------------------------------------
-- ordem_compra_itens
-- ------------------------------------------------------------
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
