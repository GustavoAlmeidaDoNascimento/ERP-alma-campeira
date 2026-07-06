/*
  Warnings:

  - A unique constraint covering the columns `[fornecedor_id,sequencial_fornecedor]` on the table `ordens_compra` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "ordens_compra" ADD COLUMN     "sequencial_fornecedor" INTEGER,
ADD COLUMN     "ultima_alteracao_em" TIMESTAMPTZ(6),
ADD COLUMN     "ultima_alteracao_usuario_id" UUID;

-- CreateTable
CREATE TABLE "ordem_compra_itens" (
    "id" UUID NOT NULL,
    "ordem_compra_id" UUID NOT NULL,
    "materia_prima_id" UUID NOT NULL,
    "quantidade" DECIMAL(14,4) NOT NULL,
    "quantidade_vendida" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "quantidade_adicional" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "preco_unitario" DECIMAL(14,2),

    CONSTRAINT "ordem_compra_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_ordem_compra_itens_oc" ON "ordem_compra_itens"("ordem_compra_id");

-- CreateIndex
CREATE INDEX "idx_ordem_compra_itens_materia_prima_id" ON "ordem_compra_itens"("materia_prima_id");

-- CreateIndex
CREATE INDEX "idx_ordens_compra_fornecedor" ON "ordens_compra"("fornecedor_id");

-- CreateIndex
CREATE INDEX "idx_ordens_compra_fila" ON "ordens_compra"("fila_reposicao_id");

-- CreateIndex
CREATE INDEX "idx_ordens_compra_ultima_alteracao_usuario" ON "ordens_compra"("ultima_alteracao_usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "ordens_compra_seq_fornecedor_key" ON "ordens_compra"("fornecedor_id", "sequencial_fornecedor");

-- AddForeignKey
ALTER TABLE "ordens_compra" ADD CONSTRAINT "ordens_compra_ultima_alteracao_usuario_id_fkey" FOREIGN KEY ("ultima_alteracao_usuario_id") REFERENCES "usuarios_perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_compra_itens" ADD CONSTRAINT "ordem_compra_itens_ordem_compra_id_fkey" FOREIGN KEY ("ordem_compra_id") REFERENCES "ordens_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_compra_itens" ADD CONSTRAINT "ordem_compra_itens_materia_prima_id_fkey" FOREIGN KEY ("materia_prima_id") REFERENCES "materias_primas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
