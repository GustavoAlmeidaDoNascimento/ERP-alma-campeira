# Rodar localmente

Stack local: **Next.js + Prisma + PostgreSQL**.

Fonte da verdade do ambiente de desenvolvimento:

- host: `localhost`
- porta: `5432`
- database: `erp_alma`

## 1. Pré-requisitos

- Node.js instalado
- Docker Desktop rodando

## 2. Configurar `.env.local`

Use este mínimo:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/erp_alma
JWT_SECRET=troque-por-um-segredo-longo
COOKIE_SECURE=false
NEXT_PUBLIC_BASE_URL=http://localhost:3000
UPLOADS_DIR=./.uploads-local
```

## 3. Subir o PostgreSQL local

```bash
npm run db:up
```

## 4. Aplicar schema e gerar client Prisma

```bash
npm run prisma:migrate:dev
npm run prisma:generate
npm run prisma:validate
```

## 5. Rodar a aplicação

```bash
npm run dev
```

App local:

- `http://localhost:3000`

## Comandos úteis

| Comando | O quê |
|---------|-------|
| `npm run db:up` | sobe o PostgreSQL local |
| `npm run db:down` | derruba o container do PostgreSQL |
| `docker compose down -v` | apaga o volume local do banco |
| `npm run prisma:studio` | abre o Prisma Studio |
