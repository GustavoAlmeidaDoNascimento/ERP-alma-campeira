import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Pedido } from '@/types'

const COR_TEXTO: [number, number, number] = [17, 24, 39]
const COR_MUTED: [number, number, number] = [75, 85, 99]
const COR_HDR_BG: [number, number, number] = [243, 244, 246]
const COR_BORDA: [number, number, number] = [229, 231, 235]
const COR_FOOT_BG: [number, number, number] = [249, 250, 251]

type LogoImg = { dataUrl: string; width: number; height: number } | null

async function carregarLogoLetreiro(): Promise<LogoImg> {
  try {
    const resp = await fetch('/images/letreiro.png')
    if (!resp.ok) return null
    const blob = await resp.blob()
    return await new Promise<LogoImg>((resolve) => {
      const fr = new FileReader()
      fr.onload = () => {
        const img = new Image()
        img.onload = () => {
          resolve({ dataUrl: fr.result as string, width: img.width, height: img.height })
        }
        img.onerror = () => resolve(null)
        img.src = fr.result as string
      }
      fr.onerror = () => resolve(null)
      fr.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}

function emitidoEmPtBr(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} - ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function fmtDataPedido(iso: string): string {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR')
  } catch {
    return iso
  }
}

/**
 * PDF “venda sem valores”: lista quantidades e dados da venda, sem preços —
 * uso interno pela produção.
 */
export async function gerarPdfVendaSemValor(pedido: Pedido): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()
  const m = 40
  const agora = new Date()

  const logo = await carregarLogoLetreiro()
  const y0 = 22
  const logoMaxH = 56
  let logoBottom = y0
  let marcaX = m
  if (logo) {
    const lh = logoMaxH
    const lw = (logo.width / logo.height) * lh
    marcaX = m + lw + 14
    doc.addImage(logo.dataUrl, 'PNG', m, y0, lw, lh)
    logoBottom = y0 + lh
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(...COR_TEXTO)
    doc.text('Alma Campeira CUTELARIA', m, y0 + 24)
    logoBottom = y0 + 32
    marcaX = m
  }

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COR_MUTED)
  doc.text('Alma Campeira Facas Artesanais', marcaX, y0 + 34)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.text(emitidoEmPtBr(agora), pageW - m, y0 + 10, { align: 'right' })

  let y = Math.max(logoBottom, y0 + 40) + 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...COR_TEXTO)
  doc.text('Venda sem valores', m, y)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COR_MUTED)
  doc.text(`Buscado por código: ${pedido.codigo}`, m, y + 18)

  y += 36
  const metaText = doc.splitTextToSize(
    [
      `Venda cód.: ${pedido.codigo}`,
      `Confirmação: ${fmtDataPedido(pedido.data_pedido)}`,
      `Cliente: ${pedido.cliente?.nome?.trim() || '—'}`,
      `Vendedor: ${pedido.vendedor?.nome?.trim() || '—'}`,
    ].join('\n'),
    pageW - m * 2 - 16,
  )
  const metaH = Math.max(40, metaText.length * 13 + 20)
  doc.setFillColor(...COR_HDR_BG)
  doc.rect(m, y, pageW - m * 2, metaH, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COR_TEXTO)
  doc.text(metaText, m + 8, y + 14)

  const startTableY = y + metaH + 12

  const itens = pedido.itens ?? []
  const obsPedido = pedido.observacao?.trim()
  const codigoOuId = (facaId: string, codigo: string | undefined) => codigo ?? facaId.slice(0, 8)

  const body: (string | number)[][] = itens.map((item) => {
    const f = item.faca
    return [
      codigoOuId(item.faca_id, f?.codigo),
      f?.ean_gtin?.trim() ?? '',
      f?.nome ?? '—',
      obsPedido ?? '',
      'produto',
      item.quantidade,
      f?.unidade?.trim() || '',
    ]
  })

  if (body.length === 0) {
    body.push(['—', '', 'Sem itens', '', '—', 0, ''])
  }

  const totalQtd = itens.reduce((s, i) => s + Number(i.quantidade) || 0, 0)

  autoTable(doc, {
    startY: startTableY,
    head: [['Cód.', 'Cód. próprio', 'Produto', 'Obs adic', 'Tipo', 'Quantidade', 'Unidade']],
    body,
    foot: [
      [
        {
          content: 'TOTAL DA VENDA',
          colSpan: 5,
          styles: { fillColor: COR_FOOT_BG, fontStyle: 'bold', halign: 'right' },
        },
        { content: String(totalQtd), styles: { fillColor: COR_FOOT_BG, fontStyle: 'bold', halign: 'right' } },
        { content: '', styles: { fillColor: COR_FOOT_BG } },
      ],
      [
        {
          content: 'TOTAL GERAL DO RELATÓRIO',
          colSpan: 5,
          styles: { fillColor: COR_FOOT_BG, fontStyle: 'bold', halign: 'right' },
        },
        {
          content: String(totalQtd),
          styles: { fillColor: COR_FOOT_BG, fontStyle: 'bold', halign: 'right' },
        },
        { content: '', styles: { fillColor: COR_FOOT_BG } },
      ],
    ],
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 5,
      lineColor: COR_BORDA,
      lineWidth: 0.35,
      textColor: COR_TEXTO,
      valign: 'top',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: COR_HDR_BG,
      textColor: COR_TEXTO,
      fontStyle: 'bold',
      halign: 'left',
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 46 },
      1: { cellWidth: 58 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 72 },
      4: { cellWidth: 44 },
      5: { cellWidth: 52, halign: 'right' },
      6: { cellWidth: 42, halign: 'center' },
    },
    margin: { left: m, right: m },
  })

  doc.save(`venda-sem-valores-${pedido.codigo}.pdf`)
}
