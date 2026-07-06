-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('cnpj', 'cpf');

-- CreateTable
CREATE TABLE "clientes" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "tipo_documento" "TipoDocumento" NOT NULL DEFAULT 'cnpj',
    "documento" TEXT,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "estado" TEXT,
    "razao_social" TEXT,
    "ie" TEXT,
    "indicador_ie" SMALLINT DEFAULT 9,
    "codigo_municipio_ibge" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fornecedores" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT,
    "tipo_documento" "TipoDocumento" NOT NULL DEFAULT 'cnpj',
    "documento" TEXT,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "razao_social" TEXT,
    "ie" TEXT,
    "codigo_municipio_ibge" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fornecedores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedidos" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "sequencial" BIGINT,
    "cliente_id" UUID,
    "vendedor_id" UUID,
    "data_pedido" VARCHAR(10) NOT NULL,
    "status" TEXT NOT NULL,
    "observacao" TEXT,
    "valor_total" DECIMAL(10,2),
    "frete" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "desconto_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "natureza_operacao" TEXT DEFAULT 'VENDA DE MERCADORIA',
    "forma_pagamento" TEXT,
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "entregue_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioPerfilId" UUID,

    CONSTRAINT "pedidos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pedido_itens" (
    "id" UUID NOT NULL,
    "pedido_id" UUID NOT NULL,
    "faca_id" UUID NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "preco_unitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2),
    "ncm" TEXT,
    "cfop" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pedido_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movimentacoes_estoque" (
    "id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "materia_prima_id" UUID,
    "faca_id" UUID,
    "consumivel_id" UUID,
    "pedido_id" UUID,
    "quantidade" INTEGER NOT NULL,
    "observacao" TEXT,
    "usuario_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacoes_estoque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_clientes_nome" ON "clientes"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "pedidos_codigo_key" ON "pedidos"("codigo");

-- CreateIndex
CREATE INDEX "idx_pedidos_cliente_id" ON "pedidos"("cliente_id");

-- CreateIndex
CREATE INDEX "idx_pedidos_vendedor_id" ON "pedidos"("vendedor_id");

-- CreateIndex
CREATE INDEX "idx_pedidos_status" ON "pedidos"("status");

-- CreateIndex
CREATE INDEX "idx_pedidos_created_at" ON "pedidos"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_pedido_itens_pedido_id" ON "pedido_itens"("pedido_id");

-- CreateIndex
CREATE INDEX "idx_pedido_itens_faca_id" ON "pedido_itens"("faca_id");

-- CreateIndex
CREATE INDEX "idx_mov_estoque_created_at" ON "movimentacoes_estoque"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_mov_estoque_materia_prima_id" ON "movimentacoes_estoque"("materia_prima_id");

-- CreateIndex
CREATE INDEX "idx_mov_estoque_faca_id" ON "movimentacoes_estoque"("faca_id");

-- CreateIndex
CREATE INDEX "idx_mov_estoque_usuario_id" ON "movimentacoes_estoque"("usuario_id");

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "usuarios_perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_usuarioPerfilId_fkey" FOREIGN KEY ("usuarioPerfilId") REFERENCES "usuarios_perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
