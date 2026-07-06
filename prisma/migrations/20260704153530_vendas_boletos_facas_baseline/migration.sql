-- CreateTable
CREATE TABLE "facas" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "categoria" TEXT NOT NULL,
    "foto_url" TEXT,
    "taxa_producao" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "taxa_venda" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "preco_venda" DECIMAL(10,2) NOT NULL,
    "estoque_atual" INTEGER NOT NULL DEFAULT 0,
    "estoque_minimo" INTEGER NOT NULL DEFAULT 0,
    "ncm" TEXT,
    "cfop_padrao" TEXT,
    "origem" SMALLINT,
    "unidade" TEXT,
    "ean_gtin" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boletos" (
    "id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "contraparte_nome" TEXT NOT NULL,
    "cnpj_cpf" TEXT,
    "cliente_id" UUID,
    "fornecedor_id" UUID,
    "vendedor_id" UUID,
    "unidades" INTEGER,
    "numero_documento" TEXT,
    "valor_total" DECIMAL(14,2) NOT NULL,
    "emitido_em" DATE,
    "observacao" TEXT,
    "criado_por" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pedido_id" UUID,

    CONSTRAINT "boletos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "boleto_parcelas" (
    "id" UUID NOT NULL,
    "boleto_id" UUID NOT NULL,
    "numero" SMALLINT NOT NULL,
    "vencimento" DATE NOT NULL,
    "valor" DECIMAL(14,2) NOT NULL,
    "pago_em" DATE,
    "valor_pago" DECIMAL(14,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "boleto_parcelas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "facas_codigo_key" ON "facas"("codigo");

-- CreateIndex
CREATE INDEX "idx_boletos_tipo" ON "boletos"("tipo");

-- CreateIndex
CREATE INDEX "idx_boletos_cliente" ON "boletos"("cliente_id");

-- CreateIndex
CREATE INDEX "idx_boletos_fornecedor" ON "boletos"("fornecedor_id");

-- CreateIndex
CREATE INDEX "idx_boletos_emitido_em" ON "boletos"("emitido_em" DESC);

-- CreateIndex
CREATE INDEX "idx_boletos_created_at" ON "boletos"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_boleto_parcelas_boleto" ON "boleto_parcelas"("boleto_id");

-- CreateIndex
CREATE INDEX "idx_boleto_parcelas_vencimento" ON "boleto_parcelas"("vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "boleto_parcelas_boleto_id_numero_key" ON "boleto_parcelas"("boleto_id", "numero");

-- AddForeignKey
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_faca_id_fkey" FOREIGN KEY ("faca_id") REFERENCES "facas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "usuarios_perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "usuarios_perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boleto_parcelas" ADD CONSTRAINT "boleto_parcelas_boleto_id_fkey" FOREIGN KEY ("boleto_id") REFERENCES "boletos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
