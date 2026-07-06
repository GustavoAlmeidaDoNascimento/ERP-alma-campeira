import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Orcamento } from "@/types";
import { getOptimizedImageUrl } from "@/lib/images";
import { formatarDocumento } from "@/lib/br/documento";

const FACA_THUMB_PX = 96;

// Paleta (amarelo do sistema — --ac-accent #EAB308 / dark #ca8a04)
const COR_BRAND: [number, number, number] = [202, 138, 4]; // amarelo escuro Alma Campeira
const COR_ACCENT: [number, number, number] = [234, 179, 8]; // amarelo vivo (barra superior)
const COR_TEXTO: [number, number, number] = [28, 28, 28];
const COR_MUTED: [number, number, number] = [110, 110, 110];
const COR_BORDA: [number, number, number] = [229, 231, 235];
const COR_CARD: [number, number, number] = [254, 252, 232]; // creme suave (yellow-50)
const COR_DESC: [number, number, number] = [176, 64, 32]; // vermelho/laranja para desconto
const COR_OK: [number, number, number] = [34, 120, 72];

type ImagemFaca = { dataUrl: string; mime: "PNG" | "JPEG" } | null;

async function carregarFotoComoDataUrl(
  url: string | null | undefined,
  size: number,
): Promise<ImagemFaca> {
  if (!url) return null;
  try {
    const resp = await fetch(url, { mode: "cors" });
    if (!resp.ok) return null;
    const blob = await resp.blob();

    return await new Promise<ImagemFaca>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(null);

          const ratio = Math.max(size / img.width, size / img.height);
          const w = img.width * ratio;
          const h = img.height * ratio;
          const dx = (size - w) / 2;
          const dy = (size - h) / 2;

          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, dx, dy, w, h);
          resolve({ dataUrl: canvas.toDataURL("image/jpeg", 0.85), mime: "JPEG" });
        };
        img.onerror = () => resolve(null);
        img.src = fr.result as string;
      };
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

type LogoImagem = { dataUrl: string; width: number; height: number } | null;

async function carregarLogoLetreiro(): Promise<LogoImagem> {
  try {
    const resp = await fetch("/images/letreiro.png");
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<LogoImagem>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          resolve({ dataUrl: fr.result as string, width: img.width, height: img.height });
        };
        img.onerror = () => resolve(null);
        img.src = fr.result as string;
      };
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function brl(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function dataLocal(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR");
}

/**
 * Gera PDF do orçamento com layout limpo, cabeçalho com marca, bloco do
 * cliente em card, tabela com fotos e descontos por item + bloco de totais.
 */
export async function gerarPdfOrcamento(orcamento: Orcamento): Promise<void> {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;

  // ── CABEÇALHO ─────────────────────────────────────────────────────────
  // Barra superior fina com a cor da marca
  doc.setFillColor(...COR_ACCENT);
  doc.rect(0, 0, pageWidth, 6, "F");

  const logo = await carregarLogoLetreiro();
  if (logo) {
    const logoH = 110;
    const logoW = (logo.width / logo.height) * logoH;
    doc.addImage(logo.dataUrl, "PNG", margin - 6, 16, logoW, logoH);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(...COR_BRAND);
    doc.text("ALMA CAMPEIRA", margin, 58);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...COR_MUTED);
    doc.text("Cutelaria artesanal", margin, 72);
  }

  // Bloco direito: código / data / vendedor
  const boxW = 190;
  const boxX = pageWidth - margin - boxW;
  const boxY = 40;
  const boxH = 58;
  doc.setFillColor(...COR_CARD);
  doc.roundedRect(boxX, boxY, boxW, boxH, 4, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COR_MUTED);
  doc.text("ORÇAMENTO", boxX + 12, boxY + 16);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...COR_TEXTO);
  doc.text(orcamento.codigo, boxX + 12, boxY + 32);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...COR_MUTED);
  doc.text(`Data: ${dataLocal(orcamento.data_orcamento)}`, boxX + 12, boxY + 45);
  if (orcamento.vendedor?.nome) {
    doc.text(`Vendedor: ${orcamento.vendedor.nome}`, boxX + 12, boxY + 55);
  }

  // ── CLIENTE ───────────────────────────────────────────────────────────
  const clienteY = 140;
  const clienteH = 54;

  doc.setFillColor(...COR_CARD);
  doc.roundedRect(margin, clienteY, pageWidth - margin * 2, clienteH, 4, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...COR_MUTED);
  doc.text("CLIENTE", margin + 12, clienteY + 16);

  if (orcamento.cliente) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(...COR_TEXTO);
    doc.text(orcamento.cliente.nome, margin + 12, clienteY + 32);

    const detalhes: string[] = [];
    if (orcamento.cliente.tipo) detalhes.push(orcamento.cliente.tipo);
    if (orcamento.cliente.documento) {
      detalhes.push(
        formatarDocumento(
          orcamento.cliente.tipo_documento === "cpf" ? "cpf" : "cnpj",
          orcamento.cliente.documento,
        ),
      );
    }
    if (orcamento.cliente.cidade && orcamento.cliente.estado) {
      detalhes.push(`${orcamento.cliente.cidade}/${orcamento.cliente.estado}`);
    }
    if (detalhes.length > 0) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...COR_MUTED);
      doc.text(detalhes.join("  .  "), margin + 12, clienteY + 46);
    }
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    doc.setTextColor(...COR_MUTED);
    doc.text("Sem cliente associado", margin + 12, clienteY + 34);
  }

  // ── ITENS ─────────────────────────────────────────────────────────────
  const itens = orcamento.itens ?? [];

  // Calcula descontos por item (preço tabela vs. líquido)
  type Linha = {
    qtd: number;
    precoTabela: number; // faca.preco_venda (ou preco_unitario se não tiver)
    precoLiquido: number; // item.preco_unitario (valor já com desconto aplicado)
    descontoUnit: number; // tabela - líquido (por unidade)
    descontoTotal: number; // descontoUnit í— qtd
    subtotal: number; // item.subtotal
  };

  const linhas: Linha[] = itens.map((item) => {
    const tabela = Number(item.faca?.preco_venda ?? item.preco_unitario) || 0;
    const liquido = Number(item.preco_unitario) || 0;
    const descUnit = Math.max(0, Math.round((tabela - liquido) * 100) / 100);
    const qtd = Number(item.quantidade) || 0;
    return {
      qtd,
      precoTabela: tabela,
      precoLiquido: liquido,
      descontoUnit: descUnit,
      descontoTotal: Math.round(descUnit * qtd * 100) / 100,
      subtotal: Number(item.subtotal) || 0,
    };
  });

  const temDescontoItem = linhas.some((l) => l.descontoUnit > 0.005);

  // Carrega fotos em paralelo
  const fotos = await Promise.all(
    itens.map(async (item) => {
      const url = getOptimizedImageUrl(item.faca?.foto_url ?? null, {
        width: FACA_THUMB_PX,
        height: FACA_THUMB_PX,
        quality: 75,
        resize: "cover",
        fallbackUrl: "",
      });
      return carregarFotoComoDataUrl(url || null, FACA_THUMB_PX);
    }),
  );

  // Linhas da tabela — colunas condicionais para o caso de ter desconto por item
  const body: (string | number)[][] = itens.map((item, idx) => {
    const l = linhas[idx];
    const faca = `${item.faca?.codigo ?? ""}\n${item.faca?.nome ?? "-"}`;
    if (temDescontoItem) {
      return [
        "",
        faca,
        l.qtd,
        brl(l.precoTabela),
        l.descontoUnit > 0.005 ? `- ${brl(l.descontoUnit)}` : "-",
        brl(l.subtotal),
      ];
    }
    return ["", faca, l.qtd, brl(l.precoLiquido), brl(l.subtotal)];
  });

  const head = temDescontoItem
    ? [["Foto", "Faca", "Qtd", "Preço unit.", "Desconto", "Subtotal"]]
    : [["Foto", "Faca", "Qtd", "Preço unit.", "Subtotal"]];

  const startY = 212;

  autoTable(doc, {
    startY,
    head,
    body,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 6,
      valign: "middle",
      lineColor: COR_BORDA,
      lineWidth: 0.4,
      textColor: COR_TEXTO,
    },
    headStyles: {
      fillColor: COR_BRAND,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "left",
      fontSize: 9,
    },
    alternateRowStyles: {
      fillColor: [252, 251, 249],
    },
    columnStyles: temDescontoItem
      ? {
          0: { cellWidth: 54, halign: "center" },
          1: { cellWidth: "auto" },
          2: { cellWidth: 32, halign: "center" },
          3: { cellWidth: 70, halign: "right" },
          4: { cellWidth: 70, halign: "right", textColor: COR_DESC },
          5: { cellWidth: 72, halign: "right", fontStyle: "bold" },
        }
      : {
          0: { cellWidth: 54, halign: "center" },
          1: { cellWidth: "auto" },
          2: { cellWidth: 40, halign: "center" },
          3: { cellWidth: 80, halign: "right" },
          4: { cellWidth: 80, halign: "right", fontStyle: "bold" },
        },
    didParseCell: (data) => {
      if (data.column.index === 0 && data.section === "body") {
        data.cell.text = [];
      }
    },
    didDrawCell: (data) => {
      if (data.column.index !== 0 || data.section !== "body") return;
      const foto = fotos[data.row.index];
      if (!foto) {
        doc.setFillColor(240, 238, 234);
        doc.roundedRect(
          data.cell.x + 5,
          data.cell.y + 5,
          data.cell.width - 10,
          data.cell.height - 10,
          2,
          2,
          "F",
        );
        return;
      }
      const size = Math.min(data.cell.width - 10, data.cell.height - 10);
      const x = data.cell.x + (data.cell.width - size) / 2;
      const y = data.cell.y + (data.cell.height - size) / 2;
      doc.addImage(foto.dataUrl, foto.mime, x, y, size, size);
    },
    bodyStyles: { minCellHeight: 54 },
    margin: { left: margin, right: margin },
  });

  // ── TOTAIS ────────────────────────────────────────────────────────────
  const lastY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY;

  const subtotalItens = linhas.reduce((s, l) => s + l.subtotal, 0);
  const descontoItens = linhas.reduce((s, l) => s + l.descontoTotal, 0);
  const frete = Number(orcamento.frete ?? 0) || 0;
  const descontoTotal = Number(orcamento.desconto_total ?? 0) || 0;
  const total =
    orcamento.valor_total != null
      ? Number(orcamento.valor_total)
      : Math.max(0, subtotalItens + frete - descontoTotal);

  // Card de totais (direita)
  const totaisW = 230;
  const totaisX = pageWidth - margin - totaisW;
  const totaisY = lastY + 16;

  // calcula altura dinâmica
  const rows: Array<{
    label: string;
    value: string;
    cor: [number, number, number];
    bold?: boolean;
  }> = [];
  if (descontoItens > 0.005) {
    const bruto = subtotalItens + descontoItens;
    rows.push({ label: "Subtotal (tabela)", value: brl(bruto), cor: COR_MUTED });
    rows.push({ label: "Descontos por item", value: `- ${brl(descontoItens)}`, cor: COR_DESC });
  }
  rows.push({ label: "Subtotal itens", value: brl(subtotalItens), cor: COR_TEXTO });
  if (frete > 0) rows.push({ label: "Frete", value: brl(frete), cor: COR_TEXTO });
  if (descontoTotal > 0)
    rows.push({ label: "Desconto extra", value: `- ${brl(descontoTotal)}`, cor: COR_DESC });

  const lineH = 15;
  const totaisH = 18 + rows.length * lineH + 30;

  doc.setFillColor(...COR_CARD);
  doc.roundedRect(totaisX, totaisY, totaisW, totaisH, 4, 4, "F");

  let yRow = totaisY + 20;
  for (const r of rows) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...r.cor);
    doc.text(r.label, totaisX + 14, yRow);
    doc.setFont("helvetica", r.bold ? "bold" : "normal");
    doc.text(r.value, totaisX + totaisW - 14, yRow, { align: "right" });
    yRow += lineH;
  }

  // Divisória antes do total
  doc.setDrawColor(...COR_BORDA);
  doc.setLineWidth(0.6);
  doc.line(totaisX + 14, yRow - 5, totaisX + totaisW - 14, yRow - 5);

  // TOTAL (destaque)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...COR_MUTED);
  doc.text("TOTAL", totaisX + 14, yRow + 14);
  doc.setFontSize(15);
  doc.setTextColor(...COR_OK);
  doc.text(brl(total), totaisX + totaisW - 14, yRow + 14, { align: "right" });

  // ── OBSERVAÇÕES ───────────────────────────────────────────────────────
  if (orcamento.observacao) {
    const obsY = lastY + 16;
    const obsW = totaisX - margin - 14;
    const obsH = totaisH;

    doc.setFillColor(...COR_CARD);
    doc.roundedRect(margin, obsY, obsW, obsH, 4, 4, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...COR_MUTED);
    doc.text("OBSERVAÇÕES", margin + 12, obsY + 18);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...COR_TEXTO);
    const linhasObs = doc.splitTextToSize(orcamento.observacao, obsW - 24);
    doc.text(linhasObs, margin + 12, obsY + 34);
  }

  // ── RODAPÉ ────────────────────────────────────────────────────────────
  const rodapeY = pageHeight - 28;
  doc.setDrawColor(...COR_BORDA);
  doc.setLineWidth(0.4);
  doc.line(margin, rodapeY - 10, pageWidth - margin, rodapeY - 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...COR_MUTED);
  doc.text(
    `Orçamento ${orcamento.codigo}  .  gerado em ${new Date().toLocaleString("pt-BR")}`,
    margin,
    rodapeY,
  );
  doc.text("Alma Campeira — cutelaria artesanal", pageWidth - margin, rodapeY, {
    align: "right",
  });

  doc.save(`orcamento-${orcamento.codigo}.pdf`);
}
