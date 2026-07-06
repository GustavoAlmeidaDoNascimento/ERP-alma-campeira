-- AlterTable
ALTER TABLE "facas" ADD COLUMN     "cst_cofins" TEXT,
ADD COLUMN     "cst_icms" TEXT,
ADD COLUMN     "cst_pis" TEXT;

-- CreateTable
CREATE TABLE "categorias_faca" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "cor_texto" TEXT,
    "cor_fundo" TEXT,
    "cor_borda" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_faca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_materia_prima" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_materia_prima_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categorias_consumivel" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "categorias_consumivel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consumiveis" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "fornecedor_id" UUID,
    "foto_url" TEXT,
    "preco_custo" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "estoque_atual" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "estoque_minimo" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "consumiveis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tipos_gasto" (
    "id" UUID NOT NULL,
    "nome" TEXT NOT NULL,
    "sistema" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "tipos_gasto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "entradas" (
    "id" UUID NOT NULL,
    "descricao" TEXT NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "forma_pagamento" TEXT NOT NULL,
    "data_entrada" DATE NOT NULL,
    "categoria" TEXT,
    "observacao" TEXT,
    "usuario_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entradas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "empresa" (
    "id" UUID NOT NULL,
    "razao_social" TEXT NOT NULL,
    "nome_fantasia" TEXT,
    "cnpj" TEXT NOT NULL,
    "ie" TEXT,
    "im" TEXT,
    "crt" INTEGER NOT NULL,
    "cep" TEXT,
    "logradouro" TEXT,
    "numero" TEXT,
    "complemento" TEXT,
    "bairro" TEXT,
    "cidade" TEXT,
    "uf" TEXT,
    "codigo_municipio_ibge" TEXT,
    "telefone" TEXT,
    "email" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_config" (
    "id" INTEGER NOT NULL,
    "taxa_producao_lucro" DECIMAL(14,2),
    "margem_lucro" DECIMAL(14,2),
    "taxa_comissao_lucro" DECIMAL(14,2),
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "app_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orcamentos" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "cliente_id" UUID,
    "vendedor_id" UUID,
    "data_orcamento" VARCHAR(10) NOT NULL,
    "observacao" TEXT,
    "frete" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "desconto_total" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "valor_total" DECIMAL(10,2),
    "convertido_pedido_id" UUID,
    "convertido_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orcamentos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orcamento_itens" (
    "id" UUID NOT NULL,
    "orcamento_id" UUID NOT NULL,
    "faca_id" UUID NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "preco_unitario" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orcamento_itens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" UUID,
    "user_name" TEXT,
    "user_email" TEXT,
    "action" TEXT NOT NULL,
    "table_name" TEXT NOT NULL,
    "record_id" TEXT,
    "old_data" JSONB,
    "new_data" JSONB,
    "changed_fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ip_address" TEXT,
    "user_agent" TEXT,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "consumiveis_codigo_key" ON "consumiveis"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "tipos_gasto_nome_key" ON "tipos_gasto"("nome");

-- CreateIndex
CREATE INDEX "idx_entradas_data" ON "entradas"("data_entrada" DESC);

-- CreateIndex
CREATE INDEX "idx_entradas_usuario" ON "entradas"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "orcamentos_codigo_key" ON "orcamentos"("codigo");

-- CreateIndex
CREATE INDEX "idx_orcamentos_cliente" ON "orcamentos"("cliente_id");

-- CreateIndex
CREATE INDEX "idx_orcamentos_vendedor" ON "orcamentos"("vendedor_id");

-- CreateIndex
CREATE INDEX "idx_orcamentos_created_at" ON "orcamentos"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_orcamento_itens_orcamento" ON "orcamento_itens"("orcamento_id");

-- CreateIndex
CREATE INDEX "idx_orcamento_itens_faca" ON "orcamento_itens"("faca_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_logs_table_name" ON "audit_logs"("table_name");

-- CreateIndex
CREATE INDEX "idx_audit_logs_user_id" ON "audit_logs"("user_id");

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_materia_prima_id_fkey" FOREIGN KEY ("materia_prima_id") REFERENCES "materias_primas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_faca_id_fkey" FOREIGN KEY ("faca_id") REFERENCES "facas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_consumivel_id_fkey" FOREIGN KEY ("consumivel_id") REFERENCES "consumiveis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacoes_estoque" ADD CONSTRAINT "movimentacoes_estoque_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios_perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios_perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consumiveis" ADD CONSTRAINT "consumiveis_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entradas" ADD CONSTRAINT "entradas_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios_perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "usuarios_perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamentos" ADD CONSTRAINT "orcamentos_convertido_pedido_id_fkey" FOREIGN KEY ("convertido_pedido_id") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamento_itens" ADD CONSTRAINT "orcamento_itens_orcamento_id_fkey" FOREIGN KEY ("orcamento_id") REFERENCES "orcamentos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orcamento_itens" ADD CONSTRAINT "orcamento_itens_faca_id_fkey" FOREIGN KEY ("faca_id") REFERENCES "facas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
