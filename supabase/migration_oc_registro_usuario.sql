-- Registro de quem alterou a ordem de compra por último (status, edições, etc.)

alter table public.ordens_compra
  add column if not exists ultima_alteracao_usuario_id uuid references public.usuarios_perfis(id) on delete set null;

alter table public.ordens_compra
  add column if not exists ultima_alteracao_em timestamptz;

create index if not exists idx_ordens_compra_ultima_alteracao_usuario
  on public.ordens_compra (ultima_alteracao_usuario_id);
