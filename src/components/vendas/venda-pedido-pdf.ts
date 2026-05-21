import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Pedido, PedidoClienteJoin } from '@/types'
import { STATUS_PEDIDO } from '@/types'
import { formatarDocumento } from '@/lib/br/documento'

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

function fmtBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function fmtCep(v: string | null | undefined): string {
  if (!v?.trim()) return ''
  const d = v.replace(/\D/g, '')
  if (d.length === 8) return `${d.slice(0, 5)}-${d.slice(5)}`
  return v.trim()
}

function linhasEndereco(c: PedidoClienteJoin): string[] {
  const cep = fmtCep(c.cep)
  const rua = [c.logradouro?.trim(), c.numero?.trim()].filter(Boolean).join(', ')
  const comp = c.complemento?.trim()
  const bai = c.bairro?.trim()
  const cidadeUf =
    c.cidade && c.estado
      ? `${c.cidade}/${c.estado}`
      : c.cidade || c.estado || ''

  const line1 = [cep, rua].filter(Boolean).join(' · ')
  const line2 = [comp, bai].filter(Boolean).join(' · ')
  return [line1, line2, cidadeUf.trim()].filter((s) => s.length > 0)
}

/**
 * PDF do pedido completo, com valores, dados do cliente, vendedor e totais.
 */
export async function gerarPdfPedido(pedido: Pedido): Promise<void> {
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
  const titulo = `Pedido ${pedido.sequencial != null ? `#${pedido.sequencial} · ` : ''}${pedido.codigo}`
  doc.text(titulo, m, y)

  const status = STATUS_PEDIDO[pedido.status]
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...COR_MUTED)
  doc.text(`Status: ${status.label}`, m, y + 18)

  y += 36

  // Bloco de informações: cliente + venda
  const c = pedido.cliente
  const linhasCliente: string[] = []
  if (c) {
    linhasCliente.push(`Cliente: ${c.nome?.trim() || '—'}${c.tipo ? ` (${c.tipo})` : ''}`)
    if (c.documento) {
      const tipoDoc = c.tipo_documento === 'cpf' ? 'cpf' : 'cnpj'
      linhasCliente.push(`${tipoDoc.toUpperCase()}: ${formatarDocumento(tipoDoc, c.documento)}`)
    }
    if (c.razao_social?.trim()) linhasCliente.push(`Razão social: ${c.razao_social.trim()}`)
    if (c.ie?.trim()) linhasCliente.push(`IE: ${c.ie.trim()}`)
    if (c.telefone?.trim()) linhasCliente.push(`Telefone: ${c.telefone.trim()}`)
    if (c.email?.trim()) linhasCliente.push(`E-mail: ${c.email.trim()}`)
    const endLines = linhasEndereco(c)
    if (endLines.length > 0) linhasCliente.push(`Endereço: ${endLines.join(' · ')}`)
  } else {
    linhasCliente.push('Cliente: —')
  }

  const linhasVenda: string[] = [
    `Venda cód.: ${pedido.codigo}`,
    `Data da venda: ${fmtDataPedido(pedido.data_pedido)}`,
    `Vendedor: ${pedido.vendedor?.nome?.trim() || '—'}`,
  ]
  if (pedido.natureza_operacao?.trim()) {
    linhasVenda.push(`Natureza: ${pedido.natureza_operacao.trim()}`)
  }
  if (pedido.entregue_at) {
    linhasVenda.push(`Entregue em: ${new Date(pedido.entregue_at).toLocaleDateString('pt-BR')}`)
  }
  if (pedido.observacao?.trim()) {
    linhasVenda.push(`Observação: ${pedido.observacao.trim()}`)
  }

  const todasLinhas = [...linhasCliente, '', ...linhasVenda]
  const metaText = doc.splitTextToSize(todasLinhas.join('\n'), pageW - m * 2 - 16)
  const metaH = Math.max(40, metaText.length * 12 + 16)
  doc.setFillColor(...COR_HDR_BG)
  doc.rect(m, y, pageW - m * 2, metaH, 'F')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...COR_TEXTO)
  doc.text(metaText, m + 8, y + 14)

  const startTableY = y + metaH + 12

  const itens = pedido.itens ?? []
  const codigoOuId = (facaId: string, codigo: string | undefined) => codigo ?? facaId.slice(0, 8)

  const body: (string | number)[][] = itens.map((item) => {
    const f = item.faca
    return [
      codigoOuId(item.faca_id, f?.codigo),
      f?.nome ?? '—',
      item.quantidade,
      f?.unidade?.trim() || '',
      fmtBRL(item.preco_unitario),
      fmtBRL(item.subtotal),
    ]
  })

  if (body.length === 0) {
    body.push(['—', 'Sem itens', 0, '', fmtBRL(0), fmtBRL(0)])
  }

  const subtotalItens = itens.reduce((s, i) => s + i.subtotal, 0)
  const frete = pedido.frete ?? 0
  const descontoTotal = pedido.desconto_total ?? 0
  const total = pedido.valor_total ?? Math.max(0, subtotalItens + frete - descontoTotal)

  const foot: { content: string; colSpan?: number; styles?: Record<string, unknown> }[][] = []
  foot.push([
    { content: 'Subtotal dos itens', colSpan: 5, styles: { fillColor: COR_FOOT_BG, fontStyle: 'bold', halign: 'right' } },
    { content: fmtBRL(subtotalItens), styles: { fillColor: COR_FOOT_BG, fontStyle: 'bold', halign: 'right' } },
  ])
  if (frete > 0) {
    foot.push([
      { content: 'Frete', colSpan: 5, styles: { fillColor: COR_FOOT_BG, halign: 'right' } },
      { content: fmtBRL(frete), styles: { fillColor: COR_FOOT_BG, halign: 'right' } },
    ])
  }
  if (descontoTotal > 0) {
    foot.push([
      { content: 'Desconto no total', colSpan: 5, styles: { fillColor: COR_FOOT_BG, halign: 'right' } },
      { content: `− ${fmtBRL(descontoTotal)}`, styles: { fillColor: COR_FOOT_BG, halign: 'right' } },
    ])
  }
  foot.push([
    { content: 'TOTAL DA VENDA', colSpan: 5, styles: { fillColor: COR_FOOT_BG, fontStyle: 'bold', halign: 'right' } },
    { content: fmtBRL(total), styles: { fillColor: COR_FOOT_BG, fontStyle: 'bold', halign: 'right' } },
  ])

  autoTable(doc, {
    startY: startTableY,
    head: [['Cód.', 'Produto', 'Qtd.', 'Un.', 'Preço un.', 'Subtotal']],
    body,
    foot,
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
      0: { cellWidth: 50 },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 42, halign: 'right' },
      3: { cellWidth: 38, halign: 'center' },
      4: { cellWidth: 72, halign: 'right' },
      5: { cellWidth: 78, halign: 'right' },
    },
    margin: { left: m, right: m },
  })

  doc.save(`pedido-${pedido.codigo}.pdf`)
}
