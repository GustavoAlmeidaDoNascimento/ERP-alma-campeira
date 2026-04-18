-- ============================================================
-- Sistema de Orçamentos
-- ------------------------------------------------------------
-- Tabela paralela a `pedidos` para registrar orçamentos. Os
-- orçamentos NÃO afetam estoque, fila de reposição, OCs nem
-- métricas de vendas. Quando o usuário decidir transformar um
-- orçamento em venda, é criado um pedido novo (com novo código).
--
-- Idempotente: pode ser re-executado com segurança.
-- ============================================================

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------
-- Tabela orcamentos (espelha pedidos, sem campos de entrega)
-- ------------------------------------------------------------
create table if not exists public.orcamentos (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  cliente_id uuid references public.clientes(id) on delete set null,
  vendedor_id uuid references public.usuarios_perfis(id) on delete set null,
  data_orcamento date not null default current_date,
  observacao text,
  frete numeric(10,2) not null default 0,
  desconto_total numeric(10,2) not null default 0,
  valor_total numeric(10,2),
  -- Quando o orçamento foi convertido em venda (NULL = ainda aberto)
  convertido_pedido_id uuid references public.pedidos(id) on delete set null,
  convertido_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_orcamentos_created_at on public.orcamentos (created_at desc);
create index if not exists idx_orcamentos_cliente on public.orcamentos (cliente_id);
create index if not exists idx_orcamentos_vendedor on public.orcamentos (vendedor_id);
create index if not exists idx_orcamentos_convertido on public.orcamentos (convertido_pedido_id);

-- ------------------------------------------------------------
-- Itens do orçamento
-- ------------------------------------------------------------
create table if not exists public.orcamento_itens (
  id uuid primary key default gen_random_uuid(),
  orcamento_id uuid not null references public.orcamentos(id) on delete cascade,
  faca_id uuid not null references public.facas(id) on delete restrict,
  quantidade integer not null check (quantidade > 0),
  preco_unitario numeric(10,2) not null check (preco_unitario >= 0),
  -- subtotal mantido como coluna gerada (igual a pedido_itens)
  subtotal numeric(10,2) generated always as (quantidade * preco_unitario) stored,
  created_at timestamptz not null default now()
);

create index if not exists idx_orcamento_itens_orcamento on public.orcamento_itens (orcamento_id);
create index if not exists idx_orcamento_itens_faca on public.orcamento_itens (faca_id);

-- ------------------------------------------------------------
-- RLS — segue o mesmo modelo das demais tabelas (acesso via service role
-- nas server actions; em produção a permissão real é validada pela camada
-- de aplicação via assertPermissao)
-- ------------------------------------------------------------
alter table public.orcamentos enable row level security;
alter table public.orcamento_itens enable row level security;

drop policy if exists "orcamentos_all_authenticated" on public.orcamentos;
create policy "orcamentos_all_authenticated"
on public.orcamentos for all
to authenticated
using (true)
with check (true);

drop policy if exists "orcamento_itens_all_authenticated" on public.orcamento_itens;
create policy "orcamento_itens_all_authenticated"
on public.orcamento_itens for all
to authenticated
using (true)
with check (true);

-- ------------------------------------------------------------
-- Permissões — seed do módulo 'orcamentos' para cargos existentes.
-- Sem isso, cargos antigos não teriam linha em cargo_permissoes para
-- o módulo novo e o usuário não conseguiria nem ver a aba.
--
-- Estratégia: para cada cargo, copia as permissões já configuradas em
-- 'vendas' (assim quem podia mexer em vendas já passa a poder mexer em
-- orçamentos). Se o cargo não tem linha em vendas, cria zerado.
-- ------------------------------------------------------------
insert into public.cargo_permissoes (cargo_id, modulo, ver, criar, editar, deletar)
select
  c.id,
  'orcamentos',
  coalesce(v.ver,     false),
  coalesce(v.criar,   false),
  coalesce(v.editar,  false),
  coalesce(v.deletar, false)
from public.cargos c
left join public.cargo_permissoes v
  on v.cargo_id = c.id and v.modulo = 'vendas'
on conflict (cargo_id, modulo) do nothing;

-- Para usuários com permissões customizadas (override), faz o mesmo seed
-- a partir do que já têm em 'vendas'.
insert into public.usuario_permissoes (usuario_id, modulo, ver, criar, editar, deletar)
select
  u.usuario_id,
  'orcamentos',
  coalesce(u.ver,     false),
  coalesce(u.criar,   false),
  coalesce(u.editar,  false),
  coalesce(u.deletar, false)
from public.usuario_permissoes u
where u.modulo = 'vendas'
on conflict (usuario_id, modulo) do nothing;

-- ------------------------------------------------------------
-- Auditoria — engancha as duas novas tabelas no trigger genérico
-- (a função public.log_audit_event() já existe em audit_logs_system.sql)
-- ------------------------------------------------------------
do $do_install_orcamentos_audit$
declare
  t text;
  tables text[] := array['orcamentos', 'orcamento_itens'];
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
$do_install_orcamentos_audit$;
