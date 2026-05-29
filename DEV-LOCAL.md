# Rodar localmente (Docker + dados da produção)

Stack: **Next.js** (no host) + **Postgres** e **PostgREST** (em Docker).
O banco local é uma cópia da produção, puxada sob demanda (mão única: prod → local).

## 1. Pré-requisitos (uma vez)

- Docker Desktop rodando
- Acesso SSH à VPS
- `pg_dump`/`psql` **não** precisam estar instalados no Windows — rodam dentro do container/VPS.

## 2. Configurar os segredos

### `.env` (só pro docker compose)
Crie na raiz um arquivo `.env` com a **mesma** `JWT_SECRET` da VPS:

```
JWT_SECRET=<copie o valor exato do .env.local da VPS>
```

> Por que igual? As chaves anon/service_role são JWTs assinados com essa secret.
> Se a secret local for diferente, o PostgREST rejeita as chaves e nada autentica.

### `.env.local` (pro Next.js)
Copie o `.env.local` da VPS e ajuste só os endereços pra apontar pro local:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/erp_alma
NEXT_PUBLIC_SUPABASE_URL=http://localhost:3001
# JWT_SECRET, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e SUPABASE_SERVICE_ROLE_KEY:
# copie IGUAL da VPS (mesma secret => mesmas chaves continuam válidas)
NEXT_PUBLIC_BASE_URL=http://localhost:3000
UPLOADS_DIR=./.uploads-local
```

## 3. Subir o banco

```
npm run db:up      # sobe Postgres (5432) e PostgREST (3001)
```

Na primeira subida, os roles (anon/authenticated/service_role/authenticator)
são criados automaticamente (`supabase/_local/01_roles.sql`).

## 4. Puxar dados da produção

```
npm run db:pull                 # estrutura + dados
# ou, sem dados de produção:
powershell -File scripts/db-pull.ps1 -SchemaOnly
# usuário SSH diferente:
powershell -File scripts/db-pull.ps1 -VpsUser ubuntu
```

Rode `db:pull` sempre que quiser uma cópia fresca da produção.

## 5. Rodar o app

```
npm run dev        # http://localhost:3000
```

## Comandos úteis

| Comando | O quê |
|---------|-------|
| `npm run db:up` | sobe os containers |
| `npm run db:down` | derruba os containers (mantém os dados no volume) |
| `npm run db:pull` | re-sincroniza o banco local com a produção |
| `docker compose down -v` | apaga TUDO (zera o volume; roles recriados no próximo `up`) |

## Por que não sync nos dois sentidos?

Sync bidirecional em tempo real exige replicação de banco — complexo e perigoso
(seu dev poderia escrever em produção, ou um bug local corromper dados reais).
O fluxo seguro é tratar produção como fonte da verdade e puxar cópias pra dev.
Mudanças de schema continuam indo via migrations versionadas em `supabase/`.
