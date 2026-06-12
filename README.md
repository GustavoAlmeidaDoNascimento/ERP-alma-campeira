# Alma Campeira

ERP sob medida para uma cutelaria artesanal: do controle de matérias-primas até a geração automática de ordens de compra por fornecedor.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS + TanStack Query
- **PostgreSQL + PostgREST** rodando na VPS (`69.62.103.155`), atrás de um proxy nginx
- **Auth própria** com JWT (`jose` + `bcryptjs`) — sessão no cookie httpOnly `erp-session`
- Storage em **filesystem local** na VPS; "realtime" é polling no cliente
- App em produção gerenciado pelo **pm2** (processo `erp-alma`), em `/var/www/erp-alma`

> **Não usamos Supabase hospedado nem Vercel.** O `@supabase/supabase-js` ficou
> só como cliente de query apontando pro PostgREST (que imita a API do Supabase).
> Contexto completo da arquitetura em **[`CLAUDE.md`](CLAUDE.md)**.

## Rodar local

Pré-requisitos: Docker Desktop rodando e acesso SSH à VPS. Detalhes (inclusive
como montar o `.env` e o `.env.local`) em **[`DEV-LOCAL.md`](DEV-LOCAL.md)**.

```bash
npm install
npm run db:up      # sobe Postgres (5432), PostgREST e o proxy nginx (3001) no Docker
npm run db:pull    # copia o banco da produção pro local (mão única: prod → local)
npm run dev        # http://localhost:3000
```

Pegadinhas que causam loop de redirect no login:

- `JWT_SECRET` no `.env`/`.env.local` precisa ser **igual** ao da VPS (as chaves
  anon/service_role são JWTs assinados com ele).
- `COOKIE_SECURE=false` em HTTP local, senão o cookie de sessão é descartado.

## Deploy

**Deploy = `git push` na `main`.** A VPS roda um cron a cada minuto
(`/var/www/erp-alma/deploy.sh`) que, se `origin/main` estiver à frente, faz
`git pull` + `npm install` + `npm run build` e reinicia o pm2 (`erp-alma`).
Só reinicia se o build passar. Log em `/var/log/erp-deploy.log`.

```bash
git push origin main   # isso é o deploy; em ~1-2 min está no ar
```

Pra acompanhar ou intervir manualmente:

```bash
ssh root@69.62.103.155
tail -f /var/log/erp-deploy.log   # acompanhar o deploy
pm2 logs erp-alma                 # logs do app
pm2 restart erp-alma              # reiniciar na mão se precisar
```

### Migrations (manuais)

Mudança de schema **não** entra no deploy automático. Os `.sql` em `supabase/`
são migrations soltas e idempotentes, aplicadas à mão:

```bash
# local
docker exec -i erp_db psql -U postgres -d erp_alma < supabase/minha-migration.sql

# produção
ssh root@69.62.103.155
cd /var/www/erp-alma && export $(grep '^DATABASE_URL=' .env.local | xargs)
psql "$DATABASE_URL" -f supabase/minha-migration.sql
```

## Estrutura

- `src/app`: App Router; API routes de auth em `src/app/api/auth/*`
- `src/lib/actions/*`: Server Actions (**todo** acesso a banco passa aqui)
- `src/lib/supabase/*`: clientes de query apontando pro PostgREST (server/admin/client)
- `src/lib/storage`: storage em filesystem local
- `supabase/*.sql`: migrations soltas, idempotentes, aplicadas à mão
- `middleware.ts`: proteção de rotas / sessão
