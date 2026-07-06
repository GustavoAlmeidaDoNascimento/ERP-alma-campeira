"use server";

import { Prisma } from "@prisma/client";
import { assertPermissao, requireAuthenticatedUserId } from "@/lib/auth";
import type {
  Faca,
  FacaMateriaPrima,
  MaterialInsuficiente,
  MateriaPrima,
  MovimentacaoEstoque,
  PedidoItemComPedido,
  StatusPedido,
} from "@/types";
import { gerarCodigoForte } from "@/lib/utils/codigo";
import { withTiming } from "@/lib/perf/timing";
import { fetchFacasComCustoList } from "@/lib/cache/list-data";
import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";

async function revalidateFacasLists() {
  try {
    const userId = await requireAuthenticatedUserId();
    revalidateTag(`list-facas-${userId}`, "max");
    revalidateTag(`list-materias-primas-${userId}`, "max");
  } catch {}
}

type FacaRow = {
  id: string;
  codigo: string;
  sku: string;
  nome: string;
  categoria: string;
  fotoUrl: string | null;
  taxaProducao: Prisma.Decimal | number | string | null;
  taxaVenda: Prisma.Decimal | number | string | null;
  precoVenda: Prisma.Decimal | number | string | null;
  estoqueAtual: number | string | null;
  estoqueMinimo: number | string | null;
  ncm: string | null;
  cfopPadrao: string | null;
  cstIcms: string | null;
  cstPis: string | null;
  cstCofins: string | null;
  origem: number | null;
  unidade: string | null;
  eanGtin: string | null;
  createdAt: Date | string;
};

type MovimentacaoRow = {
  id: string;
  tipo: string;
  materia_prima_id: string | null;
  faca_id: string | null;
  consumivel_id: string | null;
  pedido_id: string | null;
  quantidade: Prisma.Decimal | number | string;
  observacao: string | null;
  usuario_id: string | null;
  created_at: Date | string;
};

function numberFrom(value: Prisma.Decimal | number | string | bigint | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return Number(value) || 0;
}

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(Number.isFinite(value) ? value : 0);
}

function isoFrom(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function round3(n: number) {
  return Math.round(n * 1000) / 1000;
}

function mapFacaRow(row: FacaRow, extra?: Partial<Faca>): Faca {
  return {
    id: row.id,
    codigo: row.codigo,
    sku: row.sku,
    nome: row.nome,
    categoria: row.categoria,
    foto_url: row.fotoUrl,
    taxa_producao: numberFrom(row.taxaProducao),
    taxa_venda: numberFrom(row.taxaVenda),
    preco_venda: numberFrom(row.precoVenda),
    estoque_atual: numberFrom(row.estoqueAtual),
    estoque_minimo: numberFrom(row.estoqueMinimo),
    ncm: row.ncm,
    cfop_padrao: row.cfopPadrao,
    cst_icms: row.cstIcms,
    cst_pis: row.cstPis,
    cst_cofins: row.cstCofins,
    origem: row.origem,
    unidade: row.unidade,
    ean_gtin: row.eanGtin,
    created_at: isoFrom(row.createdAt),
    ...extra,
  };
}

function mapMateriaPrimaRow(row: {
  id: string;
  codigo: string;
  sku: string;
  nome: string;
  precoCusto: Prisma.Decimal;
  estoqueAtual: Prisma.Decimal;
  estoqueMinimo: Prisma.Decimal;
  fotoUrl: string | null;
  fornecedorId: string | null;
  createdAt: Date;
}): MateriaPrima {
  return {
    id: row.id,
    codigo: row.codigo,
    sku: row.sku,
    nome: row.nome,
    categoria: "",
    fornecedor_id: row.fornecedorId,
    foto_url: row.fotoUrl,
    preco_custo: numberFrom(row.precoCusto),
    estoque_atual: numberFrom(row.estoqueAtual),
    estoque_minimo: numberFrom(row.estoqueMinimo),
    created_at: row.createdAt.toISOString(),
  };
}

function mapMovimentacaoRow(
  row: MovimentacaoRow,
  usuariosMap: Map<string, { id: string; nome: string }>,
  materiaPrimaMap?: Map<string, Pick<MateriaPrima, "id" | "codigo" | "nome">>,
): MovimentacaoEstoque {
  return {
    id: row.id,
    tipo: row.tipo as MovimentacaoEstoque["tipo"],
    materia_prima_id: row.materia_prima_id,
    faca_id: row.faca_id,
    consumivel_id: row.consumivel_id,
    pedido_id: row.pedido_id,
    quantidade: numberFrom(row.quantidade),
    observacao: row.observacao,
    usuario_id: row.usuario_id,
    created_at: isoFrom(row.created_at),
    materia_prima: row.materia_prima_id
      ? (materiaPrimaMap?.get(row.materia_prima_id) ?? null)
      : null,
    faca: null,
    consumivel: null,
    usuario: row.usuario_id ? (usuariosMap.get(row.usuario_id) ?? null) : null,
  };
}

async function getFacaRows(limit: number): Promise<FacaRow[]> {
  return prisma.faca.findMany({
    orderBy: { codigo: "asc" },
    take: limit,
    select: {
      id: true,
      codigo: true,
      sku: true,
      nome: true,
      categoria: true,
      fotoUrl: true,
      taxaProducao: true,
      taxaVenda: true,
      precoVenda: true,
      estoqueAtual: true,
      estoqueMinimo: true,
      ncm: true,
      cfopPadrao: true,
      cstIcms: true,
      cstPis: true,
      cstCofins: true,
      origem: true,
      unidade: true,
      eanGtin: true,
      createdAt: true,
    },
  });
}

async function getFacaRowById(facaId: string): Promise<FacaRow | null> {
  return prisma.faca.findUnique({
    where: { id: facaId },
    select: {
      id: true,
      codigo: true,
      sku: true,
      nome: true,
      categoria: true,
      fotoUrl: true,
      taxaProducao: true,
      taxaVenda: true,
      precoVenda: true,
      estoqueAtual: true,
      estoqueMinimo: true,
      ncm: true,
      cfopPadrao: true,
      cstIcms: true,
      cstPis: true,
      cstCofins: true,
      origem: true,
      unidade: true,
      eanGtin: true,
      createdAt: true,
    },
  });
}

async function loadFacaBOM(facaId: string): Promise<FacaMateriaPrima[]> {
  const rows = await prisma.facaMateriaPrima.findMany({
    where: { facaId },
    orderBy: { id: "asc" },
    include: {
      materiaPrima: {
        select: {
          id: true,
          codigo: true,
          sku: true,
          nome: true,
          precoCusto: true,
          estoqueAtual: true,
          estoqueMinimo: true,
          fotoUrl: true,
          fornecedorId: true,
          createdAt: true,
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    faca_id: row.facaId,
    materia_prima_id: row.materiaPrimaId,
    quantidade: numberFrom(row.quantidade),
    materia_prima: mapMateriaPrimaRow(row.materiaPrima),
  }));
}

export async function getFacas(limit = 80, options?: { comCusto?: boolean }): Promise<Faca[]> {
  const comCusto = options?.comCusto ?? true;
  return withTiming(`getFacas${comCusto ? "" : "(sem custo)"}`, async () => {
    await assertPermissao("facas", "ver");
    if (comCusto) {
      const userId = await requireAuthenticatedUserId();
      const rows = await fetchFacasComCustoList(userId);
      return rows.slice(0, limit);
    }
    const rows = await getFacaRows(limit);
    return rows.map((row) => mapFacaRow(row, { preco_custo: 0 }));
  });
}

export async function getFacasCatalogoList(limit = 120): Promise<Faca[]> {
  await requireAuthenticatedUserId();
  const rows = await getFacaRows(limit);
  return rows.map((row) => mapFacaRow(row, { preco_custo: 0 }));
}

export async function gerarCodigoFaca(): Promise<string> {
  return gerarCodigoForte("FK");
}

type FacaInput = {
  sku: string;
  nome: string;
  categoria: string;
  preco_venda: number;
  estoque_atual: number;
  estoque_minimo: number;
};

export async function criarFaca(input: FacaInput) {
  await assertPermissao("facas", "criar");
  const codigo = await gerarCodigoFaca();

  await prisma.faca.create({
    data: {
      codigo,
      sku: input.sku.trim(),
      nome: input.nome.trim(),
      categoria: input.categoria,
      taxaProducao: 0,
      taxaVenda: 0,
      precoVenda: input.preco_venda,
      estoqueAtual: input.estoque_atual,
      estoqueMinimo: input.estoque_minimo,
    },
  });

  await revalidateFacasLists();
}

export async function atualizarFaca(id: string, input: FacaInput) {
  await assertPermissao("facas", "editar");

  await prisma.faca.updateMany({
    where: { id },
    data: {
      sku: input.sku.trim(),
      nome: input.nome.trim(),
      categoria: input.categoria,
      taxaProducao: 0,
      taxaVenda: 0,
      precoVenda: input.preco_venda,
      estoqueAtual: input.estoque_atual,
      estoqueMinimo: input.estoque_minimo,
    },
  });

  await revalidateFacasLists();
}

export type DeletarFacaModo = "desmontar" | "apagar_materias_primas";

export async function deletarFaca(id: string, modo: DeletarFacaModo = "desmontar") {
  await assertPermissao("facas", "deletar");

  const faca = await getFacaRowById(id);
  if (!faca) throw new Error("Faca não encontrada.");

  await prisma.$transaction(async (tx) => {
    const boms = await tx.facaMateriaPrima.findMany({
      where: { facaId: id },
      select: { materiaPrimaId: true, quantidade: true },
    });

    if (modo === "desmontar") {
      const estoqueFaca = numberFrom(faca.estoqueAtual);
      if (estoqueFaca > 0) {
        const mpIds = [...new Set(boms.map((b) => b.materiaPrimaId))];
        const mps = await tx.materiaPrima.findMany({
          where: { id: { in: mpIds } },
          select: { id: true, estoqueAtual: true },
        });
        const mpMap = new Map(
          mps.map((mp) => [mp.id, { estoque_atual: numberFrom(mp.estoqueAtual) }]),
        );
        const userId = await requireAuthenticatedUserId();

        for (const bom of boms) {
          const mp = mpMap.get(bom.materiaPrimaId);
          if (!mp) continue;

          const quantidadePorFaca = numberFrom(bom.quantidade);
          const delta = round3(estoqueFaca * quantidadePorFaca);
          if (!delta) continue;

          const novoEstoque = round3(mp.estoque_atual + delta);
          mp.estoque_atual = novoEstoque;

          await tx.materiaPrima.update({
            where: { id: bom.materiaPrimaId },
            data: { estoqueAtual: decimal(novoEstoque) },
          });

          await tx.movimentacaoEstoque.create({
            data: {
              tipo: "ajuste",
              materiaPrimaId: bom.materiaPrimaId,
              quantidade: delta,
              observacao: `Desmontar faca ${faca.codigo}`,
              usuarioId: userId,
            },
          });
        }
      }
    }

    if (modo === "apagar_materias_primas") {
      const mpIds = [...new Set(boms.map((b) => b.materiaPrimaId))];

      await tx.faca.deleteMany({
        where: { id },
      });

      for (const mpId of mpIds) {
        const uso = await tx.facaMateriaPrima.findFirst({
          where: { materiaPrimaId: mpId },
          select: { id: true },
        });
        if (!uso) {
          await tx.materiaPrima.delete({ where: { id: mpId } });
        }
      }
    } else {
      await tx.faca.deleteMany({
        where: { id },
      });
    }
  });

  await revalidateFacasLists();
}

// ============================================================
// BOM & Detalhe
// ============================================================

export async function getFacaBOM(facaId: string): Promise<FacaMateriaPrima[]> {
  await assertPermissao("facas", "ver");
  return loadFacaBOM(facaId);
}

export type FacaDetalheData = {
  faca: Faca;
  bom: FacaMateriaPrima[];
  vendas: PedidoItemComPedido[];
  movimentacoes: MovimentacaoEstoque[];
};

export async function getFacaDetalhe(facaId: string): Promise<FacaDetalheData> {
  return withTiming(`getFacaDetalhe(${facaId})`, async () => {
    await assertPermissao("facas", "ver");

    const [faca, bom, vendasRows, movRows, usuariosRows] = await Promise.all([
      getFacaRowById(facaId),
      loadFacaBOM(facaId),
      prisma.pedidoItem.findMany({
        where: { facaId },
        orderBy: { id: "desc" },
        take: 50,
        include: {
          pedido: {
            select: {
              id: true,
              codigo: true,
              status: true,
              dataPedido: true,
            },
          },
        },
      }),
      prisma.movimentacaoEstoque
        .findMany({
          where: {
            facaId,
            materiaPrimaId: null,
          },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            tipo: true,
            materiaPrimaId: true,
            facaId: true,
            consumivelId: true,
            pedidoId: true,
            quantidade: true,
            observacao: true,
            usuarioId: true,
            createdAt: true,
          },
        })
        .then((rows) =>
          rows.map((row) => ({
            id: row.id,
            tipo: row.tipo,
            materia_prima_id: row.materiaPrimaId,
            faca_id: row.facaId,
            consumivel_id: row.consumivelId,
            pedido_id: row.pedidoId,
            quantidade: row.quantidade,
            observacao: row.observacao,
            usuario_id: row.usuarioId,
            created_at: row.createdAt,
          })),
        ),
      prisma.usuarioPerfil.findMany({
        where: { ativo: true },
        orderBy: { nome: "asc" },
        select: { id: true, nome: true },
      }),
    ]);

    if (!faca) throw new Error("Faca não encontrada.");

    const usuariosMap = new Map(usuariosRows.map((u) => [u.id, { id: u.id, nome: u.nome }]));
    const movimentacoes = movRows.map((row) => mapMovimentacaoRow(row, usuariosMap));
    const vendas: PedidoItemComPedido[] = vendasRows.map((row) => ({
      id: row.id,
      pedido_id: row.pedidoId,
      faca_id: row.facaId,
      quantidade: row.quantidade,
      preco_unitario: numberFrom(row.precoUnitario),
      subtotal: numberFrom(row.subtotal),
      ncm: row.ncm,
      cfop: row.cfop,
      pedido: row.pedido
        ? {
            id: row.pedido.id,
            codigo: row.pedido.codigo,
            status: row.pedido.status as StatusPedido,
            data_pedido: row.pedido.dataPedido,
          }
        : null,
    }));

    return {
      faca: mapFacaRow(faca),
      bom,
      vendas,
      movimentacoes,
    };
  });
}

// ============================================================
// Entrada de Estoque (Produção)
// ============================================================

export async function entradaEstoqueFaca(
  facaId: string,
  quantidadeProduzida: number,
  registradoPorId?: string | null,
): Promise<{
  materiaisConsumidos: { codigo: string; nome: string; consumido: number }[];
  movimentacoesCriadas: MovimentacaoEstoque[];
}> {
  await assertPermissao("facas", "editar");

  if (!Number.isFinite(quantidadeProduzida) || quantidadeProduzida <= 0) {
    throw new Error("Quantidade deve ser maior que zero.");
  }

  const faca = await getFacaRowById(facaId);
  if (!faca) throw new Error("Faca não encontrada.");

  const boms = await prisma.facaMateriaPrima.findMany({
    where: { facaId },
    select: { materiaPrimaId: true, quantidade: true },
  });
  if (boms.length === 0) throw new Error("Esta faca não tem matérias-primas cadastradas.");

  const mpIds = [...new Set(boms.map((b) => b.materiaPrimaId))];
  const mps = await prisma.materiaPrima.findMany({
    where: { id: { in: mpIds } },
    select: { id: true, codigo: true, nome: true, estoqueAtual: true },
  });

  const mpMap = new Map<
    string,
    { id: string; codigo: string; nome: string; estoque_atual: number }
  >();
  for (const mp of mps) {
    mpMap.set(mp.id, {
      id: mp.id,
      codigo: mp.codigo,
      nome: mp.nome,
      estoque_atual: numberFrom(mp.estoqueAtual),
    });
  }

  const insuficientes: MaterialInsuficiente[] = [];
  for (const bom of boms) {
    const mp = mpMap.get(bom.materiaPrimaId);
    if (!mp) continue;
    const necessario = round3(quantidadeProduzida * numberFrom(bom.quantidade));
    if (mp.estoque_atual < necessario) {
      insuficientes.push({
        materia_prima_id: mp.id,
        nome: mp.nome,
        codigo: mp.codigo,
        necessario,
        disponivel: mp.estoque_atual,
        falta: round3(necessario - mp.estoque_atual),
      });
    }
  }

  if (insuficientes.length > 0) {
    const detalhes = insuficientes
      .map(
        (m) =>
          `${m.codigo} (${m.nome}): precisa ${m.necessario}, tem ${m.disponivel}, falta ${m.falta}`,
      )
      .join("\n");
    throw new Error(`Matérias-primas insuficientes:\n${detalhes}`);
  }

  const authUserId = await requireAuthenticatedUserId();
  const userId = registradoPorId || authUserId;
  const materiaisConsumidos: { codigo: string; nome: string; consumido: number }[] = [];
  let movimentacaoEntradaFaca: MovimentacaoEstoque | null = null;

  // Calcula consumos em memória (evita round-trips no loop).
  type ConsumoItem = {
    materia_prima_id: string;
    novoEstoque: number;
    consumo: number;
    mp: { codigo: string; nome: string };
  };
  const consumos: ConsumoItem[] = [];
  for (const bom of boms) {
    const mp = mpMap.get(bom.materiaPrimaId);
    if (!mp) continue;
    const consumo = round3(quantidadeProduzida * numberFrom(bom.quantidade));
    if (!consumo) continue;
    consumos.push({
      materia_prima_id: bom.materiaPrimaId,
      consumo,
      novoEstoque: round3(mp.estoque_atual - consumo),
      mp: { codigo: mp.codigo, nome: mp.nome },
    });
  }

  const observacao = `Produção de ${quantidadeProduzida}x ${faca.codigo}`;

  movimentacaoEntradaFaca = await prisma.$transaction(async (tx) => {
    for (const c of consumos) {
      await tx.materiaPrima.update({
        where: { id: c.materia_prima_id },
        data: { estoqueAtual: decimal(c.novoEstoque) },
      });

      await tx.movimentacaoEstoque.create({
        data: {
          tipo: "saida_producao",
          materiaPrimaId: c.materia_prima_id,
          facaId,
          quantidade: c.consumo,
          observacao,
          usuarioId: userId,
        },
      });

      materiaisConsumidos.push({ codigo: c.mp.codigo, nome: c.mp.nome, consumido: c.consumo });
    }

    const novoEstoqueFaca = round3(numberFrom(faca.estoqueAtual) + quantidadeProduzida);
    await tx.faca.update({
      where: { id: facaId },
      data: { estoqueAtual: novoEstoqueFaca },
    });

    const movEntrada = await tx.movimentacaoEstoque.create({
      data: {
        tipo: "entrada",
        facaId,
        quantidade: quantidadeProduzida,
        observacao,
        usuarioId: userId,
        materiaPrimaId: null,
      },
      select: {
        id: true,
        tipo: true,
        materiaPrimaId: true,
        facaId: true,
        consumivelId: true,
        pedidoId: true,
        quantidade: true,
        observacao: true,
        usuarioId: true,
        createdAt: true,
      },
    });

    const usuariosMap = new Map<string, { id: string; nome: string }>();
    return mapMovimentacaoRow(
      {
        id: movEntrada.id,
        tipo: movEntrada.tipo,
        materia_prima_id: movEntrada.materiaPrimaId,
        faca_id: movEntrada.facaId,
        consumivel_id: movEntrada.consumivelId,
        pedido_id: movEntrada.pedidoId,
        quantidade: movEntrada.quantidade,
        observacao: movEntrada.observacao,
        usuario_id: movEntrada.usuarioId,
        created_at: movEntrada.createdAt,
      },
      usuariosMap,
    );
  });

  await revalidateFacasLists();
  return {
    materiaisConsumidos,
    movimentacoesCriadas: movimentacaoEntradaFaca ? [movimentacaoEntradaFaca] : [],
  };
}

export async function atualizarMovimentacaoFacaProducao(input: {
  movimentacaoId: string;
  quantidade: number;
  usuarioId: string;
  observacao?: string | null;
}): Promise<void> {
  await assertPermissao("movimentacoes_estoque", "editar");
  await assertPermissao("usuarios", "editar");

  const { movimentacaoId, quantidade, usuarioId, observacao } = input;
  if (!movimentacaoId) throw new Error("ID da movimentação é obrigatório.");
  if (!Number.isFinite(quantidade) || quantidade <= 0)
    throw new Error("Quantidade deve ser maior que zero.");
  if (!usuarioId) throw new Error("Selecione o usuário responsável.");

  await prisma.$transaction(async (tx) => {
    const movAtual = await tx.movimentacaoEstoque.findUnique({
      where: { id: movimentacaoId },
      select: {
        id: true,
        tipo: true,
        materiaPrimaId: true,
        facaId: true,
        consumivelId: true,
        pedidoId: true,
        quantidade: true,
        observacao: true,
        usuarioId: true,
        createdAt: true,
      },
    });
    if (!movAtual) throw new Error("Movimentação não encontrada.");
    const tipo = String(movAtual.tipo);
    if (tipo !== "saida_producao" && tipo !== "entrada") {
      throw new Error(
        "Somente movimentações de produção (entrada/consumo) podem ser editadas aqui.",
      );
    }

    const usuario = await tx.usuarioPerfil.findUnique({
      where: { id: usuarioId },
      select: { id: true },
    });
    if (!usuario) throw new Error("Usuário não encontrado.");

    const quantidadeAntiga = numberFrom(movAtual.quantidade);
    const delta = quantidade - quantidadeAntiga;

    if (tipo === "saida_producao") {
      if (!movAtual.materiaPrimaId) throw new Error("Movimentação sem matéria-prima vinculada.");
      const mp = await tx.materiaPrima.findUnique({
        where: { id: movAtual.materiaPrimaId },
        select: { id: true, estoqueAtual: true },
      });
      if (!mp) throw new Error("Matéria-prima vinculada não encontrada.");

      const novoEstoque = round3(numberFrom(mp.estoqueAtual) - delta);
      if (novoEstoque < 0)
        throw new Error("Operação inválida: o estoque da matéria-prima ficaria negativo.");

      if (delta !== 0) {
        await tx.materiaPrima.update({
          where: { id: mp.id },
          data: { estoqueAtual: decimal(novoEstoque) },
        });
      }
    }

    if (tipo === "entrada") {
      if (!movAtual.facaId) throw new Error("Movimentação sem faca vinculada.");
      const faca = await tx.faca.findUnique({
        where: { id: movAtual.facaId },
        select: { id: true, estoqueAtual: true },
      });
      if (!faca) throw new Error("Faca vinculada não encontrada.");

      const novoEstoqueFaca = round3(numberFrom(faca.estoqueAtual) + delta);
      if (novoEstoqueFaca < 0)
        throw new Error("Operação inválida: o estoque da faca ficaria negativo.");

      if (delta !== 0) {
        await tx.faca.update({
          where: { id: faca.id },
          data: { estoqueAtual: novoEstoqueFaca },
        });
      }
    }

    await tx.movimentacaoEstoque.update({
      where: { id: movimentacaoId },
      data: {
        quantidade,
        usuarioId,
        observacao: observacao?.trim() || null,
      },
    });
  });

  await revalidateFacasLists();
}
