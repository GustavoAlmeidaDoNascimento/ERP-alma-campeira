-- ============================================================
-- Sistema Financeiro — Boletos (entrada/saida) + parcelas
-- ------------------------------------------------------------
-- Cria boletos a pagar (saida) e a receber (entrada), com até
-- 6 parcelas por boleto. Vínculos opcionais com fornecedores,
-- clientes e vendedor (usuarios_perfis). Idempotente.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tabela: boletos (cabeçalho)
-- ------------------------------------------------------------

create table if not exists public.boletos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('entrada','saida')),

  -- Texto livre (cliente/fornecedor) — sempre preenchido p/ exibição rápida
  contraparte_nome text not null,
  cnpj_cpf text,

  -- Vínculos opcionais com cadastros existentes
  cliente_id uuid references public.clientes(id) on delete set null,
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  vendedor_id uuid references public.usuarios_perfis(id) on delete set null,

  -- Campos do Excel de entrada (alguns são opcionais para saída)
  unidades integer check (unidades is null or unidades > 0),
  numero_documento text,            -- "Número" no Excel (NF, pedido, etc)
  valor_total numeric(14,2) not null check (valor_total >= 0),
  emitido_em date,

  observacao text,

  -- Auditoria
  criado_por uuid references public.usuarios_perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint boletos_tipo_vinculo_check check (
    -- entrada: pode vincular cliente; saida: pode vincular fornecedor
    (tipo = 'entrada' and fornecedor_id is null)
    or (tipo = 'saida' and cliente_id is null and vendedor_id is null)
  )
);

alter table public.boletos enable row level security;

drop policy if exists "auth boletos" on public.boletos;
create policy "auth boletos"
  on public.boletos
  for all
  to authenticated
  using (true)
  with check (true);

create index if not exists idx_boletos_tipo on public.boletos (tipo);
create index if not exists idx_boletos_cliente on public.boletos (cliente_id);
create index if not exists idx_boletos_fornecedor on public.boletos (fornecedor_id);
create index if not exists idx_boletos_emitido_em on public.boletos (emitido_em desc);
create index if not exists idx_boletos_created_at on public.boletos (created_at desc);

-- ------------------------------------------------------------
-- Tabela: boleto_parcelas (1 a 6 por boleto)
-- ------------------------------------------------------------

create table if not exists public.boleto_parcelas (
  id uuid primary key default gen_random_uuid(),
  boleto_id uuid not null references public.boletos(id) on delete cascade,
  numero smallint not null check (numero between 1 and 6),
  vencimento date not null,
  valor numeric(14,2) not null check (valor >= 0),
  -- Pago: nulos = em aberto. Preenchidos = pago naquela data/valor.
  pago_em date,
  valor_pago numeric(14,2) check (valor_pago is null or valor_pago >= 0),
  created_at timestamptz not null default now(),
  unique (boleto_id, numero)
);

alter table public.boleto_parcelas enable row level security;

drop policy if exists "auth boleto_parcelas" on public.boleto_parcelas;
create policy "auth boleto_parcelas"
  on public.boleto_parcelas
  for all
  to authenticated
  using (true)
  with check (true);

create index if not exists idx_boleto_parcelas_boleto on public.boleto_parcelas (boleto_id);
create index if not exists idx_boleto_parcelas_vencimento on public.boleto_parcelas (vencimento);
create index if not exists idx_boleto_parcelas_pendentes
  on public.boleto_parcelas (vencimento) where pago_em is null;

-- ------------------------------------------------------------
-- Trigger: updated_at em boletos
-- ------------------------------------------------------------

create or replace function public._boletos_touch_updated_at()
returns trigger as $$
begin
  new.updated_at := now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_boletos_touch on public.boletos;
create trigger trg_boletos_touch
  before update on public.boletos
  for each row execute function public._boletos_touch_updated_at();

-- ------------------------------------------------------------
-- Permissões — seed do módulo 'boletos' (espelha 'gastos')
-- ------------------------------------------------------------

do $seed_boletos_perms$
begin
  if to_regclass('public.cargo_permissoes') is not null
     and to_regclass('public.cargos') is not null then
    insert into public.cargo_permissoes (cargo_id, modulo, ver, criar, editar, deletar)
    select
      c.id,
      'boletos',
      coalesce(o.ver,     false),
      coalesce(o.criar,   false),
      coalesce(o.editar,  false),
      coalesce(o.deletar, false)
    from public.cargos c
    left join public.cargo_permissoes o
      on o.cargo_id = c.id and o.modulo = 'gastos'
    on conflict (cargo_id, modulo) do nothing;
  else
    raise notice 'migration_boletos_system: seed cargo_permissoes omitido — cargos/cargo_permissoes ausentes.';
  end if;

  if to_regclass('public.usuario_permissoes') is not null then
    insert into public.usuario_permissoes (usuario_id, modulo, ver, criar, editar, deletar)
    select
      u.usuario_id,
      'boletos',
      coalesce(u.ver,     false),
      coalesce(u.criar,   false),
      coalesce(u.editar,  false),
      coalesce(u.deletar, false)
    from public.usuario_permissoes u
    where u.modulo = 'gastos'
    on conflict (usuario_id, modulo) do nothing;
  else
    raise notice 'migration_boletos_system: seed usuario_permissoes omitido.';
  end if;
end;
$seed_boletos_perms$;

-- ------------------------------------------------------------
-- Auditoria (se _install_audit_trigger existir)
-- ------------------------------------------------------------

do $do_install_boletos_audit$
declare
  t text;
  tables text[] := array['boletos','boleto_parcelas'];
begin
  foreach t in array tables loop
    begin
      perform public._install_audit_trigger(t);
    exception
      when undefined_function then
        raise notice 'Função _install_audit_trigger não existe — pulando auditoria.';
      when undefined_table then
        raise notice 'Tabela % não existe — pulando', t;
    end;
  end loop;
end;
$do_install_boletos_audit$;
