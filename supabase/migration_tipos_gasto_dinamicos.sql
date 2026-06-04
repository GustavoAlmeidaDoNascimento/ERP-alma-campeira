-- ============================================================
-- Tipos de gasto dinâmicos (tags geridas pelos usuários)
-- ============================================================
--
-- Antes: gastos.tipo era um enum fixo via CHECK constraint, com os códigos
-- 'beneficios', 'investimento', 'material_consumo', 'administrativo',
-- 'pagamento_oc', 'outros'.
--
-- Agora: gastos.tipo passa a guardar o NOME legível da tag (ex.: "Material de
-- consumo"). As tags vivem na tabela public.tipos_gasto e podem ser criadas/
-- removidas pelos usuários. As tags 'Pagamento de OC' e 'Outros' são de
-- sistema (sistema = true) e não podem ser removidas — a primeira é gerada
-- automaticamente pelo pagamento de OCs/boletos; a segunda é o destino dos
-- gastos cujo tipo foi removido.
--
-- Idempotente: pode ser rodado várias vezes com segurança.

-- ------------------------------------------------------------
-- Tabela de tags
-- ------------------------------------------------------------

create table if not exists public.tipos_gasto (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  sistema boolean not null default false,
  created_at timestamptz not null default now()
);

-- Unicidade case-insensitive (backstop; a normalização principal é na app)
create unique index if not exists idx_tipos_gasto_nome_lower
  on public.tipos_gasto (lower(nome));

grant all on public.tipos_gasto to anon, authenticated, service_role;

alter table public.tipos_gasto enable row level security;

drop policy if exists "tipos_gasto_all_authenticated" on public.tipos_gasto;
create policy "tipos_gasto_all_authenticated"
on public.tipos_gasto for all
to authenticated
using (true)
with check (true);

-- ------------------------------------------------------------
-- Converter os códigos legados de gastos.tipo em nomes legíveis
-- ------------------------------------------------------------

alter table public.gastos drop constraint if exists gastos_tipo_check;

update public.gastos set tipo = case tipo
  when 'beneficios'       then 'Benefícios'
  when 'investimento'     then 'Investimento'
  when 'material_consumo' then 'Material de consumo'
  when 'administrativo'   then 'Administrativo'
  when 'pagamento_oc'     then 'Pagamento de OC'
  when 'outros'           then 'Outros'
  else tipo
end
where tipo in (
  'beneficios','investimento','material_consumo','administrativo','pagamento_oc','outros'
);

-- ------------------------------------------------------------
-- Seed das tags padrão + qualquer tipo já presente nos gastos
-- ------------------------------------------------------------

insert into public.tipos_gasto (nome, sistema) values
  ('Benefícios',          false),
  ('Investimento',        false),
  ('Material de consumo', false),
  ('Administrativo',      false),
  ('Pagamento de OC',     true),
  ('Outros',              true)
on conflict do nothing;

insert into public.tipos_gasto (nome, sistema)
select distinct g.tipo, false
from public.gastos g
where coalesce(trim(g.tipo), '') <> ''
  and not exists (
    select 1 from public.tipos_gasto t where lower(t.nome) = lower(g.tipo)
  )
on conflict do nothing;

-- ------------------------------------------------------------
-- Auditoria (se a infra de auditoria existir)
-- ------------------------------------------------------------

do $do_install_tipos_gasto_audit$
begin
  begin
    perform public._install_audit_trigger('tipos_gasto');
  exception
    when undefined_function then
      raise notice 'Função _install_audit_trigger não existe — rode audit_logs_system.sql primeiro.';
    when undefined_table then
      raise notice 'Tabela tipos_gasto não existe — pulando';
  end;
end;
$do_install_tipos_gasto_audit$;
