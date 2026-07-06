'use server'

import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { assertPermissao, getAuthenticatedUser } from '@/lib/auth'
import { analisarReposicaoParaPedido } from '@/lib/ordens-compra/analisar-reposicao'
import type { FormaPagamentoOC, Pedido, PedidoItem, StatusPedido } from '@/types'
import { gerarCodigoForte } from '@/lib/utils/codigo'
import { criarBoleto, type ParcelaInput } from '@/lib/actions/boletos'

type DecimalLike = Prisma.Decimal | number | string | null | undefined

type PedidoClienteRow = {
  id: string
  nome: string
  tipo: string
  tipoDocumento: string
  documento: string | null
  cidade: string | null
  estado: string | null
  telefone: string | null
  email: string | null
  cep: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  razaoSocial: string | null
  ie: string | null
} | null

type PedidoVendedorRow = { id: string; nome: string } | null

type PedidoItemRow = {
  id: string
  pedidoId: string
  facaId: string
  quantidade: number
  precoUnitario: DecimalLike
  subtotal?: DecimalLike
  ncm: string | null
  cfop: string | null
  faca?: {
    id: string
    codigo: string
    nome: string
    precoVenda: DecimalLike
    fotoUrl: string | null
    unidade: string | null
    eanGtin: string | null
  } | null
}

type PedidoRow = {
  id: string
  codigo: string
  sequencial: bigint | null
  clienteId: string | null
  vendedorId: string | null
  dataPedido: string
  status: string
  observacao: string | null
  valorTotal: DecimalLike
  frete: DecimalLike
  descontoTotal: DecimalLike
  naturezaOperacao: string | null
  formaPagamento: string | null
  pago: boolean
  entregueAt: Date | null
  createdAt: Date
  cliente?: PedidoClienteRow
  vendedor?: PedidoVendedorRow
  itens?: PedidoItemRow[]
}

type FacaEstoqueRow = {
  id: string
  nome: string
  estoqueAtual: number
}

function num(value: DecimalLike): number {
  if (value == null) return 0
  if (typeof value === 'number') return value
  if (typeof value === 'string') return Number(value)
  return value.toNumber()
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

function normalizeStatusPedido(status: string): StatusPedido {
  if (status === 'em_espera' || status === 'em_producao' || status === 'entregue') return status
  if (status === 'orcamento' || status === 'confirmado') return 'em_espera'
  if (status === 'cancelado') return 'entregue'
  return 'em_espera'
}

function mapPedidoItem(item: PedidoItemRow): PedidoItem {
  return {
    id: item.id,
    pedido_id: item.pedidoId,
    faca_id: item.facaId,
    quantidade: item.quantidade,
    preco_unitario: num(item.precoUnitario),
    subtotal: item.subtotal == null ? num(item.precoUnitario) * item.quantidade : num(item.subtotal),
    ncm: item.ncm,
    cfop: item.cfop,
    faca: item.faca
      ? {
          id: item.faca.id,
          codigo: item.faca.codigo,
          nome: item.faca.nome,
          preco_venda: num(item.faca.precoVenda),
          foto_url: item.faca.fotoUrl,
          unidade: item.faca.unidade,
          ean_gtin: item.faca.eanGtin,
        }
      : undefined,
  }
}

function mapPedido(row: PedidoRow): Pedido {
  const itens = row.itens ? [...row.itens].sort((a, b) => a.id.localeCompare(b.id)).map(mapPedidoItem) : undefined
  return {
    id: row.id,
    codigo: row.codigo,
    sequencial: row.sequencial == null ? null : Number(row.sequencial),
    cliente_id: row.clienteId,
    vendedor_id: row.vendedorId,
    data_pedido: row.dataPedido,
    status: normalizeStatusPedido(String(row.status)),
    observacao: row.observacao,
    valor_total: row.valorTotal == null ? null : num(row.valorTotal),
    frete: num(row.frete),
    desconto_total: num(row.descontoTotal),
    natureza_operacao: row.naturezaOperacao,
    forma_pagamento: (row.formaPagamento as FormaPagamentoOC | null) ?? null,
    pago: Boolean(row.pago),
    entregue_at: iso(row.entregueAt),
    created_at: row.createdAt.toISOString(),
    cliente: row.cliente
      ? {
          id: row.cliente.id,
          nome: row.cliente.nome,
          tipo: row.cliente.tipo as any,
          tipo_documento: row.cliente.tipoDocumento as any,
          documento: row.cliente.documento,
          cidade: row.cliente.cidade,
          estado: row.cliente.estado,
          telefone: row.cliente.telefone,
          email: row.cliente.email,
          cep: row.cliente.cep,
          logradouro: row.cliente.logradouro,
          numero: row.cliente.numero,
          complemento: row.cliente.complemento,
          bairro: row.cliente.bairro,
          razao_social: row.cliente.razaoSocial,
          ie: row.cliente.ie,
        }
      : null,
    vendedor: row.vendedor ? { id: row.vendedor.id, nome: row.vendedor.nome } : null,
    itens,
  }
}

async function loadFiscalByFacaIds(facaIds: string[]): Promise<Map<string, { ncm: string | null; cfop: string | null }>> {
  const uniqueIds = [...new Set(facaIds)]
  if (uniqueIds.length === 0) return new Map()

  const fiscais = await prisma.faca.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, ncm: true, cfopPadrao: true },
  })

  return new Map(
    fiscais.map((f) => [f.id, { ncm: f.ncm ?? null, cfop: f.cfopPadrao ?? null }]),
  )
}

async function loadFacasEstoqueByIds(facaIds: string[]): Promise<Map<string, FacaEstoqueRow>> {
  const uniqueIds = [...new Set(facaIds)]
  if (uniqueIds.length === 0) return new Map()

  const facas = await prisma.faca.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, nome: true, estoqueAtual: true },
  })

  return new Map(facas.map((f) => [f.id, f]))
}

function normalizarFormaPagamento(forma?: FormaPagamentoOC | null): FormaPagamentoOC | null {
  if (
    forma === 'pix'
    || forma === 'dinheiro'
    || forma === 'cartao_credito'
    || forma === 'boleto'
    || forma === 'cheque'
    || forma === 'link'
  ) {
    return forma
  }
  return null
}

function assertClienteEVendedorObrigatorios(input: VendaInput) {
  if (!input.cliente_id?.trim()) throw new Error('Selecione um cliente.')
  if (!input.vendedor_id?.trim()) throw new Error('Selecione um vendedor.')
}

async function criarBoletoDaVenda(
  pedidoId: string,
  clienteId: string,
  vendedorId: string | null,
  codigo: string,
  parcelas: ParcelaInput[],
) {
  const parcelasValidas = (parcelas ?? []).filter((p) => p.vencimento && Number(p.valor) > 0)
  if (parcelasValidas.length === 0) return

  const existente = await prisma.boleto.findFirst({
    where: { pedidoId },
    select: { id: true },
  })
  if (existente) return

  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    select: { nome: true },
  })

  const valorTotal = parcelasValidas.reduce((s, p) => s + Number(p.valor), 0)

  await criarBoleto({
    tipo: 'entrada',
    contraparte_nome: cliente?.nome ?? 'Cliente',
    cliente_id: clienteId,
    vendedor_id: vendedorId ?? null,
    valor_total: valorTotal,
    emitido_em: new Date().toISOString().slice(0, 10),
    observacao: `Boleto gerado da venda ${codigo}`,
    pedido_id: pedidoId,
    parcelas: parcelasValidas,
  })
}

async function inserirItensPedido(pedidoId: string, itens: VendaItemInput[]) {
  const fiscais = await loadFiscalByFacaIds(itens.map((item) => item.faca_id))

  await prisma.pedidoItem.createMany({
    data: itens.map((item) => {
      const fiscal = fiscais.get(item.faca_id) ?? { ncm: null, cfop: null }
      return {
        pedidoId,
        facaId: item.faca_id,
        quantidade: item.quantidade,
        precoUnitario: item.preco_unitario,
        ncm: fiscal.ncm,
        cfop: fiscal.cfop,
      }
    }),
  })
}

async function sincronizarItensPedido(pedidoId: string, novos: VendaItemInput[]) {
  const atuais = await prisma.pedidoItem.findMany({
    where: { pedidoId },
    select: {
      id: true,
      facaId: true,
      quantidade: true,
      precoUnitario: true,
    },
    orderBy: { id: 'asc' },
  })

  const max = Math.max(atuais.length, novos.length)
  const facasParaFiscal = new Set<string>()

  for (let i = 0; i < max; i++) {
    const atual = atuais[i]
    const novo = novos[i]
    if (novo && (!atual || atual.facaId !== novo.faca_id)) {
      facasParaFiscal.add(novo.faca_id)
    }
  }

  const fiscais = await loadFiscalByFacaIds([...facasParaFiscal])

  for (let i = 0; i < max; i++) {
    const atual = atuais[i]
    const novo = novos[i]

    if (atual && novo) {
      const facaMudou = atual.facaId !== novo.faca_id
      const mudou =
        facaMudou ||
        Number(atual.quantidade) !== Number(novo.quantidade) ||
        num(atual.precoUnitario) !== Number(novo.preco_unitario)

      if (!mudou) continue

      const patch: Prisma.PedidoItemUpdateInput = {
        faca: { connect: { id: novo.faca_id } },
        quantidade: novo.quantidade,
        precoUnitario: novo.preco_unitario,
      }

      if (facaMudou) {
        const fiscal = fiscais.get(novo.faca_id) ?? { ncm: null, cfop: null }
        patch.ncm = fiscal.ncm
        patch.cfop = fiscal.cfop
      }

      await prisma.pedidoItem.update({
        where: { id: atual.id },
        data: patch,
      })
      continue
    }

    if (novo) {
      const fiscal = fiscais.get(novo.faca_id) ?? { ncm: null, cfop: null }
      await prisma.pedidoItem.create({
        data: {
          pedidoId,
          facaId: novo.faca_id,
          quantidade: novo.quantidade,
          precoUnitario: novo.preco_unitario,
          ncm: fiscal.ncm,
          cfop: fiscal.cfop,
        },
      })
      continue
    }

    if (atual) {
      await prisma.pedidoItem.delete({ where: { id: atual.id } })
    }
  }
}

async function reverterEntregaPedido(id: string, novoStatus: 'em_espera' | 'em_producao') {
  const itens = await prisma.pedidoItem.findMany({
    where: { pedidoId: id },
    select: { facaId: true, quantidade: true },
  })
  const facaMap = await loadFacasEstoqueByIds(itens.map((item) => item.facaId))
  const user = await getAuthenticatedUser()

  await prisma.$transaction(async (tx) => {
    for (const item of itens) {
      const faca = facaMap.get(item.facaId)
      if (!faca) continue

      const novoEstoque = Number(faca.estoqueAtual) + Number(item.quantidade)
      await tx.faca.update({
        where: { id: item.facaId },
        data: { estoqueAtual: novoEstoque },
      })
      await tx.movimentacaoEstoque.create({
        data: {
          tipo: 'ajuste',
          facaId: item.facaId,
          quantidade: item.quantidade,
          observacao: `Reversão de venda entregue (pedido ${id})`,
          usuarioId: user?.id ?? null,
        },
      })
      faca.estoqueAtual = novoEstoque
    }

    await tx.pedido.update({
      where: { id },
      data: { status: novoStatus, entregueAt: null },
    })
  })
}

async function executarEntregaPedido(id: string, itens: { faca_id: string; quantidade: number }[]) {
  const facaMap = await loadFacasEstoqueByIds(itens.map((item) => item.faca_id))

  const insuficientes = itens.filter((item) => {
    const faca = facaMap.get(item.faca_id)
    return !faca || faca.estoqueAtual < item.quantidade
  })

  if (insuficientes.length > 0) {
    const detalhes = insuficientes
      .map((item) => {
        const f = facaMap.get(item.faca_id)
        return `${f?.nome ?? 'Desconhecida'} (precisa ${item.quantidade}, tem ${f?.estoqueAtual ?? 0})`
      })
      .join('; ')
    throw new Error(`Estoque insuficiente: ${detalhes}`)
  }

  const user = await getAuthenticatedUser()

  await prisma.$transaction(async (tx) => {
    await tx.pedido.update({
      where: { id },
      data: { status: 'entregue', entregueAt: new Date() },
    })

    for (const item of itens) {
      const faca = facaMap.get(item.faca_id)!
      await tx.movimentacaoEstoque.create({
        data: {
          tipo: 'saida_venda',
          facaId: item.faca_id,
          pedidoId: id,
          quantidade: item.quantidade,
          usuarioId: user?.id ?? null,
        },
      })
      const novoEstoque = faca.estoqueAtual - item.quantidade
      await tx.faca.update({
        where: { id: item.faca_id },
        data: { estoqueAtual: novoEstoque },
      })
      faca.estoqueAtual = novoEstoque
    }
  })

  const resultado = await analisarReposicaoParaPedido(id)
  console.log(`[fila_reposicao] pedido=${id} criouFila=${resultado.criouFila} itens=${resultado.quantidadeItens}`)
}

export async function getVendas(limit = 80): Promise<Pedido[]> {
  await assertPermissao('vendas', 'ver')
  const data = await prisma.pedido.findMany({
    include: {
      cliente: {
        select: {
          id: true,
          nome: true,
          tipo: true,
          tipoDocumento: true,
          documento: true,
          cidade: true,
          estado: true,
          telefone: true,
          email: true,
          cep: true,
          logradouro: true,
          numero: true,
          complemento: true,
          bairro: true,
          razaoSocial: true,
          ie: true,
        },
      },
      vendedor: { select: { id: true, nome: true } },
      itens: {
        select: {
          id: true,
          pedidoId: true,
          facaId: true,
          quantidade: true,
          precoUnitario: true,
          subtotal: true,
          ncm: true,
          cfop: true,
        },
        orderBy: { id: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return data.map((row) => mapPedido(row as unknown as PedidoRow))
}

export async function getVendaDetalhe(id: string): Promise<Pedido> {
  await assertPermissao('vendas', 'ver')
  const data = await prisma.pedido.findUnique({
    where: { id },
    include: {
      cliente: {
        select: {
          id: true,
          nome: true,
          tipo: true,
          tipoDocumento: true,
          documento: true,
          cidade: true,
          estado: true,
          telefone: true,
          email: true,
          cep: true,
          logradouro: true,
          numero: true,
          complemento: true,
          bairro: true,
          razaoSocial: true,
          ie: true,
        },
      },
      vendedor: { select: { id: true, nome: true } },
      itens: {
        select: {
          id: true,
          pedidoId: true,
          facaId: true,
          quantidade: true,
          precoUnitario: true,
          subtotal: true,
          ncm: true,
          cfop: true,
          faca: {
            select: {
              id: true,
              codigo: true,
              nome: true,
              precoVenda: true,
              fotoUrl: true,
              unidade: true,
              eanGtin: true,
            },
          },
        },
        orderBy: { id: 'asc' },
      },
    },
  })

  if (!data) throw new Error('Venda não encontrada.')
  return mapPedido(data as unknown as PedidoRow)
}

export async function gerarCodigoPedido(): Promise<string> {
  return gerarCodigoForte('PD')
}

export type VendaItemInput = {
  faca_id: string
  quantidade: number
  preco_unitario: number
}

export type VendaInput = {
  cliente_id: string | null
  vendedor_id: string | null
  data_pedido: string
  observacao: string
  status: StatusPedido
  frete: number
  desconto_total: number
  natureza_operacao?: string
  forma_pagamento?: FormaPagamentoOC | null
  pago?: boolean
  boletoParcelas?: ParcelaInput[]
  confirmarEstoqueInsuficiente?: boolean
  itens: VendaItemInput[]
}

export async function criarVenda(input: VendaInput) {
  await assertPermissao('vendas', 'criar')
  assertClienteEVendedorObrigatorios(input)

  if (input.itens.length === 0) throw new Error('Adicione ao menos um item à venda.')

  if (!input.confirmarEstoqueInsuficiente) {
    const facaMap = await loadFacasEstoqueByIds(input.itens.map((item) => item.faca_id))
    const qtdPorFaca = new Map<string, number>()
    for (const item of input.itens) {
      qtdPorFaca.set(item.faca_id, (qtdPorFaca.get(item.faca_id) ?? 0) + item.quantidade)
    }

    const insuficientes = [...qtdPorFaca.entries()].filter(([facaId, qtd]) => {
      const faca = facaMap.get(facaId)
      return faca && faca.estoqueAtual < qtd
    })

    if (insuficientes.length > 0) {
      const detalhes = insuficientes
        .map(([facaId, qtd]) => {
          const f = facaMap.get(facaId)
          return `${f?.nome ?? 'Desconhecida'} (solicitado: ${qtd}, disponível: ${f?.estoqueAtual ?? 0})`
        })
        .join('; ')
      throw new Error(`Estoque insuficiente: ${detalhes}`)
    }
  }

  const codigo = await gerarCodigoPedido()
  const subtotalItens = input.itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)
  const frete = Math.max(0, input.frete || 0)
  const bruto = subtotalItens + frete
  const descontoTotal = Math.min(Math.max(0, input.desconto_total || 0), bruto)
  const valorTotal = bruto - descontoTotal
  const statusInsert = input.status === 'entregue' ? 'em_producao' : input.status
  const natureza = (input.natureza_operacao ?? '').trim() || 'VENDA DE MERCADORIA'
  const formaPagamento = normalizarFormaPagamento(input.forma_pagamento)
  const pago = !!input.pago && formaPagamento !== null && formaPagamento !== 'boleto'

  if (input.pago && !pago) {
    throw new Error('Selecione uma forma de pagamento (diferente de boleto) para marcar a venda como paga.')
  }

  const pedido = await prisma.pedido.create({
    data: {
      codigo,
      clienteId: input.cliente_id!.trim(),
      vendedorId: input.vendedor_id!.trim(),
      dataPedido: input.data_pedido,
      observacao: input.observacao.trim() || null,
      status: statusInsert,
      frete,
      descontoTotal,
      valorTotal,
      naturezaOperacao: natureza,
      formaPagamento,
      pago,
    },
    select: { id: true },
  })

  try {
    await inserirItensPedido(pedido.id, input.itens)
  } catch (e) {
    await prisma.pedido.delete({ where: { id: pedido.id } }).catch(() => {})
    throw e
  }

  if (formaPagamento === 'boleto' && (input.boletoParcelas?.length ?? 0) > 0) {
    await criarBoletoDaVenda(
      pedido.id,
      input.cliente_id!.trim(),
      input.vendedor_id?.trim() ?? null,
      codigo,
      input.boletoParcelas!,
    )
  }

  if (input.status === 'entregue') {
    const itensEntrega = input.itens.map((item) => ({ faca_id: item.faca_id, quantidade: item.quantidade }))
    await executarEntregaPedido(pedido.id, itensEntrega)
  }
}

export async function atualizarVenda(id: string, input: VendaInput) {
  await assertPermissao('vendas', 'editar')
  assertClienteEVendedorObrigatorios(input)

  if (input.itens.length === 0) throw new Error('Adicione ao menos um item à venda.')

  const pedidoAtual = await prisma.pedido.findUnique({
    where: { id },
    select: { status: true, codigo: true },
  })

  if (!pedidoAtual || normalizeStatusPedido(String(pedidoAtual.status)) === 'entregue') {
    throw new Error('Vendas entregues não podem ser editadas.')
  }

  const itensAtuais = await prisma.pedidoItem.findMany({
    where: { pedidoId: id },
    select: { facaId: true, quantidade: true },
  })

  const qtdAtualMap = new Map<string, number>()
  for (const item of itensAtuais) {
    qtdAtualMap.set(item.facaId, (qtdAtualMap.get(item.facaId) ?? 0) + Number(item.quantidade))
  }

  const deltaMap = new Map<string, number>()
  for (const item of input.itens) {
    const anterior = qtdAtualMap.get(item.faca_id) ?? 0
    const delta = item.quantidade - anterior
    if (delta > 0) deltaMap.set(item.faca_id, (deltaMap.get(item.faca_id) ?? 0) + delta)
  }

  if (!input.confirmarEstoqueInsuficiente && deltaMap.size > 0) {
    const facaMap = await loadFacasEstoqueByIds([...deltaMap.keys()])
    const insuficientes = [...deltaMap.keys()].filter((facaId) => {
      const faca = facaMap.get(facaId)
      return faca && faca.estoqueAtual < (deltaMap.get(facaId) ?? 0)
    })

    if (insuficientes.length > 0) {
      const detalhes = insuficientes
        .map((facaId) => {
          const faca = facaMap.get(facaId)
          return `${faca?.nome ?? 'Desconhecida'} (adicionar: ${deltaMap.get(facaId)}, disponível: ${faca?.estoqueAtual ?? 0})`
        })
        .join('; ')
      throw new Error(`Estoque insuficiente: ${detalhes}`)
    }
  }

  const subtotalItens = input.itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0)
  const frete = Math.max(0, input.frete || 0)
  const bruto = subtotalItens + frete
  const descontoTotal = Math.min(Math.max(0, input.desconto_total || 0), bruto)
  const valorTotal = bruto - descontoTotal
  const statusUpdate = input.status === 'entregue' ? 'em_producao' : input.status
  const naturezaUpd = (input.natureza_operacao ?? '').trim() || 'VENDA DE MERCADORIA'
  const formaPagamento = normalizarFormaPagamento(input.forma_pagamento)
  const pagoUpd = !!input.pago && formaPagamento !== null && formaPagamento !== 'boleto'

  if (input.pago && !pagoUpd) {
    throw new Error('Selecione uma forma de pagamento (diferente de boleto) para marcar a venda como paga.')
  }

  await prisma.pedido.update({
    where: { id },
    data: {
      clienteId: input.cliente_id!.trim(),
      vendedorId: input.vendedor_id!.trim(),
      dataPedido: input.data_pedido,
      observacao: input.observacao.trim() || null,
      status: statusUpdate,
      frete,
      descontoTotal,
      valorTotal,
      naturezaOperacao: naturezaUpd,
      formaPagamento,
      pago: pagoUpd,
    },
  })

  if (formaPagamento === 'boleto' && (input.boletoParcelas?.length ?? 0) > 0) {
    await criarBoletoDaVenda(
      id,
      input.cliente_id!.trim(),
      input.vendedor_id?.trim() ?? null,
      String(pedidoAtual.codigo ?? ''),
      input.boletoParcelas!,
    )
  }

  await sincronizarItensPedido(id, input.itens)

  if (input.status === 'entregue') {
    const itensEntrega = input.itens.map((item) => ({ faca_id: item.faca_id, quantidade: item.quantidade }))
    await executarEntregaPedido(id, itensEntrega)
  }
}

export async function avancarStatus(id: string, novoStatus: 'em_producao') {
  await assertPermissao('vendas', 'editar')
  await prisma.pedido.update({
    where: { id },
    data: { status: novoStatus },
  })
}

export async function alterarStatus(id: string, novoStatus: StatusPedido) {
  await assertPermissao('vendas', 'editar')

  const pedido = await prisma.pedido.findUnique({
    where: { id },
    select: {
      status: true,
      itens: {
        select: { facaId: true, quantidade: true },
      },
    },
  })

  if (!pedido) throw new Error('Venda não encontrada.')

  const statusAtual = normalizeStatusPedido(String(pedido.status))
  if (statusAtual === novoStatus) return

  if (statusAtual === 'entregue' && (novoStatus === 'em_espera' || novoStatus === 'em_producao')) {
    await reverterEntregaPedido(id, novoStatus)
    return
  }

  if (novoStatus === 'entregue') {
    await executarEntregaPedido(
      id,
      (pedido.itens ?? []).map((item) => ({ faca_id: item.facaId, quantidade: item.quantidade })),
    )
    return
  }

  await prisma.pedido.update({
    where: { id },
    data: { status: novoStatus },
  })
}

export async function marcarEntregue(id: string) {
  await assertPermissao('vendas', 'editar')

  const pedido = await prisma.pedido.findUnique({
    where: { id },
    select: {
      status: true,
      itens: { select: { facaId: true, quantidade: true } },
    },
  })

  if (!pedido) throw new Error('Venda não encontrada.')
  if (normalizeStatusPedido(String(pedido.status)) !== 'em_producao') {
    throw new Error('A venda precisa estar "Em Produção" para ser entregue.')
  }

  await executarEntregaPedido(
    id,
    (pedido.itens ?? []).map((item) => ({ faca_id: item.facaId, quantidade: item.quantidade })),
  )
}

export async function definirPagoVenda(id: string, pago: boolean) {
  await assertPermissao('vendas', 'editar')

  const pedido = await prisma.pedido.findUnique({
    where: { id },
    select: { formaPagamento: true },
  })

  if (!pedido) throw new Error('Venda não encontrada.')
  if (pedido.formaPagamento === 'boleto') {
    throw new Error('Vendas no boleto têm o recebimento controlado pelas parcelas.')
  }
  if (pago && !pedido.formaPagamento) {
    throw new Error('Selecione a forma de pagamento antes de marcar a venda como paga.')
  }

  await prisma.pedido.update({
    where: { id },
    data: { pago },
  })
}

export async function deletarVenda(id: string) {
  await assertPermissao('vendas', 'deletar')

  const pedido = await prisma.pedido.findUnique({
    where: { id },
    select: { status: true, codigo: true },
  })
  if (!pedido) throw new Error('Venda não encontrada.')

  const statusAtual = normalizeStatusPedido(String(pedido.status))
  const codigo = String(pedido.codigo ?? id)

  const boletos = await prisma.boleto.findMany({
    where: { pedidoId: id },
    select: {
      id: true,
      parcelas: {
        select: { id: true, pagoEm: true },
      },
    },
  })

  const temParcelaPaga = boletos.some((boleto) => boleto.parcelas.some((parcela) => !!parcela.pagoEm))
  if (temParcelaPaga) {
    throw new Error('Esta venda tem parcelas de boleto já recebidas. Estorne os recebimentos antes de excluir.')
  }

  const user = await getAuthenticatedUser()

  await prisma.$transaction(async (tx) => {
    if (statusAtual === 'entregue') {
      const itens = await tx.pedidoItem.findMany({
        where: { pedidoId: id },
        select: { facaId: true, quantidade: true },
      })
      const facas = await tx.faca.findMany({
        where: { id: { in: [...new Set(itens.map((item) => item.facaId))] } },
        select: { id: true, nome: true, estoqueAtual: true },
      })
      const facaMap = new Map(facas.map((f) => [f.id, f]))

      for (const item of itens) {
        const faca = facaMap.get(item.facaId)
        if (!faca) continue

        const novoEstoque = Number(faca.estoqueAtual) + Number(item.quantidade)
        await tx.faca.update({
          where: { id: item.facaId },
          data: { estoqueAtual: novoEstoque },
        })
        await tx.movimentacaoEstoque.create({
          data: {
            tipo: 'ajuste',
            facaId: item.facaId,
            quantidade: item.quantidade,
            observacao: `Devolução por exclusão da venda ${codigo}`,
            usuarioId: user?.id ?? null,
          },
        })
        faca.estoqueAtual = novoEstoque
      }
    }

    if (boletos.length > 0) {
      await tx.boleto.deleteMany({
        where: { id: { in: boletos.map((boleto) => boleto.id) } },
      })
    }

    await tx.pedido.delete({ where: { id } })
  })
}
