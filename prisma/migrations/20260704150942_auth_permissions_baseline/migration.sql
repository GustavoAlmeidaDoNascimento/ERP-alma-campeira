-- CreateEnum
CREATE TYPE "PerfilUsuario" AS ENUM ('admin', 'gerente', 'producao', 'vendas');

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

-- AddForeignKey
ALTER TABLE "usuarios_perfis" ADD CONSTRAINT "usuarios_perfis_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "cargos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios_perfis" ADD CONSTRAINT "usuarios_perfis_id_fkey" FOREIGN KEY ("id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargo_permissoes" ADD CONSTRAINT "cargo_permissoes_cargo_id_fkey" FOREIGN KEY ("cargo_id") REFERENCES "cargos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_permissoes" ADD CONSTRAINT "usuario_permissoes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
