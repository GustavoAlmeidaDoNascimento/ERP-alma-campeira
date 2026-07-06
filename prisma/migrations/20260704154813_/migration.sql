-- AlterTable
ALTER TABLE "ordens_compra" ADD COLUMN     "fila_reposicao_id" UUID;

-- CreateTable
CREATE TABLE "materias_primas" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT '',
    "fornecedor_id" UUID,
    "foto_url" TEXT,
    "preco_custo" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "estoque_atual" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "estoque_minimo" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "materias_primas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faca_materias_primas" (
    "id" UUID NOT NULL,
    "faca_id" UUID NOT NULL,
    "materia_prima_id" UUID NOT NULL,
    "quantidade" DECIMAL(14,4) NOT NULL,

    CONSTRAINT "faca_materias_primas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fila_reposicao" (
    "id" UUID NOT NULL,
    "pedido_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fila_reposicao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fila_reposicao_itens" (
    "id" UUID NOT NULL,
    "fila_id" UUID NOT NULL,
    "materia_prima_id" UUID NOT NULL,
    "quantidade_sugerida" DECIMAL(14,4) NOT NULL,
    "quantidade_adicional" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "selecionado" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fila_reposicao_itens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "materias_primas_codigo_key" ON "materias_primas"("codigo");

-- CreateIndex
CREATE INDEX "idx_faca_mp_faca_id" ON "faca_materias_primas"("faca_id");

-- CreateIndex
CREATE INDEX "idx_faca_mp_materia_prima_id" ON "faca_materias_primas"("materia_prima_id");

-- CreateIndex
CREATE INDEX "idx_fila_reposicao_pedido" ON "fila_reposicao"("pedido_id");

-- CreateIndex
CREATE INDEX "idx_fila_reposicao_status" ON "fila_reposicao"("status");

-- CreateIndex
CREATE INDEX "idx_fila_reposicao_itens_fila" ON "fila_reposicao_itens"("fila_id");

-- CreateIndex
CREATE INDEX "idx_fila_reposicao_itens_mp" ON "fila_reposicao_itens"("materia_prima_id");

-- AddForeignKey
ALTER TABLE "materias_primas" ADD CONSTRAINT "materias_primas_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faca_materias_primas" ADD CONSTRAINT "faca_materias_primas_faca_id_fkey" FOREIGN KEY ("faca_id") REFERENCES "facas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faca_materias_primas" ADD CONSTRAINT "faca_materias_primas_materia_prima_id_fkey" FOREIGN KEY ("materia_prima_id") REFERENCES "materias_primas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_reposicao" ADD CONSTRAINT "fila_reposicao_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_reposicao_itens" ADD CONSTRAINT "fila_reposicao_itens_fila_id_fkey" FOREIGN KEY ("fila_id") REFERENCES "fila_reposicao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fila_reposicao_itens" ADD CONSTRAINT "fila_reposicao_itens_materia_prima_id_fkey" FOREIGN KEY ("materia_prima_id") REFERENCES "materias_primas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_compra" ADD CONSTRAINT "ordens_compra_fila_reposicao_id_fkey" FOREIGN KEY ("fila_reposicao_id") REFERENCES "fila_reposicao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
