/**
 * Script temporário para aplicar migrations via Supabase Management API.
 * Requer SUPABASE_ACCESS_TOKEN (Personal Access Token) no ambiente.
 * Execute: SUPABASE_ACCESS_TOKEN=seu_token node scripts/apply-migration.mjs
 */

const PROJECT_REF = 'ztcwewlnnvujhkneqmam'
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN

if (!ACCESS_TOKEN) {
  console.error('❌ Defina SUPABASE_ACCESS_TOKEN antes de rodar este script.')
  console.error('   Obtenha em: https://supabase.com/dashboard/account/tokens')
  console.error('   Execute: SUPABASE_ACCESS_TOKEN=seu_token node scripts/apply-migration.mjs')
  process.exit(1)
}

const SQL = `
create table if not exists ordens_compra (
  id            uuid primary key default gen_random_uuid(),
  codigo        text unique not null,
  fornecedor_id uuid references fornecedores(id) on delete set null,
  status        text not null default 'pendente',
  data_geracao  date not null default current_date,
  observacao    text,
  created_at    timestamptz default now()
);
alter table ordens_compra enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'ordens_compra' and policyname = 'auth ordens_compra'
  ) then
    create policy "auth ordens_compra" on ordens_compra
      for all to authenticated using (true) with check (true);
  end if;
end $$;

create table if not exists ordem_compra_itens (
  id               uuid primary key default gen_random_uuid(),
  ordem_compra_id  uuid not null references ordens_compra(id) on delete cascade,
  materia_prima_id uuid not null references materias_primas(id),
  quantidade       numeric(10,3) not null check (quantidade > 0),
  preco_unitario   numeric(10,2)
);
alter table ordem_compra_itens enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'ordem_compra_itens' and policyname = 'auth ordem_compra_itens'
  ) then
    create policy "auth ordem_compra_itens" on ordem_compra_itens
      for all to authenticated using (true) with check (true);
  end if;
end $$;

-- Fix: fila_reposicao / fila_reposicao_itens tinham RLS ligada (default do
-- Supabase ao criar tabela) mas nenhuma policy, então toda inserção de
-- autenticado caía em 42501 e era engolida pelo try/catch na entrega do pedido.
alter table fila_reposicao enable row level security;
alter table fila_reposicao_itens enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename = 'fila_reposicao' and policyname = 'auth fila_reposicao'
  ) then
    create policy "auth fila_reposicao" on fila_reposicao
      for all to authenticated using (true) with check (true);
  end if;
  if not exists (
    select 1 from pg_policies where tablename = 'fila_reposicao_itens' and policyname = 'auth fila_reposicao_itens'
  ) then
    create policy "auth fila_reposicao_itens" on fila_reposicao_itens
      for all to authenticated using (true) with check (true);
  end if;
end $$;
`

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query: SQL }),
})

const body = await res.json()

if (!res.ok) {
  console.error('❌ Erro ao executar migration:', JSON.stringify(body, null, 2))
  process.exit(1)
}

console.log('✅ Migration aplicada com sucesso!')
console.log('   Tabelas criadas: ordens_compra, ordem_compra_itens')
