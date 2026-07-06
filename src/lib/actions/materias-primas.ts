"use server";

import { Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { assertPermissao, requireAuthenticatedUserId } from "@/lib/auth";
import {
  fetchCategoriasMateriaPrimaList,
  fetchFornecedoresSelect,
  fetchMatériasPrimasList,
} from "@/lib/cache/list-data";
import { prisma } from "@/lib/prisma";
import type {
  MateriaPrima,
  MovimentacaoEstoque,
  Faca,
  Fornecedor,
  CategoriaMateriaPrimaDB,
} from "@/types";
import { gerarCodigoForte } from "@/lib/utils/codigo";
import { withTiming } from "@/lib/perf/timing";

async function revalidateMPLists() {
  const userId = await requireAuthenticatedUserId();
  revalidateTag(`list-materias-primas-${userId}`, "max");
  revalidateTag(`list-fornecedores-select-${userId}`, "max");
  revalidateTag(`list-categorias-mp-${userId}`, "max");
  // Custo das facas depende de preco_custo das MPs → invalida lista de facas também.
  revalidateTag(`list-facas-${userId}`, "max");
}

export async function getMatériasPrimas(limit?: number): Promise<MateriaPrima[]> {
  return withTiming("getMatériasPrimas", async () => {
    const userId = await requireAuthenticatedUserId();
    await assertPermissao("materias_primas", "ver");
    const rows = await fetchMatériasPrimasList(userId);
    return typeof limit === "number" ? rows.slice(0, limit) : rows;
  });
}

export async function gerarCodigoMP(): Promise<string> {
  return gerarCodigoForte("MP");
}

function numberFrom(value: Prisma.Decimal | number | string | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return Number(value) || 0;
}

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(Number.isFinite(value) ? value : 0);
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function throwFriendlyUniqueError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const targets = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [];
    if (
      (targets.includes("categoria") && targets.includes("sku")) ||
      targets.includes("materias_primas_categoria_sku_key")
    ) {
      throw new Error("Já existe uma matéria-prima com este SKU nesta categoria.");
    }
    if (targets.includes("codigo")) {
      throw new Error("Já existe uma matéria-prima com este código.");
    }
  }
  throw error;
}

function mapFornecedorDetalhe(
  row: {
    id: string;
    nome: string;
    telefone: string | null;
    email: string | null;
    tipoDocumento: "cnpj" | "cpf";
    documento: string | null;
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    razaoSocial: string | null;
    ie: string | null;
    codigoMunicipioIbge: string | null;
    createdAt: Date;
  } | null,
): Fornecedor | null {
  if (!row) return null;
  return {
    id: row.id,
    nome: row.nome,
    telefone: row.telefone,
    email: row.email,
    tipo_documento: row.tipoDocumento,
    documento: row.documento,
    cep: row.cep,
    logradouro: row.logradouro,
    numero: row.numero,
    complemento: row.complemento,
    bairro: row.bairro,
    cidade: row.cidade,
    uf: row.uf,
    razao_social: row.razaoSocial,
    ie: row.ie,
    codigo_municipio_ibge: row.codigoMunicipioIbge,
    created_at: row.createdAt.toISOString(),
  };
}

function mapMateriaPrimaDetalhe(row: {
  id: string;
  codigo: string;
  sku: string;
  nome: string;
  categoria: string;
  fornecedorId: string | null;
  fotoUrl: string | null;
  precoCusto: Prisma.Decimal;
  estoqueAtual: Prisma.Decimal;
  estoqueMinimo: Prisma.Decimal;
  createdAt: Date;
  fornecedor: {
    id: string;
    nome: string;
    telefone: string | null;
    email: string | null;
    tipoDocumento: "cnpj" | "cpf";
    documento: string | null;
    cep: string | null;
    logradouro: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    razaoSocial: string | null;
    ie: string | null;
    codigoMunicipioIbge: string | null;
    createdAt: Date;
  } | null;
}): MateriaPrima {
  return {
    id: row.id,
    codigo: row.codigo,
    sku: row.sku,
    nome: row.nome,
    categoria: row.categoria,
    fornecedor_id: row.fornecedorId,
    foto_url: row.fotoUrl,
    preco_custo: numberFrom(row.precoCusto),
    estoque_atual: numberFrom(row.estoqueAtual),
    estoque_minimo: numberFrom(row.estoqueMinimo),
    created_at: row.createdAt.toISOString(),
    fornecedor: mapFornecedorDetalhe(row.fornecedor),
  };
}

function mapMovimentacaoDetalhe(
  row: {
    id: string;
    tipo: string;
    materiaPrimaId: string | null;
    facaId: string | null;
    consumivelId: string | null;
    pedidoId: string | null;
    quantidade: number;
    observacao: string | null;
    usuarioId: string | null;
    createdAt: Date;
  },
  facasMap: Map<string, Pick<Faca, "id" | "codigo" | "nome">>,
  usuariosMap: Map<string, { id: string; nome: string }>,
): MovimentacaoEstoque {
  return {
    id: row.id,
    tipo: row.tipo as MovimentacaoEstoque["tipo"],
    materia_prima_id: row.materiaPrimaId,
    faca_id: row.facaId,
    consumivel_id: row.consumivelId,
    pedido_id: row.pedidoId,
    quantidade: row.quantidade,
    observacao: row.observacao,
    usuario_id: row.usuarioId,
    created_at: row.createdAt.toISOString(),
    faca: row.facaId ? (facasMap.get(row.facaId) ?? null) : null,
    usuario: row.usuarioId ? (usuariosMap.get(row.usuarioId) ?? null) : null,
  };
}

type MPInput = {
  sku: string;
  nome: string;
  categoria: string;
  fornecedor_id: string | null;
  preco_custo: number;
  estoque_atual: number;
  estoque_minimo: number;
};

function normalizeMPInput(input: MPInput, linha?: number): MPInput {
  const prefixo = linha ? `Linha ${linha}: ` : "";
  const sku = input.sku.trim();
  const nome = input.nome.trim();
  const categoria = input.categoria.trim();
  const preco_custo = Number(input.preco_custo);
  const estoque_atual = Number(input.estoque_atual || 0);
  const estoque_minimo = Number(input.estoque_minimo || 0);

  if (!sku) throw new Error(`${prefixo}sku é obrigatório.`);
  if (!nome) throw new Error(`${prefixo}nome é obrigatório.`);
  if (!categoria) throw new Error(`${prefixo}categoria é obrigatória.`);
  if (!Number.isFinite(preco_custo)) throw new Error(`${prefixo}preço de custo inválido.`);
  if (!Number.isFinite(estoque_atual)) throw new Error(`${prefixo}estoque atual inválido.`);
  if (!Number.isFinite(estoque_minimo)) throw new Error(`${prefixo}estoque mínimo inválido.`);

  return {
    sku,
    nome,
    categoria,
    fornecedor_id: input.fornecedor_id?.trim() || null,
    preco_custo,
    estoque_atual,
    estoque_minimo,
  };
}

export async function criarMateriaPrima(input: MPInput) {
  await assertPermissao("materias_primas", "criar");
  const normalized = normalizeMPInput(input);
  const codigo = await gerarCodigoMP();

  try {
    await prisma.materiaPrima.create({
      data: {
        codigo,
        sku: normalized.sku,
        nome: normalized.nome,
        categoria: normalized.categoria,
        fornecedorId: normalized.fornecedor_id,
        precoCusto: decimal(normalized.preco_custo),
        estoqueAtual: decimal(normalized.estoque_atual),
        estoqueMinimo: decimal(normalized.estoque_minimo),
      },
    });
  } catch (error) {
    throwFriendlyUniqueError(error);
  }
  await revalidateMPLists();
}

export async function criarMateriasPrimasEmLote(inputs: MPInput[]) {
  await assertPermissao("materias_primas", "criar");

  if (!Array.isArray(inputs) || inputs.length === 0) {
    throw new Error("Preencha ao menos uma linha válida para criar em massa.");
  }

  const normalizedInputs = inputs.map((input, index) => normalizeMPInput(input, index + 1));
  const skuCategoriaKeys = normalizedInputs.map(
    (input) => `${input.categoria.trim().toLowerCase()}::${input.sku.trim().toLowerCase()}`,
  );
  if (new Set(skuCategoriaKeys).size !== skuCategoriaKeys.length) {
    throw new Error("Existem SKUs duplicados na mesma categoria na planilha de criação em massa.");
  }
  const fornecedorIds = [
    ...new Set(
      normalizedInputs
        .map((input) => input.fornecedor_id)
        .filter((fornecedorId): fornecedorId is string => fornecedorId !== null),
    ),
  ];

  if (fornecedorIds.length > 0) {
    const fornecedores = await prisma.fornecedor.findMany({
      where: { id: { in: fornecedorIds } },
      select: { id: true },
    });
    const validos = new Set(fornecedores.map((fornecedor) => fornecedor.id));
    const fornecedorInvalido = normalizedInputs.find(
      (input) => input.fornecedor_id && !validos.has(input.fornecedor_id),
    );
    if (fornecedorInvalido?.fornecedor_id) {
      throw new Error("Um ou mais fornecedores selecionados não são válidos.");
    }
  }

  const codigos = await Promise.all(normalizedInputs.map(() => gerarCodigoMP()));

  try {
    await prisma.$transaction(async (tx) => {
      await tx.materiaPrima.createMany({
        data: normalizedInputs.map((input, index) => ({
          codigo: codigos[index],
          sku: input.sku,
          nome: input.nome,
          categoria: input.categoria,
          fornecedorId: input.fornecedor_id,
          precoCusto: decimal(input.preco_custo),
          estoqueAtual: decimal(input.estoque_atual),
          estoqueMinimo: decimal(input.estoque_minimo),
        })),
      });
    });
  } catch (error) {
    throwFriendlyUniqueError(error);
  }

  await revalidateMPLists();
}

export async function atualizarMateriaPrima(id: string, input: MPInput) {
  await assertPermissao("materias_primas", "editar");
  const normalized = normalizeMPInput(input);
  try {
    await prisma.materiaPrima.update({
      where: { id },
      data: {
        sku: normalized.sku,
        nome: normalized.nome,
        categoria: normalized.categoria,
        fornecedorId: normalized.fornecedor_id,
        precoCusto: decimal(normalized.preco_custo),
        estoqueAtual: decimal(normalized.estoque_atual),
        estoqueMinimo: decimal(normalized.estoque_minimo),
      },
    });
  } catch (error) {
    throwFriendlyUniqueError(error);
  }

  await revalidateMPLists();
}

export async function deletarMateriaPrima(id: string) {
  await assertPermissao("materias_primas", "deletar");
  const uso = await prisma.facaMateriaPrima.findFirst({
    where: { materiaPrimaId: id },
    select: { id: true },
  });

  if (uso) {
    throw new Error(
      "Esta matéria-prima está vinculada a uma ou mais facas e não pode ser excluída.",
    );
  }

  await prisma.materiaPrima.delete({ where: { id } });
  await revalidateMPLists();
}

// ============================================================
// Detalhe de Matéria-Prima
// ============================================================

type FacaComQuantidade = Pick<Faca, "id" | "codigo" | "nome" | "categoria" | "estoque_atual"> & {
  quantidade: number;
};

export type MPDetalheData = {
  mp: MateriaPrima;
  facasQueUsam: FacaComQuantidade[];
  movimentacoes: MovimentacaoEstoque[];
  usuariosRegistro: { id: string; nome: string }[];
};

export async function getMPDetalhe(mpId: string): Promise<MPDetalheData> {
  await assertPermissao("materias_primas", "ver");
  const [mp, bomRows, movRows, usuariosRows] = await Promise.all([
    prisma.materiaPrima.findUnique({
      where: { id: mpId },
      include: {
        fornecedor: true,
      },
    }),
    prisma.facaMateriaPrima.findMany({
      where: { materiaPrimaId: mpId },
      orderBy: { facaId: "asc" },
      include: {
        faca: {
          select: {
            id: true,
            codigo: true,
            nome: true,
            categoria: true,
            estoqueAtual: true,
          },
        },
      },
    }),
    prisma.movimentacaoEstoque.findMany({
      where: { materiaPrimaId: mpId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.usuarioPerfil.findMany({
      where: { ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
  ]);

  if (!mp) throw new Error("Matéria-prima não encontrada.");

  const facasQueUsam: FacaComQuantidade[] = bomRows.map((row) => {
    const faca: Pick<Faca, "id" | "codigo" | "nome" | "categoria" | "estoque_atual"> = {
      id: row.faca.id,
      codigo: row.faca.codigo,
      nome: row.faca.nome,
      categoria: row.faca.categoria,
      estoque_atual: Number(row.faca.estoqueAtual),
    };
    return { ...faca, quantidade: Number(row.quantidade) || 0 };
  });

  const facasRelacionadasIds = [
    ...new Set(movRows.map((mov) => mov.facaId).filter((id): id is string => Boolean(id))),
  ];
  const facasRelacionadas = facasRelacionadasIds.length
    ? await prisma.faca.findMany({
        where: { id: { in: facasRelacionadasIds } },
        select: { id: true, codigo: true, nome: true },
      })
    : [];

  const facasMap = new Map(
    facasRelacionadas.map((faca) => [
      faca.id,
      { id: faca.id, codigo: faca.codigo, nome: faca.nome } as Pick<Faca, "id" | "codigo" | "nome">,
    ]),
  );
  const usuariosMap = new Map(usuariosRows.map((u) => [u.id, { id: u.id, nome: u.nome }]));
  const movimentacoes = movRows.map((mov) => mapMovimentacaoDetalhe(mov, facasMap, usuariosMap));

  return {
    mp: mapMateriaPrimaDetalhe(mp),
    facasQueUsam,
    movimentacoes,
    usuariosRegistro: usuariosRows,
  };
}

// ============================================================
// Dados para o modal de edição (lazy — só carrega quando necessário)
// ============================================================

export type MPEditModalData = {
  fornecedores: Fornecedor[];
  categoriasMateriaPrima: CategoriaMateriaPrimaDB[];
};

export async function getMPEditModalData(): Promise<MPEditModalData> {
  return withTiming("getMPEditModalData", async () => {
    const userId = await requireAuthenticatedUserId();
    await assertPermissao("materias_primas", "ver");
    const [fornecedores, categoriasMateriaPrima] = await Promise.all([
      fetchFornecedoresSelect(userId),
      fetchCategoriasMateriaPrimaList(userId),
    ]);
    return {
      fornecedores: fornecedores as Fornecedor[],
      categoriasMateriaPrima,
    };
  });
}

// ============================================================
// Entrada de Estoque — Matéria-Prima
// ============================================================

export async function entradaEstoqueMP(
  mpId: string,
  quantidade: number,
  observacao: string | undefined,
  usuarioRegistroId: string,
): Promise<void> {
  await assertPermissao("materias_primas", "editar");

  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new Error("Quantidade deve ser maior que zero.");
  }
  if (!Number.isInteger(quantidade)) {
    throw new Error("Quantidade deve ser um número inteiro.");
  }
  if (!usuarioRegistroId) {
    throw new Error("Selecione o usuário que está registrando a entrada.");
  }

  await prisma.$transaction(async (tx) => {
    const [mp, usuarioRegistro] = await Promise.all([
      tx.materiaPrima.findUnique({
        where: { id: mpId },
        select: { id: true, estoqueAtual: true },
      }),
      tx.usuarioPerfil.findFirst({
        where: { id: usuarioRegistroId, ativo: true },
        select: { id: true },
      }),
    ]);

    if (!mp) throw new Error("Matéria-prima não encontrada.");
    if (!usuarioRegistro) throw new Error("Usuário selecionado não encontrado ou inativo.");

    const novoEstoque = round3(numberFrom(mp.estoqueAtual) + quantidade);

    await tx.movimentacaoEstoque.create({
      data: {
        tipo: "entrada",
        materiaPrimaId: mpId,
        quantidade,
        observacao: observacao?.trim() || null,
        usuarioId: usuarioRegistroId,
      },
    });

    await tx.materiaPrima.update({
      where: { id: mpId },
      data: { estoqueAtual: decimal(novoEstoque) },
    });
  });

  await revalidateMPLists();
}

// ============================================================
// Edição de Movimentação de Estoque
// ============================================================

type AtualizarMovInput = {
  movimentacaoId: string;
  quantidade: number;
  usuarioId: string;
  observacao?: string | null;
};

/**
 * Atualiza uma movimentação de estoque existente (quantidade, usuário, observação)
 * e reajusta o `estoque_atual` da matéria-prima relacionada para manter
 * a consistência do saldo — aplicando apenas o DELTA entre o valor antigo e o novo.
 *
 * Regras por tipo:
 *   - `entrada`  → estoque += (nova - antiga)
 *   - `ajuste`   → estoque += (nova - antiga)
 *   - `saida_*`  → estoque -= (nova - antiga)
 *
 * Requer permissão `movimentacoes_estoque.editar`.
 */
export async function atualizarMovimentacaoMP(input: AtualizarMovInput): Promise<void> {
  await assertPermissao("movimentacoes_estoque", "editar");

  const { movimentacaoId, quantidade, usuarioId, observacao } = input;

  if (!movimentacaoId) throw new Error("ID da movimentação é obrigatório.");
  if (!Number.isFinite(quantidade) || quantidade <= 0) {
    throw new Error("Quantidade deve ser maior que zero.");
  }
  if (!Number.isInteger(quantidade)) {
    throw new Error("Quantidade deve ser um número inteiro.");
  }
  if (!usuarioId) throw new Error("Selecione o usuário responsável.");

  await prisma.$transaction(async (tx) => {
    const movAtual = await tx.movimentacaoEstoque.findUnique({
      where: { id: movimentacaoId },
      select: {
        id: true,
        tipo: true,
        quantidade: true,
        materiaPrimaId: true,
      },
    });
    if (!movAtual) throw new Error("Movimentação não encontrada.");
    if (!movAtual.materiaPrimaId) {
      throw new Error("Esta movimentação não está ligada a uma matéria-prima.");
    }

    const usuario = await tx.usuarioPerfil.findUnique({
      where: { id: usuarioId },
      select: { id: true },
    });
    if (!usuario) throw new Error("Usuário não encontrado.");

    const mp = await tx.materiaPrima.findUnique({
      where: { id: movAtual.materiaPrimaId },
      select: { id: true, estoqueAtual: true },
    });
    if (!mp) throw new Error("Matéria-prima vinculada não encontrada.");

    const quantidadeAntiga = Number(movAtual.quantidade);
    const delta = quantidade - quantidadeAntiga;

    let novoEstoque: number;
    const tipo = movAtual.tipo;
    if (tipo === "entrada" || tipo === "ajuste") {
      novoEstoque = numberFrom(mp.estoqueAtual) + delta;
    } else if (tipo.startsWith("saida")) {
      novoEstoque = numberFrom(mp.estoqueAtual) - delta;
    } else {
      novoEstoque = numberFrom(mp.estoqueAtual);
    }

    novoEstoque = round3(novoEstoque);
    if (novoEstoque < 0) {
      throw new Error(
        `Operação inválida: o novo estoque ficaria negativo (${novoEstoque}). ` +
          "Ajuste antes o estoque manualmente ou corrija outra movimentação primeiro.",
      );
    }

    await tx.movimentacaoEstoque.update({
      where: { id: movimentacaoId },
      data: {
        quantidade,
        usuarioId,
        observacao: observacao?.trim() || null,
      },
    });

    if (delta !== 0 && novoEstoque !== numberFrom(mp.estoqueAtual)) {
      await tx.materiaPrima.update({
        where: { id: mp.id },
        data: { estoqueAtual: decimal(novoEstoque) },
      });
    }
  });

  await revalidateMPLists();
}
