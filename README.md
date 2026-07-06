# Alma Campeira

ERP sob medida para uma cutelaria artesanal: do controle de matérias-primas até a geração automática de ordens de compra por fornecedor.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS + TanStack Query
- Prisma ORM + PostgreSQL
- Auth própria com JWT (`jose` + `bcryptjs`) usando cookie httpOnly `erp-session`
- Storage em filesystem local
- Ambiente operacional atual: local-only

> A migração atual é `Prisma-only`: sem Supabase, sem PostgREST e sem `postgres.js`.

## Rodar local

Pré-requisito: PostgreSQL local disponível em `localhost:5432`, database `erp_alma`.
Detalhes de ambiente em **[`DEV-LOCAL.md`](DEV-LOCAL.md)**.

```bash
npm install
npm run db:up      # sobe PostgreSQL local no Docker
npm run prisma:migrate:dev
npm run prisma:generate
npm run dev        # http://localhost:3000
```

Comandos Prisma úteis:

```bash
npm run prisma:validate
npm run prisma:generate
npm run prisma:studio
```

Pegadinhas que causam loop de redirect no login:

- `COOKIE_SECURE=false` em HTTP local, senão o cookie de sessão é descartado.
- `JWT_SECRET` precisa estar definido no `.env.local`, senão o login não consegue assinar a sessão.

## Estrutura

- `src/app`: App Router e API routes de auth
- `src/lib/actions/*`: Server Actions do ERP
- `src/lib/prisma.ts`: singleton do `PrismaClient`
- `src/lib/storage.ts`: storage em filesystem local
- `prisma/schema.prisma`: schema principal
- `prisma/migrations/*`: migrations locais
- `docker-compose.yml`: PostgreSQL local

## Estado da migração

- acesso a dados do ERP migrado para Prisma
- autenticação local baseada em `/api/auth/*`
- storage local sem dependência de Supabase Storage
- limpeza operacional do legado concluída

## Observação

Os artefatos operacionais legados de Supabase/PostgREST foram removidos do
projeto. A stack ativa de dados é `Prisma + PostgreSQL`, com autenticação local
e uploads em storage local.
