# Alma Campeira

ERP sob medida para uma **cutelaria artesanal**: controla estoque de matérias-primas e facas, monta o custo a partir da BOM, acompanha vendas e orçamentos, e gera ordens de compra por fornecedor a partir da necessidade de reposição.

Feito para o dia a dia da oficina — não é um ERP genérico com módulos desligados. O fluxo vai do aço e do cabo até o pedido entregue e a compra que repõe o estoque.

Este repositório é o **código de um sistema em uso por clientes reais** (oficinas/cutelarias), não só um demo de portfólio.

### Open source ≠ acesso à instalação do cliente

Publicar o código aqui **não abre a porta** das instâncias em produção. O que está no GitHub é o *software*; o que o cliente usa é uma cópia **privada**, rodando no servidor/rede dele, com banco, `JWT_SECRET`, senhas e dados **fora** deste repositório. Quem lê o código não ganha URL, credencial nem VPN da oficina — e a autenticação (JWT + cookie httpOnly + permissões) continua no servidor. Em resumo: código aberto mostra *como* o ERP funciona; invadir exigiria acesso à máquina ou às chaves do cliente, que este repo não entrega.


<p align="center">
  <img src="docs/screenshots/06-metricas.png" alt="Relatórios e métricas comerciais" width="900" />
</p>

## Telas

| Relatórios | Catálogo de facas |
|:---:|:---:|
| ![Métricas](docs/screenshots/06-metricas.png) | ![Facas](docs/screenshots/03-facas.png) |

| Vendas | Matérias-primas |
|:---:|:---:|
| ![Vendas](docs/screenshots/05-vendas.png) | ![Matérias-primas](docs/screenshots/04-materias-primas.png) |

| Ordens de compra | Orçamentos |
|:---:|:---:|
| ![Ordens de compra](docs/screenshots/07-ordens-compra.png) | ![Orçamentos](docs/screenshots/08-orcamentos.png) |

| Clientes | Login |
|:---:|:---:|
| ![Clientes](docs/screenshots/09-clientes.png) | ![Login](docs/screenshots/01-login.png) |

## O que o sistema cobre

- **Estoque** — matérias-primas, facas (com SKU, custo, preço e margem) e consumíveis
- **Composição (BOM)** — cada faca ligada às MPs usadas na fabricação; custo e reposição saem daí
- **Compras** — fornecedores, fila de reposição e geração de ordens de compra agrupadas por fornecedor
- **Vendas** — pedidos com status (produção, pagamento, entrega), clientes (PF, lojista, revendedor)
- **Orçamentos** — propostas que podem virar venda; exportação em PDF
- **Financeiro** — boletos/parcelas, gastos, movimentação de estoque
- **Relatórios** — faturamento, ticket médio, taxa de entrega, visão financeira e de estoque por período
- **Acesso** — usuários, cargos e permissões por módulo (`ver` / `criar` / `editar` / `deletar`)

## Como eu construí

Stack principal: **Next.js (App Router) + TypeScript + Tailwind + TanStack Query**, com **Prisma + PostgreSQL**.

Arquitetura em camadas simples e explícitas:

1. **UI** em `src/components/*` e rotas em `src/app/(erp)/*`
2. **Server Actions** em `src/lib/actions/*` — a regra de negócio fica no servidor, perto do banco
3. **Prisma** como única camada de dados (`prisma/schema.prisma` + migrations)
4. **Auth própria** — JWT assinado com `jose`, hash com `bcryptjs`, cookie httpOnly `erp-session`
5. **Uploads** em filesystem local (sem depender de storage externo)

A autenticação e as permissões atravessam as actions: cada operação sensível valida sessão e matriz de permissão (por cargo ou override por usuário). Módulos só-leitura (dashboard, métricas) expõem só a coluna `ver`.

## Stack

| Camada | Tecnologia | Papel no projeto |
|--------|------------|------------------|
| Frontend | Next.js 16, React 19, Tailwind 4 | App Router, UI do ERP |
| Dados no client | TanStack Query | Cache e invalidação das listagens |
| Backend | Server Actions + Route Handlers | Mutations e `/api/auth/*` |
| ORM / DB | Prisma 6 + PostgreSQL | Schema tipado e migrations |
| Auth | `jose` + `bcryptjs` + cookie httpOnly | Sessão local sem Auth-as-a-Service |
| PDF | jsPDF + autotable | Pedidos e orçamentos impressos |
| Qualidade | Playwright, ESLint | Smoke/e2e de navegação |

> Migração concluída para **Prisma-only**: sem Supabase, sem PostgREST e sem client SQL solto.

## Destaques de implementação

- **Reposição inteligente** — ao entregar um pedido, o sistema analisa o consumo de MPs via BOM e alimenta uma fila de reposição; a partir dela gera OCs por fornecedor (`src/lib/ordens-compra/`)
- **Custo de faca derivado da composição** — preço de custo acompanha as matérias-primas da BOM, não um número solto na tela
- **Permissões em matriz** — cargos + overrides por usuário, com cache (`unstable_cache`) e invalidação sob mutação
- **Sessão consciente de HTTP** — `COOKIE_SECURE` configurável para não perder cookie em ambiente local sem TLS (evita loop de redirect no login)
- **Métricas de negócio** — KPIs de vendas, financeiro e estoque com filtros de período (`src/lib/actions/metricas.ts`)
- **PDFs de documento** — orçamento e pedido gerados no browser para o fluxo comercial

## Estrutura do repositório

```
src/app/(erp)/     # páginas do ERP (estoque, vendas, compras, financeiro…)
src/app/api/auth/  # login / logout / sessão
src/components/    # UI por domínio
src/lib/actions/   # Server Actions
src/lib/ordens-compra/  # análise de reposição + geração de OC
prisma/            # schema e migrations
docs/screenshots/  # prints usados neste README
scripts/           # bootstrap de admin, seed demo, helpers Prisma
```

## Rodar local

Pré-requisitos: Node.js e PostgreSQL em `localhost:5432` (database `erp_alma`). Detalhes em [`DEV-LOCAL.md`](DEV-LOCAL.md).

```bash
npm install
cp .env.example .env.local   # ajuste JWT_SECRET; COOKIE_SECURE=false em HTTP
npm run db:up                # se usar Docker; senão, Postgres local
npm run prisma:migrate:dev
npm run prisma:generate
npm run prisma:bootstrap:admin -- --email admin@local --password 'sua-senha' --nome "Admin"
npm run seed:demo            # opcional: dados fictícios para explorar a UI
npm run dev                  # http://localhost:3000
```

Variáveis mínimas no `.env.local`:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/erp_alma
JWT_SECRET=um-segredo-longo
COOKIE_SECURE=false
NEXT_PUBLIC_BASE_URL=http://localhost:3000
UPLOADS_DIR=./.uploads-local
```

---

Projeto de portfólio — ERP real para cutelaria artesanal, com domínio de estoque, vendas e compras modelado de ponta a ponta.
