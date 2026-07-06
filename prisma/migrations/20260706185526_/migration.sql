-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('admin', 'gerente', 'producao', 'vendas');

-- CreateEnum
CREATE TYPE "TipoDocumento" AS ENUM ('cnpj', 'cpf');

-- CreateEnum
CREATE TYPE "Modulo" AS ENUM ('dashboard', 'metricas', 'materias_primas', 'movimentacoes_estoque', 'fornecedores', 'facas', 'consumiveis', 'preco_venda', 'estoque', 'vendas', 'orcamentos', 'clientes', 'ordens_compra', 'gastos', 'boletos', 'usuarios', 'cargos', 'lucro', 'taxas_lucro');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios_perfis" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "perfil" "PerfilUsuario" NOT NULL DEFAULT 'vendas',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "cargo_id" UUID,

    CONSTRAINT "usuarios_perfis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargos" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "descricao" TEXT,
    "cor" VARCHAR(20) NOT NULL,
    "criado_em" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cargos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargo_permissoes" (
    "id" UUID NOT NULL,
    "cargo_id" UUID NOT NULL,
    "modulo" "Modulo" NOT NULL,
    "ver" BOOLEAN NOT NULL DEFAULT false,
    "criar" BOOLEAN NOT NULL DEFAULT false,
    "editar" BOOLEAN NOT NULL DEFAULT false,
    "deletar" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "cargo_permissoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_permissoes" (
    "id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "modulo" "Modulo" NOT NULL,
    "ver" BOOLEAN NOT NULL DEFAULT false,
    "criar" BOOLEAN NOT NULL DEFAULT false,
    "editar" BOOLEAN NOT NULL DEFAULT false,
    "deletar" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "usuario_permissoes_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "facas" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
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
    "cst_icms" TEXT,
    "cst_pis" TEXT,
    "cst_cofins" TEXT,
    "origem" SMALLINT,
    "unidade" TEXT,
    "ean_gtin" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "materias_primas" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
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

-- CreateTable
CREATE TABLE "boletos" (
    "id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "sequencial" BIGINT,
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
    "ordem_compra_id" UUID,
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

-- CreateTable
CREATE TABLE "ordens_compra" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "fornecedor_id" UUID,
    "sequencial_fornecedor" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "pago" BOOLEAN NOT NULL DEFAULT false,
    "forma_pagamento" TEXT,
    "data_geracao" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "observacao" TEXT,
    "ultima_alteracao_usuario_id" UUID,
    "ultima_alteracao_em" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fila_reposicao_id" UUID,

    CONSTRAINT "ordens_compra_pkey" PRIMARY KEY ("id")
);

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
    "sku" TEXT NOT NULL,
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
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_usuarios_perfis_cargo_id" ON "usuarios_perfis"("cargo_id");

-- CreateIndex
CREATE INDEX "idx_usuarios_perfis_ativo" ON "usuarios_perfis"("ativo");

-- CreateIndex
CREATE UNIQUE INDEX "cargo_permissoes_cargo_id_modulo_key" ON "cargo_permissoes"("cargo_id", "modulo");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_permissoes_usuario_id_modulo_key" ON "usuario_permissoes"("usuario_id", "modulo");

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

-- CreateIndex
CREATE UNIQUE INDEX "facas_codigo_key" ON "facas"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "facas_sku_key" ON "facas"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "materias_primas_codigo_key" ON "materias_primas"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "materias_primas_categoria_sku_key" ON "materias_primas"("categoria", "sku");

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
CREATE INDEX "idx_boletos_oc" ON "boletos"("ordem_compra_id");

-- CreateIndex
CREATE UNIQUE INDEX "boletos_tipo_sequencial_key" ON "boletos"("tipo", "sequencial");

-- CreateIndex
CREATE INDEX "idx_boleto_parcelas_boleto" ON "boleto_parcelas"("boleto_id");

-- CreateIndex
CREATE INDEX "idx_boleto_parcelas_vencimento" ON "boleto_parcelas"("vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "boleto_parcelas_boleto_id_numero_key" ON "boleto_parcelas"("boleto_id", "numero");

-- CreateIndex
CREATE UNIQUE INDEX "ordens_compra_codigo_key" ON "ordens_compra"("codigo");

-- CreateIndex
CREATE INDEX "idx_ordens_compra_fornecedor" ON "ordens_compra"("fornecedor_id");

-- CreateIndex
CREATE INDEX "idx_ordens_compra_fila" ON "ordens_compra"("fila_reposicao_id");

-- CreateIndex
CREATE INDEX "idx_ordens_compra_ultima_alteracao_usuario" ON "ordens_compra"("ultima_alteracao_usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "ordens_compra_seq_fornecedor_key" ON "ordens_compra"("fornecedor_id", "sequencial_fornecedor");

-- CreateIndex
CREATE INDEX "idx_ordem_compra_itens_oc" ON "ordem_compra_itens"("ordem_compra_id");

-- CreateIndex
CREATE INDEX "idx_ordem_compra_itens_materia_prima_id" ON "ordem_compra_itens"("materia_prima_id");

-- CreateIndex
CREATE INDEX "idx_gastos_data" ON "gastos"("data_gasto" DESC);

-- CreateIndex
CREATE INDEX "idx_gastos_tipo" ON "gastos"("tipo");

-- CreateIndex
CREATE INDEX "idx_gastos_oc" ON "gastos"("ordem_compra_id");

-- CreateIndex
CREATE INDEX "idx_gastos_boleto_parcela" ON "gastos"("boleto_parcela_id");

-- CreateIndex
CREATE UNIQUE INDEX "consumiveis_codigo_key" ON "consumiveis"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "consumiveis_sku_key" ON "consumiveis"("sku");

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
ALTER TABLE "usuarios_perfis" ADD CONSTRAINT "usuarios_perfis_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "cargos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_perfis" ADD CONSTRAINT "usuarios_perfis_id_fkey" FOREIGN KEY ("id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_permissoes" ADD CONSTRAINT "cargo_permissoes_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "cargos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_permissoes" ADD CONSTRAINT "usuario_permissoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "usuarios_perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_usuarioPerfilId_fkey" FOREIGN KEY ("usuarioPerfilId") REFERENCES "usuarios_perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_faca_id_fkey" FOREIGN KEY ("faca_id") REFERENCES "facas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_vendedor_id_fkey" FOREIGN KEY ("vendedor_id") REFERENCES "usuarios_perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_criado_por_fkey" FOREIGN KEY ("criado_por") REFERENCES "usuarios_perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_ordem_compra_id_fkey" FOREIGN KEY ("ordem_compra_id") REFERENCES "ordens_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boletos" ADD CONSTRAINT "boletos_pedido_id_fkey" FOREIGN KEY ("pedido_id") REFERENCES "pedidos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "boleto_parcelas" ADD CONSTRAINT "boleto_parcelas_boleto_id_fkey" FOREIGN KEY ("boleto_id") REFERENCES "boletos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_compra" ADD CONSTRAINT "ordens_compra_fornecedor_id_fkey" FOREIGN KEY ("fornecedor_id") REFERENCES "fornecedores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_compra" ADD CONSTRAINT "ordens_compra_fila_reposicao_id_fkey" FOREIGN KEY ("fila_reposicao_id") REFERENCES "fila_reposicao"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordens_compra" ADD CONSTRAINT "ordens_compra_ultima_alteracao_usuario_id_fkey" FOREIGN KEY ("ultima_alteracao_usuario_id") REFERENCES "usuarios_perfis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_compra_itens" ADD CONSTRAINT "ordem_compra_itens_ordem_compra_id_fkey" FOREIGN KEY ("ordem_compra_id") REFERENCES "ordens_compra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ordem_compra_itens" ADD CONSTRAINT "ordem_compra_itens_materia_prima_id_fkey" FOREIGN KEY ("materia_prima_id") REFERENCES "materias_primas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_ordem_compra_id_fkey" FOREIGN KEY ("ordem_compra_id") REFERENCES "ordens_compra"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_boleto_parcela_id_fkey" FOREIGN KEY ("boleto_parcela_id") REFERENCES "boleto_parcelas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
