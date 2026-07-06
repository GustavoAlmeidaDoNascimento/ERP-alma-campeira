/*
  Warnings:

  - A unique constraint covering the columns `[tipo,sequencial]` on the table `boletos` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "boletos" ADD COLUMN     "ordem_compra_id" UUID,
ADD COLUMN     "sequencial" BIGINT;

-- CreateTable
CREATE TABLE "ordens_compra" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "fornecedor_id" UUID,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "forma_pagamento" TEXT,
    "data_geracao" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacao" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ordens_compra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gastos" (
    "id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "forma_pagamento" TEXT NOT NULL,
    "data_gasto" DATE NOT NULL,
    "ordem_compra_id" UUID,
    "boleto_parcela_id" UUID,
    "observacao" TEXT,
    "usuario_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gastos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ordens_compra_codigo_key" ON "ordens_compra"("codigo");

-- CreateIndex
CREATE INDEX "idx_gastos_data" ON "gastos"("data_gasto" DESC);

-- CreateIndex
CREATE INDEX "idx_gastos_tipo" ON "gastos"("tipo");

-- CreateIndex
CREATE INDEX "idx_gastos_oc" ON "gastos"("ordem_compra_id");

-- CreateIndex
CREATE INDEX "idx_gastos_boleto_parcela" ON "gastos"("boleto_parcela_id");

-- CreateIndex
CREATE INDEX "idx_boletos_oc" ON "boletos"("ordem_compra_id");

-- CreateIndex
CREATE UNIQUE INDEX "boletos_tipo_sequencial_key" ON "boletos"("tipo", "sequencial");

-- AddForeignKey
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_ordem_compra_id_fkey" FOREIGN KEY ("ordem_compra_id") REFERENCES "ordens_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_compra" ADD CONSTRAINT "ordens_compra_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_ordem_compra_id_fkey" FOREIGN KEY ("ordem_compra_id") REFERENCES "ordens_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_boleto_parcela_id_fkey" FOREIGN KEY ("boleto_parcela_id") REFERENCES "boleto_parcelas"("id") ON DELETE SET NULL ON UPDATE CASCADE;
