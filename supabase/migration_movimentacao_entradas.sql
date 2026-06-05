-- ============================================================
-- Movimentação Financeira — Entradas manuais (outras receitas)
-- ------------------------------------------------------------
-- A página "Movimentação" unifica, só na leitura:
--   • Saídas  = tabela `gastos` (já existente; inclui pagamentos de OC e
--               de boletos de saída).
--   • Entradas = parcelas pagas de boletos de ENTRADA + vendas à vista
--               já pagas (derivadas em runtime) + esta tabela `entradas`
--               (lançamentos manuais de outras receitas).
--
-- Esta migration cria APENAS a tabela `entradas`. Reutilizamos o módulo de
-- permissão `gastos` (mesma rota lógica), então NÃO há seed de permissões
-- novo aqui.
--
-- Idempotente: pode ser re-executado com segurança.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tabela entradas (receitas avulsas lançadas à mão)
-- ------------------------------------------------------------

create table if not exists public.entradas (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  valor numeric(14,2) not null check (valor >= 0),
  forma_pagamento text not null check (forma_pagamento in (
    'pix','dinheiro','cartao_credito','cartao_debito','boleto','cheque','link','transferencia','outro'
  )),
  data_entrada date not null default current_date,
  categoria text,
  observacao text,
  usuario_id uuid references public.usuarios_perfis(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_entradas_data on public.entradas (data_entrada desc);
create index if not exists idx_entradas_usuario on public.entradas (usuario_id);

alter table public.entradas enable row level security;

drop policy if exists "entradas_all_authenticated" on public.entradas;
create policy "entradas_all_authenticated"
on public.entradas for all
to authenticated
using (true)
with check (true);

-- Privilégios para os roles do PostgREST (anon/authenticated/service_role).
-- Tabelas criadas após o restore não herdam grants, então concedemos à mão.
do $entradas_grants$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant all on table public.entradas to authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on table public.entradas to service_role;
  end if;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant select on table public.entradas to anon;
  end if;
end;
$entradas_grants$;

-- ------------------------------------------------------------
-- Realtime (idempotente)
-- ------------------------------------------------------------

do $entradas_realtime$
begin
  begin
    alter publication supabase_realtime add table public.entradas;
  exception
    when duplicate_object then null;       -- já está na publicação
    when undefined_object then
      raise notice 'migration_movimentacao_entradas: publication supabase_realtime ausente — pulando.';
  end;
end;
$entradas_realtime$;

-- ------------------------------------------------------------
-- Auditoria (se o sistema de audit estiver instalado)
-- ------------------------------------------------------------

do $do_install_entradas_audit$
begin
  begin
    perform public._install_audit_trigger('entradas');
  exception
    when undefined_function then
      raise notice 'Função _install_audit_trigger não existe — rode audit_logs_system.sql primeiro.';
    when undefined_table then
      raise notice 'Tabela entradas não existe — pulando audit.';
  end;
end;
$do_install_entradas_audit$;
