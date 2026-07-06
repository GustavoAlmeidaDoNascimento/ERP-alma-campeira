"use server";

import { assertPermissao } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { codigoBoleto, type FormaPagamento, type Movimentacao } from "@/types";
import { listarGastos } from "@/lib/actions/gastos";
import { listarEntradas } from "@/lib/actions/entradas";

/** Status (coluna crua de `pedidos`) que NÃO representam dinheiro recebido,
 *  mesmo quando o flag `pago` está marcado. Para vendas à vista, o `pago`
 *  controla a entrada em movimentações — só descartamos as canceladas. */
const STATUS_NAO_RECEBIDO = new Set(["cancelado"]);

function primeiro<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

/**
 * Monta a visão unificada de Movimentação (entradas + saídas) em runtime,
 * sem tabela própria. Fontes:
 *   • Saídas       → tabela `gastos` (inclui pagamentos de OC e boletos de saída).
 *   • Entradas     → parcelas pagas de boletos de ENTRADA;
 *                    vendas à vista já pagas (forma ≠ boleto, status recebido);
 *                    entradas manuais (`entradas`).
 *
 * Vendas no boleto NíO entram pela venda em si — entram pelas parcelas pagas,
 * evitando contar a mesma receita duas vezes.
 */
export async function listarMovimentacoes(): Promise<Movimentacao[]> {
  await assertPermissao("gastos", "ver");

  const [gastos, entradas, boletos, pedidos] = await Promise.all([
    listarGastos(),
    listarEntradas(),
    prisma.boleto.findMany({
      where: { tipo: "entrada" },
      orderBy: { createdAt: "desc" },
      take: 500,
      select: {
        id: true,
        tipo: true,
        sequencial: true,
        contraparteNome: true,
        parcelas: {
          select: {
            id: true,
            numero: true,
            valor: true,
            valorPago: true,
            pagoEm: true,
          },
        },
      },
    }),
    prisma.pedido.findMany({
      orderBy: { dataPedido: "desc" },
      take: 500,
      select: {
        id: true,
        codigo: true,
        sequencial: true,
        dataPedido: true,
        status: true,
        valorTotal: true,
        formaPagamento: true,
        pago: true,
        cliente: {
          select: { id: true, nome: true },
        },
        vendedor: {
          select: { id: true, nome: true },
        },
      },
    }),
  ]);

  const movs: Movimentacao[] = [];

  // ── Saídas: gastos ──
  for (const g of gastos) {
    movs.push({
      key: `gasto:${g.id}`,
      origem: "gasto",
      direcao: "saida",
      data: (g.data_gasto ?? "").slice(0, 10),
      descricao: g.descricao,
      categoria: g.tipo,
      valor: Number(g.valor ?? 0),
      forma_pagamento: g.forma_pagamento,
      usuario_nome: g.usuario?.nome ?? null,
      refId: g.id,
      gasto: g,
    });
  }

  // ── Entradas: manuais ──
  for (const e of entradas) {
    movs.push({
      key: `entrada:${e.id}`,
      origem: "entrada_manual",
      direcao: "entrada",
      data: (e.data_entrada ?? "").slice(0, 10),
      descricao: e.descricao,
      categoria: e.categoria ?? "Entrada manual",
      valor: Number(e.valor ?? 0),
      forma_pagamento: e.forma_pagamento,
      usuario_nome: e.usuario?.nome ?? null,
      refId: e.id,
      entrada: e,
    });
  }

  // ── Entradas: parcelas pagas de boletos de entrada ──
  for (const b of boletos) {
    const codigo = codigoBoleto({ tipo: "entrada", sequencial: Number(b.sequencial ?? 0) });
    const parcelas = b.parcelas ?? [];
    for (const p of parcelas) {
      if (!p.pagoEm) continue;
      movs.push({
        key: `parcela:${p.id}`,
        origem: "boleto_entrada",
        direcao: "entrada",
        data: String(p.pagoEm).slice(0, 10),
        descricao: `Recebimento ${codigo} — ${b.contraparteNome} (parcela ${p.numero})`,
        categoria: "Boleto a receber",
        valor: Number(p.valorPago ?? p.valor ?? 0),
        forma_pagamento: "boleto",
        usuario_nome: null,
        refId: b.id,
        codigo,
      });
    }
  }

  // ── Entradas: vendas à vista já pagas ──
  for (const ped of pedidos) {
    const status = String(ped.status ?? "");
    const forma = ped.formaPagamento as FormaPagamento | null;
    if (forma === "boleto") continue; // entra pelas parcelas pagas
    if (STATUS_NAO_RECEBIDO.has(status)) continue;
    // Só conta como recebido depois de marcado "pago" explicitamente.
    if (!ped.pago) continue;
    const cliente = primeiro(ped.cliente) as { nome?: string } | null;
    const vendedor = primeiro(ped.vendedor) as { nome?: string } | null;
    const codigo = ped.codigo ?? null;
    movs.push({
      key: `venda:${ped.id}`,
      origem: "venda",
      direcao: "entrada",
      data: String(ped.dataPedido ?? "").slice(0, 10),
      descricao: `Venda ${codigo ?? ""} — ${cliente?.nome ?? "Sem cliente"}`.trim(),
      categoria: "Venda",
      valor: Number(ped.valorTotal ?? 0),
      forma_pagamento: forma,
      usuario_nome: vendedor?.nome ?? null,
      refId: ped.id,
      codigo,
    });
  }

  // Ordena por data (desc); empate mantém entradas/saídas misturadas por data.
  movs.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));

  return movs;
}
