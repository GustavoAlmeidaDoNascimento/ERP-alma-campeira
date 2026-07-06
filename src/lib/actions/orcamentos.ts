"use server";

import { Prisma } from "@prisma/client";
import { assertPermissao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gerarCodigoForte } from "@/lib/utils/codigo";
import type { Orcamento, StatusPedido, TipoCliente } from "@/types";

type OrcamentoRow = {
  id: string;
  codigo: string;
  clienteId: string | null;
  vendedorId: string | null;
  dataOrcamento: string;
  observacao: string | null;
  frete: Prisma.Decimal | number | string | null;
  descontoTotal: Prisma.Decimal | number | string | null;
  valorTotal: Prisma.Decimal | number | string | null;
  convertidoPedidoId: string | null;
  convertidoAt: Date | string | null;
  createdAt: Date | string;
  cliente: {
    id: string;
    nome: string;
    tipo: TipoCliente | string;
    tipoDocumento: "cpf" | "cnpj";
    documento: string | null;
    cidade: string | null;
    estado: string | null;
  } | null;
  vendedor: {
    id: string;
    nome: string;
  } | null;
};

type OrcamentoItemRow = {
  id: string;
  orcamentoId: string;
  facaId: string;
  quantidade: number;
  precoUnitario: Prisma.Decimal | number | string;
  subtotal: Prisma.Decimal | number | string | null;
  createdAt?: Date | string;
  faca?: {
    id: string;
    codigo: string;
    nome: string;
    precoVenda: Prisma.Decimal | number | string;
    fotoUrl: string | null;
  } | null;
};

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

function isoFrom(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapOrcamentoItem(row: OrcamentoItemRow) {
  const precoUnitario = numberFrom(row.precoUnitario);
  const subtotal = row.subtotal == null ? row.quantidade * precoUnitario : numberFrom(row.subtotal);
  return {
    id: row.id,
    orcamento_id: row.orcamentoId,
    faca_id: row.facaId,
    quantidade: Number(row.quantidade) || 0,
    preco_unitario: precoUnitario,
    subtotal,
    faca: row.faca
      ? {
          id: row.faca.id,
          codigo: row.faca.codigo,
          nome: row.faca.nome,
          preco_venda: numberFrom(row.faca.precoVenda),
          foto_url: row.faca.fotoUrl ?? null,
        }
      : undefined,
  };
}

function mapOrcamento(row: OrcamentoRow, itens: ReturnType<typeof mapOrcamentoItem>[]): Orcamento {
  return {
    id: row.id,
    codigo: row.codigo,
    cliente_id: row.clienteId,
    vendedor_id: row.vendedorId,
    data_orcamento: row.dataOrcamento,
    observacao: row.observacao,
    frete: numberFrom(row.frete),
    desconto_total: numberFrom(row.descontoTotal),
    valor_total: row.valorTotal == null ? null : numberFrom(row.valorTotal),
    convertido_pedido_id: row.convertidoPedidoId,
    convertido_at: isoFrom(row.convertidoAt),
    created_at: isoFrom(row.createdAt) ?? "",
    cliente: row.cliente
      ? {
          id: row.cliente.id,
          nome: row.cliente.nome ?? "",
          tipo: (row.cliente.tipo as TipoCliente | null) ?? "Pessoa Física",
          tipo_documento: row.cliente.tipoDocumento ?? "cpf",
          documento: row.cliente.documento ?? "",
          cidade: row.cliente.cidade ?? "",
          estado: row.cliente.estado ?? "",
        }
      : null,
    vendedor: row.vendedor
      ? {
          id: row.vendedor.id,
          nome: row.vendedor.nome ?? "",
        }
      : null,
    itens,
  };
}

async function fetchOrcamentoItens(
  db: Prisma.TransactionClient | typeof prisma,
  orcamentoIds: string[],
  includeFaca = false,
): Promise<OrcamentoItemRow[]> {
  if (orcamentoIds.length === 0) return [];
  if (includeFaca) {
    return db.orcamentoItem.findMany({
      where: { orcamentoId: { in: orcamentoIds } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        orcamentoId: true,
        facaId: true,
        quantidade: true,
        precoUnitario: true,
        subtotal: true,
        createdAt: true,
        faca: {
          select: {
            id: true,
            codigo: true,
            nome: true,
            precoVenda: true,
            fotoUrl: true,
          },
        },
      },
    });
  }

  return db.orcamentoItem.findMany({
    where: { orcamentoId: { in: orcamentoIds } },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      orcamentoId: true,
      facaId: true,
      quantidade: true,
      precoUnitario: true,
      subtotal: true,
      createdAt: true,
    },
  });
}

function agruparItens(rows: OrcamentoItemRow[]) {
  const grouped = new Map<string, ReturnType<typeof mapOrcamentoItem>[]>();
  for (const row of rows) {
    const current = grouped.get(row.orcamentoId) ?? [];
    current.push(mapOrcamentoItem(row));
    grouped.set(row.orcamentoId, current);
  }
  return grouped;
}

export async function getOrcamentos(limit = 80): Promise<Orcamento[]> {
  await assertPermissao("orcamentos", "ver");
  const rows = await prisma.orcamento.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      codigo: true,
      clienteId: true,
      vendedorId: true,
      dataOrcamento: true,
      observacao: true,
      frete: true,
      descontoTotal: true,
      valorTotal: true,
      convertidoPedidoId: true,
      convertidoAt: true,
      createdAt: true,
      cliente: {
        select: {
          id: true,
          nome: true,
          tipo: true,
          tipoDocumento: true,
          documento: true,
          cidade: true,
          estado: true,
        },
      },
      vendedor: {
        select: {
          id: true,
          nome: true,
        },
      },
    },
  });

  const itensRows = await fetchOrcamentoItens(
    prisma,
    rows.map((row) => row.id),
  );
  const itensPorOrcamento = agruparItens(itensRows);

  return rows.map((row) => mapOrcamento(row, itensPorOrcamento.get(row.id) ?? []));
}

export async function getOrcamentoDetalhe(id: string): Promise<Orcamento> {
  await assertPermissao("orcamentos", "ver");
  const row = await prisma.orcamento.findUnique({
    where: { id },
    select: {
      id: true,
      codigo: true,
      clienteId: true,
      vendedorId: true,
      dataOrcamento: true,
      observacao: true,
      frete: true,
      descontoTotal: true,
      valorTotal: true,
      convertidoPedidoId: true,
      convertidoAt: true,
      createdAt: true,
      cliente: {
        select: {
          id: true,
          nome: true,
          tipo: true,
          tipoDocumento: true,
          documento: true,
          cidade: true,
          estado: true,
        },
      },
      vendedor: {
        select: {
          id: true,
          nome: true,
        },
      },
    },
  });
  if (!row) throw new Error("Orçamento não encontrado.");

  const itensRows = await fetchOrcamentoItens(prisma, [id], true);
  const detalhe = mapOrcamento(row, itensRows.map(mapOrcamentoItem));

  if (row.convertidoPedidoId) {
    const pedido = await prisma.pedido.findUnique({
      where: { id: row.convertidoPedidoId },
      select: {
        id: true,
        codigo: true,
        status: true,
        dataPedido: true,
      },
    });
    detalhe.pedido_convertido = pedido
      ? {
          id: pedido.id,
          codigo: pedido.codigo,
          status: pedido.status as StatusPedido,
          data_pedido: pedido.dataPedido,
        }
      : null;
  }

  return detalhe;
}

export type OrcamentoItemInput = {
  faca_id: string;
  quantidade: number;
  preco_unitario: number;
};

export type OrcamentoInput = {
  cliente_id: string | null;
  vendedor_id: string | null;
  data_orcamento: string;
  observacao: string;
  frete: number;
  desconto_total: number;
  itens: OrcamentoItemInput[];
};

function calcularTotal(input: OrcamentoInput) {
  const subtotalItens = input.itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
  const frete = Math.max(0, input.frete || 0);
  const bruto = subtotalItens + frete;
  const desconto_total = Math.min(Math.max(0, input.desconto_total || 0), bruto);
  const valor_total = bruto - desconto_total;
  return { frete, desconto_total, valor_total };
}

function normalizarOrcamentoTexto(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function montarOrcamentoData(input: OrcamentoInput) {
  const { frete, desconto_total, valor_total } = calcularTotal(input);
  return {
    clienteId: input.cliente_id || null,
    vendedorId: input.vendedor_id || null,
    dataOrcamento: input.data_orcamento,
    observacao: normalizarOrcamentoTexto(input.observacao),
    frete: decimal(frete),
    descontoTotal: decimal(desconto_total),
    valorTotal: decimal(valor_total),
  };
}

async function inserirItensOrcamento(
  tx: Prisma.TransactionClient,
  orcamentoId: string,
  itens: OrcamentoItemInput[],
) {
  if (itens.length === 0) return;
  await tx.orcamentoItem.createMany({
    data: itens.map((item) => ({
      orcamentoId,
      facaId: item.faca_id,
      quantidade: item.quantidade,
      precoUnitario: decimal(item.preco_unitario),
      subtotal: decimal(item.quantidade * item.preco_unitario),
    })),
  });
}

export async function criarOrcamento(input: OrcamentoInput): Promise<{ id: string }> {
  await assertPermissao("orcamentos", "criar");
  if (input.itens.length === 0) throw new Error("Adicione ao menos um item ao orçamento.");

  const codigo = gerarCodigoForte("OR");
  const data = montarOrcamentoData(input);

  const result = await prisma.$transaction(async (tx) => {
    const inserted = await tx.orcamento.create({
      data: {
        codigo,
        ...data,
      },
      select: { id: true },
    });

    const orcamentoId = inserted.id;

    await inserirItensOrcamento(tx, orcamentoId, input.itens);
    return { id: orcamentoId };
  });

  return result;
}

export async function atualizarOrcamento(id: string, input: OrcamentoInput) {
  await assertPermissao("orcamentos", "editar");
  if (input.itens.length === 0) throw new Error("Adicione ao menos um item ao orçamento.");

  const data = montarOrcamentoData(input);
  await prisma.$transaction(async (tx) => {
    const atual = await tx.orcamento.findUnique({
      where: { id },
      select: { convertidoPedidoId: true },
    });
    if (atual?.convertidoPedidoId) {
      throw new Error("Este orçamento já foi convertido em venda e não pode ser editado.");
    }

    await tx.orcamento.update({
      where: { id },
      data,
    });

    await sincronizarItensOrcamento(tx, id, input.itens);
  });
}

/**
 * Sincroniza orcamento_itens fazendo diff por posição (ordenado por created_at).
 * Em vez de apagar tudo e reinserir — que gerava 1 INSERT + 1 DELETE por item no
 * log de auditoria —, só atualiza linhas que de fato mudaram, insere extras
 * novos e deleta os que sobraram. Tipicamente: editar a quantidade de 1 item
 * gera 1 UPDATE no log, e mais nada.
 */
async function sincronizarItensOrcamento(
  tx: Prisma.TransactionClient,
  orcamentoId: string,
  novos: OrcamentoItemInput[],
) {
  const atuaisArr = await tx.orcamentoItem.findMany({
    where: { orcamentoId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      facaId: true,
      quantidade: true,
      precoUnitario: true,
    },
  });
  const max = Math.max(atuaisArr.length, novos.length);

  for (let i = 0; i < max; i++) {
    const atual = atuaisArr[i];
    const novo = novos[i];

    if (atual && novo) {
      const mudou =
        atual.facaId !== novo.faca_id ||
        Number(atual.quantidade) !== Number(novo.quantidade) ||
        Number(atual.precoUnitario) !== Number(novo.preco_unitario);
      if (mudou) {
        await tx.orcamentoItem.update({
          where: { id: atual.id },
          data: {
            facaId: novo.faca_id,
            quantidade: novo.quantidade,
            precoUnitario: decimal(novo.preco_unitario),
            subtotal: decimal(novo.quantidade * novo.preco_unitario),
          },
        });
      }
    } else if (novo) {
      await tx.orcamentoItem.create({
        data: {
          orcamentoId,
          facaId: novo.faca_id,
          quantidade: novo.quantidade,
          precoUnitario: decimal(novo.preco_unitario),
          subtotal: decimal(novo.quantidade * novo.preco_unitario),
        },
      });
    } else if (atual) {
      await tx.orcamentoItem.delete({
        where: { id: atual.id },
      });
    }
  }
}

export async function deletarOrcamento(id: string) {
  await assertPermissao("orcamentos", "deletar");
  // Em orçamentos qualquer pode ser excluído (ao contrário de pedidos, não há lock por status).
  await prisma.orcamento.deleteMany({
    where: { id },
  });
}

/**
 * Cria um pedido novo a partir do orçamento e marca o orçamento como convertido.
 *
 * - Não consome estoque automaticamente: a entrega do novo pedido segue o fluxo
 *   normal (avançar para "em produção" e depois "marcar como entregue").
 * - Por isso `statusInicial` é restrito a `em_espera | em_producao`. Se o usuário
 *   quiser entregar imediatamente, ele faz isso pela tela de Vendas.
 */
export async function transformarOrcamentoEmVenda(
  id: string,
  statusInicial: Extract<StatusPedido, "em_espera" | "em_producao">,
): Promise<{ pedido_id: string; pedido_codigo: string }> {
  // Precisa de criar venda E editar orçamento (para marcar conversão).
  await assertPermissao("vendas", "criar");
  await assertPermissao("orcamentos", "editar");
  const result = await prisma.$transaction(async (tx) => {
    const orc = await tx.orcamento.findUnique({
      where: { id },
      select: {
        id: true,
        clienteId: true,
        vendedorId: true,
        dataOrcamento: true,
        observacao: true,
        frete: true,
        descontoTotal: true,
        valorTotal: true,
        convertidoPedidoId: true,
        itens: {
          select: {
            facaId: true,
            quantidade: true,
            precoUnitario: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!orc) throw new Error("Orçamento não encontrado.");
    if (orc.convertidoPedidoId) {
      throw new Error("Este orçamento já foi convertido em venda.");
    }

    const itens = orc.itens;

    if (itens.length === 0) throw new Error("Orçamento sem itens não pode virar venda.");
    if (!orc.clienteId?.trim()) {
      throw new Error("O orçamento precisa ter um cliente cadastrado para virar venda.");
    }
    if (!orc.vendedorId?.trim()) {
      throw new Error("O orçamento precisa ter um vendedor cadastrado para virar venda.");
    }

    const facaIds = [...new Set(itens.map((i) => i.facaId))];
    const facasExistentes = await tx.faca.findMany({
      where: { id: { in: facaIds } },
      select: { id: true },
    });
    const existentes = new Set(facasExistentes.map((f) => f.id));
    const ausentes = facaIds.filter((fid) => !existentes.has(fid));
    if (ausentes.length > 0) {
      throw new Error(
        "O orçamento contém facas que não existem mais. Edite o orçamento antes de convertê-lo.",
      );
    }

    const codigoPedido = gerarCodigoForte("PD");
    const pedido = await tx.pedido.create({
      data: {
        codigo: codigoPedido,
        clienteId: orc.clienteId,
        vendedorId: orc.vendedorId,
        dataPedido: orc.dataOrcamento,
        observacao: orc.observacao,
        status: statusInicial,
        frete: decimal(numberFrom(orc.frete)),
        descontoTotal: decimal(numberFrom(orc.descontoTotal)),
        valorTotal: decimal(numberFrom(orc.valorTotal)),
        itens: {
          create: itens.map((item) => {
            const precoUnitario = numberFrom(item.precoUnitario);
            return {
              facaId: item.facaId,
              quantidade: item.quantidade,
              precoUnitario: decimal(precoUnitario),
              subtotal: decimal(item.quantidade * precoUnitario),
            };
          }),
        },
      },
      select: {
        id: true,
        codigo: true,
      },
    });

    await tx.orcamento.update({
      where: { id },
      data: {
        convertidoPedidoId: pedido.id,
        convertidoAt: new Date(),
      },
    });

    return { pedido_id: pedido.id, pedido_codigo: pedido.codigo };
  });

  return result;
}
