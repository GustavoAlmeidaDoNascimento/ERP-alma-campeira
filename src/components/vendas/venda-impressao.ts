import type { Pedido, PedidoClienteJoin } from '@/types'
import { STATUS_PEDIDO, FORMAS_PAGAMENTO_OC } from '@/types'
import { formatarDocumento } from '@/lib/br/documento'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
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

function linhasEnderecoHtml(c: PedidoClienteJoin): string {
  const cep = fmtCep(c.cep)
  const rua = [c.logradouro?.trim(), c.numero?.trim()].filter(Boolean).join(', ')
  const comp = c.complemento?.trim()
  const bai = c.bairro?.trim()
  const cidadeUf =
    c.cidade && c.estado ? `${c.cidade}/${c.estado}` : c.cidade || c.estado || ''
  const line1 = [cep, rua].filter(Boolean).join(' · ')
  const line2 = [comp, bai].filter(Boolean).join(' · ')
  const blocos = [line1, line2, cidadeUf.trim()].filter((s) => s.length > 0)
  if (blocos.length === 0) return ''
  return `<p><strong>Endereço</strong> ${esc(blocos.join(' · '))}</p>`
}

function blocoClienteHtml(c: PedidoClienteJoin | null | undefined): string {
  if (!c) return '<p><strong>Cliente</strong> —</p>'
  const partes: string[] = []
  const nome = c.nome?.trim() || '—'
  partes.push(`<p><strong>Cliente</strong> ${esc(nome)}${c.tipo ? ` (${esc(c.tipo)})` : ''}</p>`)
  if (c.documento) {
    const tipoDoc = c.tipo_documento === 'cpf' ? 'cpf' : 'cnpj'
    partes.push(
      `<p><strong>${tipoDoc.toUpperCase()}</strong> ${esc(formatarDocumento(tipoDoc, c.documento))}</p>`,
    )
  }
  if (c.razao_social?.trim()) {
    partes.push(`<p><strong>Razão social</strong> ${esc(c.razao_social.trim())}</p>`)
  }
  if (c.ie?.trim()) partes.push(`<p><strong>IE</strong> ${esc(c.ie.trim())}</p>`)
  if (c.telefone?.trim()) partes.push(`<p><strong>Telefone</strong> ${esc(c.telefone.trim())}</p>`)
  if (c.email?.trim()) partes.push(`<p><strong>E-mail</strong> ${esc(c.email.trim())}</p>`)
  partes.push(linhasEnderecoHtml(c))
  return partes.filter(Boolean).join('\n')
}

const PRINT_STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 13px; color: #111; background: #f3f4f6; }
  .toolbar {
    position: sticky; top: 0; z-index: 10;
    display: flex; align-items: center; justify-content: center; gap: 12px;
    padding: 12px 16px; background: #1f2937; color: #f9fafb;
    box-shadow: 0 1px 3px rgba(0,0,0,.15);
  }
  .toolbar button {
    font: inherit; font-size: 14px; font-weight: 600;
    padding: 8px 20px; border: none; border-radius: 8px;
    background: #facc15; color: #111; cursor: pointer;
  }
  .toolbar button:hover { filter: brightness(0.95); }
  .toolbar span { font-size: 13px; color: #d1d5db; }
  .page { max-width: 900px; margin: 0 auto; padding: 40px 32px 48px; background: #fff; }
  .brand { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 24px; }
  .brand img { height: 56px; width: auto; object-fit: contain; }
  .brand-text h1 { font-size: 18px; font-weight: 700; }
  .brand-text p { font-size: 12px; color: #555; margin-top: 2px; }
  .emitido { font-size: 11px; color: #888; text-align: right; margin-bottom: 8px; }
  .doc-title { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  .doc-subtitle { font-size: 12px; color: #555; margin-bottom: 20px; }
  .meta-box {
    padding: 10px 12px; background: #f3f4f6; border: 1px solid #e5e7eb;
    border-radius: 6px; margin-bottom: 16px; line-height: 1.35;
    font-size: 11px;
    display: grid; grid-template-columns: 1fr 1fr; gap: 2px 24px;
  }
  .meta-box p { margin-bottom: 2px; break-inside: avoid; }
  .meta-box strong { font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin-right: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  thead tr { background: #f3f4f6; }
  th {
    padding: 8px 10px; text-align: left; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.05em; color: #555; border-bottom: 2px solid #e5e7eb;
  }
  td { padding: 8px 10px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  .num { text-align: right; }
  .total-row { font-weight: 700; font-size: 14px; }
  .total-row td { border-top: 2px solid #111; border-bottom: none; padding-top: 10px; }
  .obs {
    margin-top: 16px; padding: 12px 16px; background: #f9fafb;
    border: 1px solid #e5e7eb; border-radius: 6px;
  }
  .obs strong {
    display: block; font-size: 10px; text-transform: uppercase;
    letter-spacing: 0.05em; color: #888; margin-bottom: 4px;
  }
  .footer {
    margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb;
    font-size: 11px; color: #888; text-align: center;
  }
  @media print {
    body { background: #fff; }
    .toolbar { display: none !important; }
    .page { padding: 20px; max-width: none; margin: 0; }
    @page { margin: 1.5cm; }
  }
`

function codigoOuId(facaId: string, codigo: string | undefined): string {
  return codigo ?? facaId.slice(0, 8)
}

function abrirJanelaImpressao(tituloPagina: string, corpo: string): void {
  const emitido = new Date().toLocaleString('pt-BR')
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>${esc(tituloPagina)}</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  <div class="toolbar no-print">
    <span>${esc(tituloPagina)}</span>
    <button type="button" onclick="window.print()">Imprimir</button>
  </div>
  <div class="page">
    <p class="emitido">Emitido em ${esc(emitido)}</p>
    <div class="brand">
      <img src="/images/letreiro.png" alt="Alma Campeira" onerror="this.style.display='none'"/>
      <div class="brand-text">
        <h1>Alma Campeira CUTELARIA</h1>
        <p>Alma Campeira Facas Artesanais</p>
      </div>
    </div>
    ${corpo}
    <div class="footer">Gerado pelo sistema ERP Alma Campeira</div>
  </div>
</body>
</html>`

  const win = window.open('', '_blank')
  if (!win) {
    window.alert('Não foi possível abrir a janela de impressão. Verifique se o navegador permite pop-ups.')
    return
  }
  win.document.write(html)
  win.document.close()
  win.focus()
}

/** Pedido completo com valores — abre em nova aba com botão Imprimir. */
export function abrirImpressaoPedido(pedido: Pedido): void {
  const titulo = `Pedido ${pedido.sequencial != null ? `#${pedido.sequencial} · ` : ''}${pedido.codigo}`
  const status = STATUS_PEDIDO[pedido.status]

  const linhasVenda: string[] = [
    `<p><strong>Venda cód.</strong> ${esc(pedido.codigo)}</p>`,
    `<p><strong>Data da venda</strong> ${esc(fmtDataPedido(pedido.data_pedido))}</p>`,
    `<p><strong>Vendedor</strong> ${esc(pedido.vendedor?.nome?.trim() || '—')}</p>`,
    `<p><strong>Status</strong> ${esc(status.label)}</p>`,
  ]
  if (pedido.natureza_operacao?.trim()) {
    linhasVenda.push(`<p><strong>Natureza</strong> ${esc(pedido.natureza_operacao.trim())}</p>`)
  }
  if (pedido.entregue_at) {
    linhasVenda.push(
      `<p><strong>Entregue em</strong> ${esc(new Date(pedido.entregue_at).toLocaleDateString('pt-BR'))}</p>`,
    )
  }
  if (pedido.forma_pagamento) {
    linhasVenda.push(
      `<p><strong>Forma de pagamento</strong> ${esc(FORMAS_PAGAMENTO_OC[pedido.forma_pagamento].label)}</p>`,
    )
  }

  const itens = pedido.itens ?? []
  const linhasItens = itens
    .map((item) => {
      const f = item.faca
      return `<tr>
        <td>${esc(codigoOuId(item.faca_id, f?.codigo))}</td>
        <td>${esc(f?.nome ?? '—')}</td>
        <td class="num">${item.quantidade}</td>
        <td>${esc(f?.unidade?.trim() || '—')}</td>
        <td class="num">${esc(fmtBRL(item.preco_unitario))}</td>
        <td class="num">${esc(fmtBRL(item.subtotal))}</td>
      </tr>`
    })
    .join('')

  const subtotalItens = itens.reduce((s, i) => s + i.subtotal, 0)
  const frete = pedido.frete ?? 0
  const descontoTotal = pedido.desconto_total ?? 0
  const total = pedido.valor_total ?? Math.max(0, subtotalItens + frete - descontoTotal)

  let rodapeTotais = `<tr class="total-row">
    <td colspan="5" class="num">Subtotal dos itens</td>
    <td class="num">${esc(fmtBRL(subtotalItens))}</td>
  </tr>`
  if (frete > 0) {
    rodapeTotais += `<tr class="total-row">
      <td colspan="5" class="num">Frete</td>
      <td class="num">${esc(fmtBRL(frete))}</td>
    </tr>`
  }
  if (descontoTotal > 0) {
    rodapeTotais += `<tr class="total-row">
      <td colspan="5" class="num">Desconto no total</td>
      <td class="num">− ${esc(fmtBRL(descontoTotal))}</td>
    </tr>`
  }
  rodapeTotais += `<tr class="total-row">
    <td colspan="5" class="num">TOTAL DA VENDA</td>
    <td class="num">${esc(fmtBRL(total))}</td>
  </tr>`

  const corpo = `
    <h2 class="doc-title">${esc(titulo)}</h2>
    <p class="doc-subtitle">Pedido de venda</p>
    <div class="meta-box">
      ${blocoClienteHtml(pedido.cliente)}
      ${linhasVenda.join('\n')}
    </div>
    <table>
      <thead>
        <tr>
          <th>Cód.</th><th>Produto</th><th>Qtd.</th><th>Un.</th><th>Preço un.</th><th>Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${linhasItens || '<tr><td colspan="6">Sem itens</td></tr>'}
        ${rodapeTotais}
      </tbody>
    </table>
    ${pedido.observacao?.trim() ? `<div class="obs"><strong>Observação</strong>${esc(pedido.observacao.trim())}</div>` : ''}
  `

  abrirJanelaImpressao(titulo, corpo)
}

/** Venda sem valores — uso interno / produção. */
export function abrirImpressaoVendaSemValor(pedido: Pedido): void {
  const titulo = `Venda sem valores — ${pedido.codigo}`
  const itens = pedido.itens ?? []
  const obsPedido = pedido.observacao?.trim() ?? ''

  const linhasItens = itens
    .map((item) => {
      const f = item.faca
      return `<tr>
        <td>${esc(codigoOuId(item.faca_id, f?.codigo))}</td>
        <td>${esc(f?.ean_gtin?.trim() ?? '')}</td>
        <td>${esc(f?.nome ?? '—')}</td>
        <td>${esc(obsPedido)}</td>
        <td>produto</td>
        <td class="num">${item.quantidade}</td>
        <td>${esc(f?.unidade?.trim() || '—')}</td>
      </tr>`
    })
    .join('')

  const totalQtd = itens.reduce((s, i) => s + Number(i.quantidade) || 0, 0)

  const corpo = `
    <h2 class="doc-title">Venda sem valores</h2>
    <p class="doc-subtitle">Buscado por código: ${esc(pedido.codigo)}</p>
    <div class="meta-box">
      <p><strong>Venda cód.</strong> ${esc(pedido.codigo)}</p>
      <p><strong>Confirmação</strong> ${esc(fmtDataPedido(pedido.data_pedido))}</p>
      <p><strong>Cliente</strong> ${esc(pedido.cliente?.nome?.trim() || '—')}</p>
      <p><strong>Vendedor</strong> ${esc(pedido.vendedor?.nome?.trim() || '—')}</p>
    </div>
    <table>
      <thead>
        <tr>
          <th>Cód.</th><th>Cód. próprio</th><th>Produto</th><th>Obs adic</th><th>Tipo</th><th>Quantidade</th><th>Unidade</th>
        </tr>
      </thead>
      <tbody>
        ${linhasItens || '<tr><td colspan="7">Sem itens</td></tr>'}
        <tr class="total-row">
          <td colspan="5" class="num">TOTAL DA VENDA</td>
          <td class="num">${totalQtd}</td>
          <td></td>
        </tr>
        <tr class="total-row">
          <td colspan="5" class="num">TOTAL GERAL DO RELATÓRIO</td>
          <td class="num">${totalQtd}</td>
          <td></td>
        </tr>
      </tbody>
    </table>
  `

  abrirJanelaImpressao(titulo, corpo)
}
