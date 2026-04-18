import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import type { Orcamento } from '@/types'
import { getOptimizedSupabaseImageUrl } from '@/lib/supabase/optimized-image'
import { formatarDocumento } from '@/lib/br/documento'

const FACA_THUMB_PX = 96

type ImagemFaca = { dataUrl: string; mime: 'PNG' | 'JPEG' } | null

/** Carrega uma URL como dataURL, redimensionando para `size` × `size` (cover).
 *  Retorna null se falhar (sem foto, CORS, etc.) — o PDF segue sem a imagem. */
async function carregarFotoComoDataUrl(url: string | null | undefined, size: number): Promise<ImagemFaca> {
  if (!url) return null
  try {
    const resp = await fetch(url, { mode: 'cors' })
    if (!resp.ok) return null
    const blob = await resp.blob()

    return await new Promise<ImagemFaca>((resolve) => {
      const fr = new FileReader()
      fr.onload = () => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = size
          canvas.height = size
          const ctx = canvas.getContext('2d')
          if (!ctx) return resolve(null)

          // Cover: recorta o maior eixo para caber em size × size
          const ratio = Math.max(size / img.width, size / img.height)
          const w = img.width * ratio
          const h = img.height * ratio
          const dx = (size - w) / 2
          const dy = (size - h) / 2

          ctx.fillStyle = '#ffffff'
          ctx.fillRect(0, 0, size, size)
          ctx.drawImage(img, dx, dy, w, h)
          resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.85), mime: 'JPEG' })
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

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function dataLocal(iso: string) {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('pt-BR')
}

/**
 * Gera um PDF do orçamento com cabeçalho, dados do cliente, tabela de itens
 * com fotos das facas, totais e abre o "Salvar como" do navegador.
 *
 * O PDF é gerado client-side, então qualquer informação aqui já está visível
 * no navegador do usuário.
 */
export async function gerarPdfOrcamento(orcamento: Orcamento): Promise<void> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 40

  // ── Cabeçalho ──────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(20, 20, 20)
  doc.text('ALMA CAMPEIRA', margin, 60)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100)
  doc.text('Orçamento', margin, 76)

  // Bloco direito: código + data
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(20)
  doc.text(`Código: ${orcamento.codigo}`, pageWidth - margin, 60, { align: 'right' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(80)
  doc.text(`Data: ${dataLocal(orcamento.data_orcamento)}`, pageWidth - margin, 76, { align: 'right' })
  if (orcamento.vendedor?.nome) {
    doc.text(`Vendedor: ${orcamento.vendedor.nome}`, pageWidth - margin, 90, { align: 'right' })
  }

  // Linha divisória
  doc.setDrawColor(220)
  doc.setLineWidth(0.6)
  doc.line(margin, 100, pageWidth - margin, 100)

  // ── Dados do cliente ───────────────────────────────────────────────────
  let yCliente = 122
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(60)
  doc.text('CLIENTE', margin, yCliente)
  yCliente += 14

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.setTextColor(20)
  if (orcamento.cliente) {
    doc.text(orcamento.cliente.nome, margin, yCliente)
    yCliente += 13

    doc.setFontSize(9)
    doc.setTextColor(90)
    const detalhes: string[] = []
    if (orcamento.cliente.tipo) detalhes.push(orcamento.cliente.tipo)
    if (orcamento.cliente.documento) {
      detalhes.push(
        formatarDocumento(
          orcamento.cliente.tipo_documento === 'cpf' ? 'cpf' : 'cnpj',
          orcamento.cliente.documento
        )
      )
    }
    if (orcamento.cliente.cidade && orcamento.cliente.estado) {
      detalhes.push(`${orcamento.cliente.cidade}/${orcamento.cliente.estado}`)
    }
    if (detalhes.length > 0) {
      doc.text(detalhes.join(' · '), margin, yCliente)
      yCliente += 12
    }
  } else {
    doc.setTextColor(150)
    doc.text('Sem cliente associado', margin, yCliente)
    yCliente += 12
  }

  // ── Itens (carregar fotos em paralelo antes da tabela) ─────────────────
  const itens = orcamento.itens ?? []

  const fotos = await Promise.all(
    itens.map(async (item) => {
      const url = getOptimizedSupabaseImageUrl(item.faca?.foto_url ?? null, {
        width: FACA_THUMB_PX,
        height: FACA_THUMB_PX,
        quality: 75,
        resize: 'cover',
        fallbackUrl: '',
      })
      return carregarFotoComoDataUrl(url || null, FACA_THUMB_PX)
    })
  )

  // Coluna "Foto" fica em branco no body — desenhamos a imagem em `didDrawCell`
  // (que conhece a posição final da célula). `fotos[idx]` é capturado pelo closure.
  const linhasTabela: string[][] = itens.map((item) => [
    '',
    `${item.faca?.codigo ?? ''}\n${item.faca?.nome ?? '—'}`,
    String(item.quantidade),
    brl(item.preco_unitario),
    brl(item.subtotal),
  ])

  const startY = Math.max(yCliente + 10, 170)

  autoTable(doc, {
    startY,
    head: [['Foto', 'Faca', 'Qtd', 'Preço unit.', 'Subtotal']],
    body: linhasTabela,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 6,
      valign: 'middle',
      lineColor: [220, 220, 220],
      textColor: [40, 40, 40],
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [60, 60, 60],
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 56, halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 40, halign: 'center' },
      3: { cellWidth: 80, halign: 'right' },
      4: { cellWidth: 80, halign: 'right' },
    },
    didParseCell: (data) => {
      // Esvazia o texto da célula da imagem — render visual é feito em didDrawCell.
      if (data.column.index === 0 && data.section === 'body') {
        data.cell.text = []
      }
    },
    didDrawCell: (data) => {
      if (data.column.index !== 0 || data.section !== 'body') return
      const foto = fotos[data.row.index]
      if (!foto) {
        // Placeholder: caixa cinza
        doc.setFillColor(245, 245, 245)
        doc.rect(data.cell.x + 6, data.cell.y + 6, data.cell.width - 12, data.cell.height - 12, 'F')
        return
      }
      const size = Math.min(data.cell.width - 12, data.cell.height - 12)
      const x = data.cell.x + (data.cell.width - size) / 2
      const y = data.cell.y + (data.cell.height - size) / 2
      doc.addImage(foto.dataUrl, foto.mime, x, y, size, size)
    },
    // Garante altura mínima de linha para a foto caber confortavelmente.
    bodyStyles: { minCellHeight: 56 },
  })

  // ── Totais ─────────────────────────────────────────────────────────────
  // jspdf-autotable expõe `lastAutoTable.finalY` em runtime; tipo não está
  // declarado, então fazemos cast pontual.
  const lastY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY
  let yTot = lastY + 18

  const subtotal = itens.reduce((s, i) => s + i.subtotal, 0)
  const frete = orcamento.frete ?? 0
  const desconto = orcamento.desconto_total ?? 0
  const total = orcamento.valor_total ?? Math.max(0, subtotal + frete - desconto)

  const labelX = pageWidth - margin - 140
  const valueX = pageWidth - margin

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(80)

  function linha(label: string, value: string, bold = false, color: [number, number, number] = [40, 40, 40]) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(...color)
    doc.text(label, labelX, yTot)
    doc.text(value, valueX, yTot, { align: 'right' })
    yTot += bold ? 18 : 14
  }

  linha('Subtotal itens', brl(subtotal))
  if (frete > 0) linha('Frete', brl(frete))
  if (desconto > 0) linha('Desconto', `− ${brl(desconto)}`, false, [180, 90, 0])

  // Linha separadora antes do total
  doc.setDrawColor(200)
  doc.line(labelX, yTot - 6, valueX, yTot - 6)

  doc.setFontSize(13)
  linha('TOTAL', brl(total), true, [20, 20, 20])

  // ── Observações ────────────────────────────────────────────────────────
  if (orcamento.observacao) {
    yTot += 10
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(60)
    doc.text('OBSERVAÇÕES', margin, yTot)
    yTot += 14

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(60)
    const linhas = doc.splitTextToSize(orcamento.observacao, pageWidth - margin * 2)
    doc.text(linhas, margin, yTot)
  }

  // ── Rodapé ─────────────────────────────────────────────────────────────
  const rodapeY = doc.internal.pageSize.getHeight() - 24
  doc.setFontSize(8)
  doc.setTextColor(150)
  doc.text(
    `Orçamento ${orcamento.codigo} · gerado em ${new Date().toLocaleString('pt-BR')}`,
    pageWidth / 2,
    rodapeY,
    { align: 'center' }
  )

  doc.save(`orcamento-${orcamento.codigo}.pdf`)
}
