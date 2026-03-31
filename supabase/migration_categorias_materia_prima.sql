-- =============================================================
-- Categorias de matéria-prima
-- =============================================================

create table if not exists categorias_materia_prima (
  id         uuid primary key default gen_random_uuid(),
  nome       text unique not null,
  ordem      integer not null default 0,
  created_at timestamptz default now()
);

alter table categorias_materia_prima enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'categorias_materia_prima'
      and policyname = 'auth categorias_materia_prima'
  ) then
    create policy "auth categorias_materia_prima" on categorias_materia_prima
      for all to authenticated
      using (true)
      with check (true);
  end if;
end $$;

insert into categorias_materia_prima (nome, ordem)
values
  ('Bainha', 1),
  ('Botão', 2),
  ('Lâmina', 3),
  ('Cabo', 4)
on conflict (nome) do nothing;

alter table materias_primas
  add column if not exists categoria text not null default 'Bainha';
