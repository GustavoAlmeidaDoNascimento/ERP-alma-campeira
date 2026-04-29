-- ============================================================
-- Sistema de Auditoria - registro de TODAS as mutacoes
-- ============================================================
-- Cria a tabela audit_logs e anexa um trigger generico em cada
-- tabela de dominio, capturando INSERT / UPDATE / DELETE com:
--   - quem (auth.uid() ou GUC app.user_id)
--   - o que (old_data + new_data como jsonb + changed_fields)
--   - quando (created_at)
--   - de onde (ip_address, user_agent via GUCs)
--
-- Rode este script uma vez no SQL editor do Supabase.
-- Idempotente: pode ser re-executado com seguranca.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tabela principal
-- ------------------------------------------------------------
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  user_id uuid,
  user_name text,
  user_email text,

  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  table_name text not null,
  record_id text,

  old_data jsonb,
  new_data jsonb,
  changed_fields text[],

  ip_address text,
  user_agent text
);

create index if not exists idx_audit_logs_created_at on public.audit_logs (created_at desc);
create index if not exists idx_audit_logs_table_action on public.audit_logs (table_name, action);
create index if not exists idx_audit_logs_user_id on public.audit_logs (user_id);
create index if not exists idx_audit_logs_record on public.audit_logs (table_name, record_id);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_read_authenticated" on public.audit_logs;
create policy "audit_logs_read_authenticated"
on public.audit_logs for select
to authenticated
using (true);

-- ------------------------------------------------------------
-- Helper: contexto opcional (IP, User-Agent)
-- ------------------------------------------------------------
create or replace function public.set_audit_context(p_ip text, p_user_agent text)
returns void
language plpgsql
security definer
set search_path = public
as $fn_set_ctx$
begin
  perform set_config('app.ip_address', coalesce(p_ip, ''),         true);
  perform set_config('app.user_agent', coalesce(p_user_agent, ''), true);
end;
$fn_set_ctx$;

grant execute on function public.set_audit_context(text, text) to authenticated;

-- ------------------------------------------------------------
-- Funcao generica de trigger
-- ------------------------------------------------------------
create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn_log_audit$
declare
  v_user_id    uuid;
  v_user_name  text;
  v_user_email text;
  v_old        jsonb;
  v_new        jsonb;
  v_record_id  text;
  v_changed    text[];
  v_ip         text;
  v_ua         text;
begin
  -- Identidade: auth.uid() -> fallback GUC app.user_id
  begin
    v_user_id := auth.uid();
  exception when others then
    v_user_id := null;
  end;

  if v_user_id is null then
    begin
      v_user_id := nullif(current_setting('app.user_id', true), '')::uuid;
    exception when others then
      v_user_id := null;
    end;
  end if;

  -- Snapshot nome / email (usa := com subquery, sem SELECT INTO)
  if v_user_id is not null then
    begin
      v_user_name := (
        select p.nome from public.usuarios_perfis p where p.id = v_user_id
      );
    exception when others then
      v_user_name := null;
    end;

    begin
      v_user_email := (
        select u.email::text from auth.users u where u.id = v_user_id
      );
    exception when others then
      v_user_email := null;
    end;
  end if;

  v_ip := nullif(current_setting('app.ip_address', true), '');
  v_ua := nullif(current_setting('app.user_agent', true), '');

  if TG_OP = 'DELETE' then
    v_old := to_jsonb(OLD);
    v_new := null;
    v_record_id := coalesce(v_old->>'id', '');
  elsif TG_OP = 'INSERT' then
    v_old := null;
    v_new := to_jsonb(NEW);
    v_record_id := coalesce(v_new->>'id', '');
  else
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    v_record_id := coalesce(v_new->>'id', '');

    v_changed := (
      select array_agg(e.k order by e.k)
        from jsonb_each(v_new) as e(k, val)
        where v_old->e.k is distinct from v_new->e.k
    );

    if v_changed is null or array_length(v_changed, 1) is null then
      return NEW;
    end if;
  end if;

  insert into public.audit_logs (
    user_id, user_name, user_email,
    action, table_name, record_id,
    old_data, new_data, changed_fields,
    ip_address, user_agent
  ) values (
    v_user_id, v_user_name, v_user_email,
    TG_OP, TG_TABLE_NAME, v_record_id,
    v_old, v_new, v_changed,
    v_ip, v_ua
  );

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;

exception when others then
  -- Falha no log NUNCA deve derrubar a mutacao real
  raise warning 'audit_logs falhou em %.%: %', TG_TABLE_NAME, TG_OP, sqlerrm;
  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$fn_log_audit$;

-- ------------------------------------------------------------
-- Instalacao de triggers em todas as tabelas de dominio
-- ------------------------------------------------------------
create or replace function public._install_audit_trigger(p_table text)
returns void
language plpgsql
as $fn_install$
begin
  execute format('drop trigger if exists audit_%1$s on public.%1$s', p_table);
  execute format(
    'create trigger audit_%1$s after insert or update or delete on public.%1$s for each row execute function public.log_audit_event()',
    p_table
  );
end;
$fn_install$;

do $do_install_triggers$
declare
  t text;
  tables text[] := array[
    'usuarios_perfis',
    'usuario_permissoes',
    'cargos',
    'cargo_permissoes',
    'fornecedores',
    'clientes',
    'materias_primas',
    'categorias_materia_prima',
    'facas',
    'categorias_faca',
    'faca_materias_primas',
    'consumiveis',
    'categorias_consumivel',
    'movimentacoes_estoque',
    'fila_reposicao',
    'pedidos',
    'pedido_itens',
    'ordens_compra',
    'ordem_compra_itens',
    'app_config',
    'empresa'
  ];
begin
  foreach t in array tables loop
    begin
      perform public._install_audit_trigger(t);
    exception when undefined_table then
      raise notice 'Tabela % nao existe - pulando', t;
    end;
  end loop;
end;
$do_install_triggers$;
