'use server'

import { Prisma } from '@prisma/client'
import { revalidateTag } from 'next/cache'
import { assertPermissao, getAuthenticatedUser, requireAuthenticatedUserId } from '@/lib/auth'
import { withTiming } from '@/lib/perf/timing'
import { prisma } from '@/lib/prisma'
import {
  fetchOrdensCompraList,
  fetchFilaReposicaoList as fetchFilaReposicaoListCached,
  fetchUsuariosRegistroOC,
} from '@/lib/cache/list-data'
import { gerarCodigoOC, gerarOCsDeFilaItens } from '@/lib/ordens-compra/gerar-oc-fila'
import { TIPO_GASTO_PAGAMENTO_OC } from '@/types'
import type {
  OrdemCompra,
  FilaReposicao,
  FilaReposicaoDetalhe,
  FilaReposicaoItem,
  FilaReposicaoPedidoItem,
  StatusOC,
} from '@/types'

async function revalidateOCLists(opts: { estoque?: boolean } = {}) {
  try {
    const userId = await requireAuthenticatedUserId()
    revalidateTag(`list-ordens-compra-${userId}`, 'max')
    revalidateTag(`list-fila-reposicao-${userId}`, 'max')
    if (opts.estoque) {
      revalidateTag(`list-materias-primas-${userId}`, 'max')
    }
  } catch {
    // ignorar
  }
}

const STATUS_OC_VALIDOS: readonly StatusOC[] = ['pendente', 'enviada', 'recebida']
const ERRO_CATEGORIA_MISTURADA = 'Uma ordem de compra não pode misturar matérias-primas de categorias diferentes.'

function normalizarCategoriaOC(categoria: string | null | undefined): string {
  return (categoria ?? '').trim()
}

function nomeCategoriaOC(categoria: string | null | undefined): string {
  const nome = normalizarCategoriaOC(categoria)
  return nome || 'Sem categoria'
}

function validarCategoriasUnicasOC(categorias: Iterable<string | null | undefined>): string {
  const unicas = new Set<string>()
  for (const categoria of categorias) {
    unicas.add(normalizarCategoriaOC(categoria))
  }

  if (unicas.size > 1) {
    throw new Error(ERRO_CATEGORIA_MISTURADA)
  }

  return unicas.values().next().value ?? ''
}

function normalizarStatusEPago(row: { status?: unknown; pago?: unknown }): { status: StatusOC; pago: boolean } {
  let status = String(row.status ?? 'pendente')
  let pago = Boolean(row.pago)
  if (status === 'pago') {
    status = 'enviada'
    pago = true
  }
  if (!STATUS_OC_VALIDOS.includes(status as StatusOC)) status = 'pendente'
  return { status: status as StatusOC, pago }
}

function numberFrom(value: Prisma.Decimal | number | null | undefined): number {
  if (typeof value === 'number') return value
  return value?.toNumber() ?? 0
}

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value)
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

function subtotalOCFromItens(
  itens: Iterable<{ quantidade?: Prisma.Decimal | number | null; precoUnitario?: Prisma.Decimal | number | null }>,
): number {
  let total = 0
  for (const item of itens) {
    total += numberFrom(item.quantidade) * numberFrom(item.precoUnitario)
  }
  return roundCurrency(total)
}

function normalizarPercentualDesconto(percentual: number): number {
  if (!Number.isFinite(percentual) || percentual < 0 || percentual > 100) {
    throw new Error('Percentual de desconto inválido (use 0 a 100%).')
  }
  return percentual
}

function calcularDescontoTotal(subtotal: number, percentual: number): number {
  const percentualNormalizado = normalizarPercentualDesconto(percentual)
  if (subtotal <= 0 || percentualNormalizado <= 0) return 0
  return Math.min(subtotal, roundCurrency((subtotal * percentualNormalizado) / 100))
}

function calcularTotalLiquidoOC(subtotal: number, descontoTotal: number): number {
  return Math.max(0, roundCurrency(subtotal - descontoTotal))
}

function camposRegistroAlteracao(usuarioId: string) {
  return {
    ultimaAlteracaoUsuarioId: usuarioId,
    ultimaAlteracaoEm: new Date(),
  }
}

async function resolverUsuarioRegistroOC(usuarioRegistroId: string | null | undefined): Promise<string> {
  const user = await getAuthenticatedUser()
  if (!user?.id) throw new Error('Não autenticado.')

  const escolha = typeof usuarioRegistroId === 'string' ? usuarioRegistroId.trim() : ''
  const alvo = escolha || user.id
  if (alvo === user.id) return user.id

  const perfil = await prisma.usuarioPerfil.findFirst({
    where: { id: alvo, ativo: true },
    select: { id: true },
  })

  if (!perfil) throw new Error('Usuário selecionado inválido ou inativo.')
  return alvo
}

async function marcarUltimaAlteracaoOC(ordemCompraId: string, usuarioId: string) {
  await prisma.ordemCompra.update({
    where: { id: ordemCompraId },
    data: camposRegistroAlteracao(usuarioId),
  })
  await revalidateOCLists()
}

async function getCategoriaEfetivaOC(ordemCompraId: string): Promise<string | null> {
  const itens = await prisma.ordemCompraItem.findMany({
    where: { ordemCompraId },
    select: {
      materiaPrima: {
        select: { categoria: true },
      },
    },
  })

  if (itens.length === 0) return null
  return validarCategoriasUnicasOC(itens.map((item) => item.materiaPrima?.categoria))
}

async function nextSequencialFornecedor(
  tx: Prisma.TransactionClient,
  fornecedorId: string | null,
): Promise<number> {
  const agregado = await tx.ordemCompra.aggregate({
    where: { fornecedorId },
    _max: { sequencialFornecedor: true },
  })

  return (agregado._max.sequencialFornecedor ?? 0) + 1
}

function quantidadeMovimentacao(valor: Prisma.Decimal | number): number {
  const numero = numberFrom(valor)
  if (!Number.isFinite(numero)) throw new Error('Quantidade de movimentação inválida.')
  if (!Number.isInteger(numero)) {
    throw new Error('A movimentação de estoque da OC requer quantidade inteira.')
  }
  return numero
}

async function aplicarMovimentacaoStatusRecebida(
  tx: Prisma.TransactionClient,
  ordemCompraId: string,
  usuarioId: string,
  modo: 'receber' | 'reverter',
) {
  const oc = await tx.ordemCompra.findUnique({
    where: { id: ordemCompraId },
    select: { codigo: true },
  })
  if (!oc) throw new Error('OC não encontrada.')

  const itens = await tx.ordemCompraItem.findMany({
    where: { ordemCompraId },
    select: { materiaPrimaId: true, quantidade: true },
  })

  const observacao =
    modo === 'receber'
      ? oc.codigo
        ? `Recebimento — ${oc.codigo}`
        : 'Recebimento OC'
      : oc.codigo
        ? `Reversão de recebimento — ${oc.codigo}`
        : 'Reversão de recebimento OC'

  for (const item of itens) {
    const quantidade = item.quantidade
    await tx.materiaPrima.update({
      where: { id: item.materiaPrimaId },
      data: {
        estoqueAtual:
          modo === 'receber'
            ? { increment: quantidade }
            : { decrement: quantidade },
      },
    })

    await tx.movimentacaoEstoque.create({
      data: {
        tipo: modo === 'receber' ? 'entrada' : 'ajuste',
        materiaPrimaId: item.materiaPrimaId,
        quantidade: modo === 'receber'
          ? quantidadeMovimentacao(quantidade)
          : -quantidadeMovimentacao(quantidade),
        observacao,
        usuarioId,
      },
    })
  }
}

export async function getUsuariosParaRegistroOC(): Promise<{ id: string; nome: string }[]> {
  await assertPermissao('ordens_compra', 'editar')
  const userId = await requireAuthenticatedUserId()
  return fetchUsuariosRegistroOC(userId)
}

export async function getFilaReposicaoList(): Promise<FilaReposicao[]> {
  await assertPermissao('ordens_compra', 'ver')
  const userId = await requireAuthenticatedUserId()
  return fetchFilaReposicaoListCached(userId)
}

export async function getFilaReposicaoDetalhe(fila_id: string): Promise<FilaReposicaoDetalhe> {
  await assertPermissao('ordens_compra', 'ver')

  const filaRow = await prisma.filaReposicao.findUnique({
    where: { id: fila_id },
    include: {
      pedido: {
        include: {
          cliente: { select: { id: true, nome: true } },
          itens: {
            include: {
              faca: {
                include: {
                  bom: {
                    include: {
                      materiaPrima: {
                        select: {
                          id: true,
                          codigo: true,
                          categoria: true,
                          nome: true,
                          estoqueAtual: true,
                          estoqueMinimo: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      itens: {
        include: {
          materiaPrima: {
            include: {
              fornecedor: { select: { id: true, nome: true } },
              facaLinks: {
                include: {
                  faca: {
                    select: { id: true, nome: true, estoqueAtual: true, estoqueMinimo: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!filaRow) throw new Error('Fila não encontrada.')

  const pedido = filaRow.pedido
  const cliente = pedido?.cliente ?? null

  const pedido_itens: FilaReposicaoPedidoItem[] = (pedido?.itens ?? []).map((pi) => ({
    faca_id: pi.facaId,
    faca_codigo: pi.faca.codigo ?? '—',
    faca_nome: pi.faca.nome ?? '—',
    quantidade: Number(pi.quantidade),
    preco_unitario: numberFrom(pi.precoUnitario),
    materias_primas: pi.faca.bom.map((fm) => ({
      mp_id: fm.materiaPrima.id,
      mp_codigo: fm.materiaPrima.codigo,
      mp_nome: fm.materiaPrima.nome,
      quantidade_por_faca: numberFrom(fm.quantidade),
      estoque_atual: numberFrom(fm.materiaPrima.estoqueAtual),
      estoque_minimo: numberFrom(fm.materiaPrima.estoqueMinimo),
    })),
  }))

  const fila: FilaReposicao = {
    id: filaRow.id,
    pedido_id: filaRow.pedidoId,
    pedido_codigo: pedido?.codigo ?? '—',
    pedido_sequencial: pedido?.sequencial ? Number(pedido.sequencial) : null,
    cliente_nome: cliente?.nome ?? '—',
    status: filaRow.status as FilaReposicao['status'],
    created_at: filaRow.createdAt.toISOString(),
    itens_count: filaRow.itens.length,
  }

  const itens: FilaReposicaoItem[] = filaRow.itens.map((row) => ({
    id: row.id,
    fila_id: row.filaId,
    materia_prima_id: row.materiaPrimaId,
    mp_nome: row.materiaPrima.nome,
    mp_codigo: row.materiaPrima.codigo,
    categoria: row.materiaPrima.categoria,
    mp_preco_custo: numberFrom(row.materiaPrima.precoCusto),
    fornecedor_id: row.materiaPrima.fornecedorId ?? null,
    fornecedor_nome: row.materiaPrima.fornecedor?.nome ?? null,
    estoque_atual: numberFrom(row.materiaPrima.estoqueAtual),
    estoque_minimo: numberFrom(row.materiaPrima.estoqueMinimo),
    quantidade_sugerida: numberFrom(row.quantidadeSugerida),
    quantidade_adicional: numberFrom(row.quantidadeAdicional),
    selecionado: row.selecionado,
    facas_relacionadas: row.materiaPrima.facaLinks.map((fm) => ({
      faca_id: fm.faca.id,
      faca_nome: fm.faca.nome,
      estoque_atual: Number(fm.faca.estoqueAtual),
      estoque_minimo: Number(fm.faca.estoqueMinimo),
      quantidade_bom: numberFrom(fm.quantidade),
    })),
  }))

  return { fila, itens, pedido_itens }
}

export async function atualizarItemFila(
  item_id: string,
  patch: { selecionado?: boolean; quantidade_adicional?: number },
) {
  await assertPermissao('ordens_compra', 'editar')

  const itemAtual = await prisma.filaReposicaoItem.findUnique({
    where: { id: item_id },
    select: { quantidadeSugerida: true },
  })

  if (!itemAtual) throw new Error('Item da fila não encontrado.')

  const update: Prisma.FilaReposicaoItemUpdateInput = {}
  if (patch.selecionado !== undefined) update.selecionado = patch.selecionado
  if (patch.quantidade_adicional !== undefined) {
    if (!Number.isFinite(patch.quantidade_adicional)) {
      throw new Error('Quantidade adicional inválida.')
    }
    const total = numberFrom(itemAtual.quantidadeSugerida) + patch.quantidade_adicional
    if (total < 0) throw new Error('A quantidade total não pode ser negativa.')
    update.quantidadeAdicional = decimal(patch.quantidade_adicional)
  }

  await prisma.filaReposicaoItem.update({
    where: { id: item_id },
    data: update,
  })

  await revalidateOCLists()
}

export async function gerarOCsDaFila(fila_id: string): Promise<string[]> {
  await assertPermissao('ordens_compra', 'criar')
  const uid = await resolverUsuarioRegistroOC(undefined)
  const codigos = await gerarOCsDeFilaItens(fila_id, uid)
  await revalidateOCLists()
  return codigos
}

export async function dispensarFila(fila_id: string): Promise<void> {
  await assertPermissao('ordens_compra', 'editar')

  const fila = await prisma.filaReposicao.findUnique({
    where: { id: fila_id },
    select: { status: true },
  })

  if (!fila) throw new Error('Fila não encontrada.')
  if (fila.status !== 'pendente') {
    throw new Error('Somente filas pendentes podem ser dispensadas.')
  }

  await prisma.filaReposicao.update({
    where: { id: fila_id },
    data: { status: 'dispensada', updatedAt: new Date() },
  })

  await revalidateOCLists()
}

export type CriarOcItemManual = {
  materia_prima_id: string
  quantidade: number
  preco_unitario?: number | null
}

export async function criarOrdemCompraManual(input: {
  fornecedor_id: string | null
  categoria: string | null
  desconto_percentual?: number | null
  observacao?: string | null
  itens: CriarOcItemManual[]
}): Promise<string> {
  await assertPermissao('ordens_compra', 'criar')

  const linhas = input.itens?.filter((i) => i.materia_prima_id) ?? []
  if (linhas.length === 0) throw new Error('Adicione ao menos um item com matéria-prima.')
  const categoriaSelecionada = normalizarCategoriaOC(input.categoria)
  if (!categoriaSelecionada) throw new Error('Selecione a categoria da ordem de compra.')

  const mpIds = [...new Set(linhas.map((i) => i.materia_prima_id))]
  const mps = await prisma.materiaPrima.findMany({
    where: { id: { in: mpIds } },
    select: { id: true, precoCusto: true, categoria: true },
  })

  if (mps.length !== mpIds.length) {
    throw new Error('Uma ou mais matérias-primas não foram encontradas.')
  }

  const categoriaItens = validarCategoriasUnicasOC(mps.map((mp) => mp.categoria))
  if (categoriaItens !== categoriaSelecionada) {
    throw new Error(ERRO_CATEGORIA_MISTURADA)
  }
  const descontoPercentual = normalizarPercentualDesconto(Number(input.desconto_percentual ?? 0))

  const custoPorId = new Map(mps.map((m) => [m.id, numberFrom(m.precoCusto)]))
  const agregado = new Map<string, { quantidade: number; subtotal: number }>()

  for (const row of linhas) {
    const quantidade = Number(row.quantidade)
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      throw new Error('Cada quantidade deve ser maior que zero.')
    }

    const precoUnitario =
      row.preco_unitario != null
        ? Number(row.preco_unitario)
        : (custoPorId.get(row.materia_prima_id) ?? 0)

    if (!Number.isFinite(precoUnitario) || precoUnitario < 0) {
      throw new Error('Preço unitário inválido.')
    }

    const atual = agregado.get(row.materia_prima_id) ?? { quantidade: 0, subtotal: 0 }
    atual.quantidade += quantidade
    atual.subtotal += quantidade * precoUnitario
    agregado.set(row.materia_prima_id, atual)
  }

  const codigo = await gerarCodigoOC()
  const uidCriacao = await resolverUsuarioRegistroOC(undefined)
  const subtotal = Array.from(agregado.values()).reduce((sum, item) => sum + item.subtotal, 0)
  const descontoTotal = calcularDescontoTotal(subtotal, descontoPercentual)

  await prisma.$transaction(async (tx) => {
    const sequencialFornecedor = await nextSequencialFornecedor(tx, input.fornecedor_id ?? null)

    await tx.ordemCompra.create({
      data: {
        codigo,
        fornecedorId: input.fornecedor_id ?? null,
        sequencialFornecedor,
        status: 'pendente',
        dataGeracao: new Date(),
        descontoTotal: decimal(descontoTotal),
        observacao: input.observacao?.trim() || null,
        ...camposRegistroAlteracao(uidCriacao),
        itens: {
          create: Array.from(agregado.entries()).map(([materiaPrimaId, value]) => ({
            materiaPrimaId,
            quantidadeVendida: decimal(0),
            quantidadeAdicional: decimal(value.quantidade),
            quantidade: decimal(value.quantidade),
            precoUnitario: decimal(value.quantidade > 0 ? value.subtotal / value.quantidade : 0),
          })),
        },
      },
      select: { id: true },
    })
  })

  await revalidateOCLists()
  return codigo
}

async function getOrdensCompraQuery(): Promise<OrdemCompra[]> {
  const userId = await requireAuthenticatedUserId()
  return fetchOrdensCompraList(userId)
}

export async function getOrdensCompra(): Promise<OrdemCompra[]> {
  await assertPermissao('ordens_compra', 'ver')
  return withTiming('getOrdensCompra', () => getOrdensCompraQuery())
}

export async function atualizarQuantidadeItem(item_id: string, quantidade: number, usuarioRegistroId?: string | null) {
  await assertPermissao('ordens_compra', 'editar')
  if (quantidade <= 0) throw new Error('Quantidade deve ser maior que zero.')

  const uid = await resolverUsuarioRegistroOC(usuarioRegistroId)
  const item = await prisma.ordemCompraItem.findUnique({
    where: { id: item_id },
    select: { quantidadeVendida: true, quantidade: true, ordemCompraId: true },
  })

  if (!item) throw new Error('Item não encontrado.')

  const quantidadeVendida = numberFrom(item.quantidadeVendida ?? item.quantidade)
  const quantidadeAdicional = Math.max(0, quantidade - quantidadeVendida)

  await prisma.ordemCompraItem.update({
    where: { id: item_id },
    data: {
      quantidade: decimal(quantidade),
      quantidadeAdicional: decimal(quantidadeAdicional),
    },
  })

  await marcarUltimaAlteracaoOC(item.ordemCompraId, uid)
}

export async function atualizarUnidadesAdicionaisItem(
  item_id: string,
  quantidade_adicional: number,
  usuarioRegistroId?: string | null,
) {
  await assertPermissao('ordens_compra', 'editar')
  if (!Number.isFinite(quantidade_adicional) || quantidade_adicional < 0) {
    throw new Error('Unidades adicionais inválidas.')
  }

  const uid = await resolverUsuarioRegistroOC(usuarioRegistroId)
  const item = await prisma.ordemCompraItem.findUnique({
    where: { id: item_id },
    select: { quantidadeVendida: true, ordemCompraId: true },
  })

  if (!item) throw new Error('Item não encontrado.')

  const quantidadeVendida = numberFrom(item.quantidadeVendida)
  const quantidadeTotal = quantidadeVendida + Number(quantidade_adicional)
  if (quantidadeTotal <= 0) throw new Error('Quantidade total inválida.')

  await prisma.ordemCompraItem.update({
    where: { id: item_id },
    data: {
      quantidadeAdicional: decimal(quantidade_adicional),
      quantidade: decimal(quantidadeTotal),
    },
  })

  await marcarUltimaAlteracaoOC(item.ordemCompraId, uid)
}

export async function criarItemOrdemCompra(
  ordem_compra_id: string,
  materia_prima_id: string,
  quantidade_adicional: number,
  usuarioRegistroId?: string | null,
) {
  await assertPermissao('ordens_compra', 'editar')
  if (!Number.isFinite(quantidade_adicional) || quantidade_adicional <= 0) {
    throw new Error('Unidades adicionais devem ser maiores que zero.')
  }

  const uid = await resolverUsuarioRegistroOC(usuarioRegistroId)
  const mp = await prisma.materiaPrima.findUnique({
    where: { id: materia_prima_id },
    select: { precoCusto: true, categoria: true },
  })

  if (!mp) throw new Error('Matéria-prima não encontrada.')

  const categoriaAtualOC = await getCategoriaEfetivaOC(ordem_compra_id)
  const categoriaNova = normalizarCategoriaOC(mp.categoria)
  if (categoriaAtualOC && categoriaAtualOC !== categoriaNova) {
    throw new Error(`Esta ordem de compra aceita apenas itens da categoria "${nomeCategoriaOC(categoriaAtualOC)}".`)
  }

  await prisma.ordemCompraItem.create({
    data: {
      ordemCompraId: ordem_compra_id,
      materiaPrimaId: materia_prima_id,
      quantidadeVendida: decimal(0),
      quantidadeAdicional: decimal(quantidade_adicional),
      quantidade: decimal(quantidade_adicional),
      precoUnitario: mp.precoCusto,
    },
  })

  await marcarUltimaAlteracaoOC(ordem_compra_id, uid)
}

export async function atualizarObservacaoOC(
  id: string,
  observacao: string,
  usuarioRegistroId?: string | null,
) {
  await assertPermissao('ordens_compra', 'editar')
  const uid = await resolverUsuarioRegistroOC(usuarioRegistroId)

  await prisma.ordemCompra.update({
    where: { id },
    data: {
      observacao: observacao.trim() || null,
      ...camposRegistroAlteracao(uid),
    },
  })

  await revalidateOCLists()
}

export async function atualizarDescontoOC(
  id: string,
  descontoPercentual: number,
  usuarioRegistroId?: string | null,
) {
  await assertPermissao('ordens_compra', 'editar')
  const uid = await resolverUsuarioRegistroOC(usuarioRegistroId)
  const percentual = normalizarPercentualDesconto(descontoPercentual)

  const subtotal = subtotalOCFromItens(
    await prisma.ordemCompraItem.findMany({
      where: { ordemCompraId: id },
      select: { quantidade: true, precoUnitario: true },
    }),
  )

  await prisma.ordemCompra.update({
    where: { id },
    data: {
      descontoTotal: decimal(calcularDescontoTotal(subtotal, percentual)),
      ...camposRegistroAlteracao(uid),
    },
  })

  await revalidateOCLists()
}

export async function mudarStatusOC(
  id: string,
  status: StatusOC,
  usuarioRegistroId?: string | null,
) {
  await assertPermissao('ordens_compra', 'editar')
  const uid = await resolverUsuarioRegistroOC(usuarioRegistroId)

  const atual = await prisma.ordemCompra.findUnique({
    where: { id },
    select: { status: true },
  })

  if (!atual) throw new Error('OC não encontrada.')
  const statusAtual = normalizarStatusEPago(atual).status
  if (statusAtual === status) return

  await prisma.$transaction(async (tx) => {
    if (statusAtual === 'recebida' && status !== 'recebida') {
      await aplicarMovimentacaoStatusRecebida(tx, id, uid, 'reverter')
    }

    if (status === 'recebida') {
      await aplicarMovimentacaoStatusRecebida(tx, id, uid, 'receber')
    }

    await tx.ordemCompra.update({
      where: { id },
      data: {
        status,
        ...camposRegistroAlteracao(uid),
      },
    })
  })

  await revalidateOCLists({ estoque: true })
}

export async function definirPagoOrdemCompra(
  id: string,
  pago: boolean,
  usuarioRegistroId?: string | null,
  formaPagamento?: string | null,
) {
  await assertPermissao('ordens_compra', 'editar')
  const uid = await resolverUsuarioRegistroOC(usuarioRegistroId)

  await prisma.$transaction(async (tx) => {
    if (pago && formaPagamento !== 'boleto') {
      const oc = await tx.ordemCompra.findUnique({
        where: { id },
        include: {
          fornecedor: { select: { nome: true } },
          itens: { select: { quantidade: true, precoUnitario: true } },
        },
      })

      if (!oc) throw new Error('OC não encontrada.')

      const subtotal = subtotalOCFromItens(oc.itens)
      const valorTotal = calcularTotalLiquidoOC(subtotal, numberFrom(oc.descontoTotal))

      const descricao = oc.fornecedor?.nome
        ? `Pagamento OC ${oc.codigo} — ${oc.fornecedor.nome}`
        : `Pagamento OC ${oc.codigo}`

      const gastoExistente = await tx.gasto.findFirst({
        where: {
          ordemCompraId: id,
          tipo: TIPO_GASTO_PAGAMENTO_OC,
          boletoParcelaId: null,
        },
        select: { id: true },
      })

      if (!gastoExistente) {
        const forma = formaPagamento === 'cartao_credito' ? 'cartao_credito'
          : formaPagamento === 'dinheiro' ? 'dinheiro'
          : formaPagamento === 'pix' ? 'pix'
          : formaPagamento === 'cheque' ? 'cheque'
          : formaPagamento === 'link' ? 'link'
          : formaPagamento === 'boleto' ? 'boleto'
          : 'transferencia'

        await tx.gasto.create({
          data: {
            tipo: TIPO_GASTO_PAGAMENTO_OC,
            descricao,
            valor: decimal(valorTotal),
            formaPagamento: forma,
            dataGasto: new Date(),
            ordemCompraId: id,
            usuarioId: uid,
          },
        })
      }
    } else if (!pago) {
      await tx.gasto.deleteMany({
        where: {
          ordemCompraId: id,
          tipo: TIPO_GASTO_PAGAMENTO_OC,
          boletoParcelaId: null,
        },
      })
    }

    await tx.ordemCompra.update({
      where: { id },
      data: {
        pago,
        ...camposRegistroAlteracao(uid),
      },
    })
  })

  await revalidateOCLists()
}

export async function salvarAlteracoesOC(input: {
  id: string
  observacao?: string | null
  desconto_percentual?: number | null
  pago?: boolean
  forma_pagamento?: string | null
  status?: StatusOC
  itensQtd?: { item_id: string; quantidade_adicional: number }[]
  usuarioRegistroId?: string | null
}): Promise<void> {
  await assertPermissao('ordens_compra', 'editar')

  if (input.itensQtd?.length) {
    for (const { item_id, quantidade_adicional } of input.itensQtd) {
      await atualizarUnidadesAdicionaisItem(item_id, quantidade_adicional, input.usuarioRegistroId)
    }
  }

  if (input.observacao !== undefined) {
    await atualizarObservacaoOC(input.id, input.observacao ?? '', input.usuarioRegistroId)
  }

  if (input.desconto_percentual !== undefined) {
    await atualizarDescontoOC(input.id, Number(input.desconto_percentual ?? 0), input.usuarioRegistroId)
  }

  if (input.forma_pagamento !== undefined) {
    const uid = await resolverUsuarioRegistroOC(input.usuarioRegistroId)
    await prisma.ordemCompra.update({
      where: { id: input.id },
      data: {
        formaPagamento: input.forma_pagamento,
        ...camposRegistroAlteracao(uid),
      },
    })
    await revalidateOCLists()
  }

  if (input.pago !== undefined) {
    await definirPagoOrdemCompra(input.id, input.pago, input.usuarioRegistroId, input.forma_pagamento)
  }

  if (input.status !== undefined) {
    await mudarStatusOC(input.id, input.status, input.usuarioRegistroId)
  }
}

export async function deletarOC(id: string) {
  await assertPermissao('ordens_compra', 'deletar')

  const oc = await prisma.ordemCompra.findUnique({
    where: { id },
    select: { status: true },
  })

  if (!oc) throw new Error('OC não encontrada.')
  if (oc.status !== 'pendente') throw new Error('Apenas OCs pendentes podem ser excluídas.')

  await prisma.ordemCompra.delete({ where: { id } })
  await revalidateOCLists()
}
