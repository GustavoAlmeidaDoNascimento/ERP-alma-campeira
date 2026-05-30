# Alma Campeira

ERP sob medida para uma cutelaria artesanal: do controle de materias-primas ate a geracao automatica de ordens de compra por fornecedor.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS + TanStack Query
- **PostgreSQL + PostgREST** (banco na VPS, exposto como API REST)
- **Auth própria** com JWT (`jose` + `bcryptjs`) — cookie `erp-session`
- **Hospedagem em VPS própria** (não é Vercel); storage em filesystem local

> Não usamos mais Supabase hospedado nem Vercel. O `@supabase/supabase-js`
> permanece apenas como cliente de query apontando pro PostgREST. Contexto
> completo da arquitetura em **[`CLAUDE.md`](CLAUDE.md)**.

## Como rodar localmente

O ambiente local usa Docker (Postgres + PostgREST + proxy). Passo a passo
completo em **[`DEV-LOCAL.md`](DEV-LOCAL.md)**. Resumo:

1. `docker compose up -d` — sobe o banco e o PostgREST
2. `npm install`
3. `npm run db:pull` — puxa os dados da produção (mão única: prod → local)
4. `npm run dev` — abra [http://localhost:3000](http://localhost:3000)

`.env.local` aponta pro stack local; `JWT_SECRET` precisa ser igual ao da VPS
e `COOKIE_SECURE=false` em HTTP.

## Estrutura

- `src/app`: App Router; API routes de auth em `src/app/api/auth/*`
- `src/lib/actions/*`: Server Actions (todo acesso a banco passa aqui)
- `src/lib/supabase/*`: clientes de query apontando pro PostgREST (server/admin/client)
- `src/lib/storage`: storage em filesystem local
- `supabase/*.sql`: migrations soltas, idempotentes, aplicadas à mão
- `middleware.ts`: proteção de rotas / sessão