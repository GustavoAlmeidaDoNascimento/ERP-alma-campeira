import { unstable_cache } from "next/cache";
import { withTiming } from "@/lib/perf/timing";
import { prisma } from "@/lib/prisma";
import { mapCliente } from "@/lib/prisma-auth-mappers";
import type {
  MateriaPrima,
  Fornecedor,
  CategoriaMateriaPrimaDB,
  Faca,
  CategoriaFacaDB,
  Cliente,
  OrdemCompra,
  FilaReposicao,
  StatusOC,
} from "@/types";

const STATUS_OC_VALIDOS: readonly StatusOC[] = ["pendente", "enviada", "recebida"];
function normalizarStatusEPagoCache(row: { status?: unknown; pago?: unknown }): {
  status: StatusOC;
  pago: boolean;
} {
  let status = String(row.status ?? "pendente");
  let pago = Boolean(row.pago);
  if (status === "pago") {
    status = "enviada";
    pago = true;
  }
  if (!STATUS_OC_VALIDOS.includes(status as StatusOC)) status = "pendente";
  return { status: status as StatusOC, pago };
}
function embedUm<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

type TaxasLucroConfig = {
  taxa_producao: number;
  margem_lucro: number;
  taxa_comissao: number;
};

const LIST_REVALIDATE = 60;

function decimalToNumber(value: { toNumber(): number } | number | null | undefined): number {
  if (typeof value === "number") return value;
  return value?.toNumber() ?? 0;
}

function mapFornecedor(row: {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  tipoDocumento: "cnpj" | "cpf";
  documento: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  razaoSocial: string | null;
  ie: string | null;
  codigoMunicipioIbge: string | null;
  createdAt: Date;
}): Fornecedor {
  return {
    id: row.id,
    nome: row.nome,
    telefone: row.telefone,
    email: row.email,
    tipo_documento: row.tipoDocumento,
    documento: row.documento,
    cep: row.cep,
    logradouro: row.logradouro,
    numero: row.numero,
    complemento: row.complemento,
    bairro: row.bairro,
    cidade: row.cidade,
    uf: row.uf,
    razao_social: row.razaoSocial,
    ie: row.ie,
    codigo_municipio_ibge: row.codigoMunicipioIbge,
    created_at: row.createdAt.toISOString(),
  };
}

function mapMateriaPrima(row: {
  id: string;
  codigo: string;
  sku: string;
  nome: string;
  categoria: string;
  fornecedorId: string | null;
  fotoUrl: string | null;
  precoCusto: { toNumber(): number };
  estoqueAtual: { toNumber(): number };
  estoqueMinimo: { toNumber(): number };
  createdAt: Date;
  fornecedor: { id: string; nome: string } | null;
}): MateriaPrima {
  return {
    id: row.id,
    codigo: row.codigo,
    sku: row.sku,
    nome: row.nome,
    categoria: row.categoria,
    fornecedor_id: row.fornecedorId,
    foto_url: row.fotoUrl,
    preco_custo: row.precoCusto.toNumber(),
    estoque_atual: row.estoqueAtual.toNumber(),
    estoque_minimo: row.estoqueMinimo.toNumber(),
    created_at: row.createdAt.toISOString(),
    fornecedor: row.fornecedor
      ? {
          id: row.fornecedor.id,
          nome: row.fornecedor.nome,
          telefone: null,
          email: null,
          tipo_documento: "cnpj",
          documento: null,
          cep: null,
          logradouro: null,
          numero: null,
          complemento: null,
          bairro: null,
          cidade: null,
          uf: null,
          razao_social: null,
          ie: null,
          codigo_municipio_ibge: null,
          created_at: "",
        }
      : null,
  };
}

function materiasPrimasCache(userId: string) {
  return unstable_cache(
    async (): Promise<MateriaPrima[]> => {
      const data = await prisma.materiaPrima.findMany({
        orderBy: { codigo: "asc" },
        include: {
          fornecedor: {
            select: { id: true, nome: true },
          },
        },
      });
      return data.map(mapMateriaPrima);
    },
    ["list-materias-primas", userId],
    { revalidate: LIST_REVALIDATE, tags: [`list-materias-primas-${userId}`] },
  );
}

function fornecedoresSelectCache(userId: string) {
  return unstable_cache(
    async (): Promise<Pick<Fornecedor, "id" | "nome">[]> => {
      const data = await prisma.fornecedor.findMany({
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
        take: 80,
      });
      return data;
    },
    ["list-fornecedores-select", userId],
    { revalidate: LIST_REVALIDATE, tags: [`list-fornecedores-select-${userId}`] },
  );
}

const CATEGORIAS_PADRAO: CategoriaMateriaPrimaDB[] = [
  { id: "fallback-bainha", nome: "Bainha", ordem: 1, created_at: "" },
  { id: "fallback-botao", nome: "Botão", ordem: 2, created_at: "" },
  { id: "fallback-lamina", nome: "Lâmina", ordem: 3, created_at: "" },
  { id: "fallback-cabo", nome: "Cabo", ordem: 4, created_at: "" },
];

function mapCategoriaMateriaPrima(row: {
  id: string;
  nome: string;
  ordem: number;
  createdAt: Date;
}): CategoriaMateriaPrimaDB {
  return {
    id: row.id,
    nome: row.nome,
    ordem: row.ordem,
    created_at: row.createdAt.toISOString(),
  };
}

function mapCategoriaFaca(row: {
  id: string;
  nome: string;
  corTexto: string | null;
  corFundo: string | null;
  corBorda: string | null;
  ordem: number;
  createdAt: Date;
}): CategoriaFacaDB {
  return {
    id: row.id,
    nome: row.nome,
    cor_texto: row.corTexto ?? "",
    cor_fundo: row.corFundo ?? "",
    cor_borda: row.corBorda ?? "",
    ordem: row.ordem,
    created_at: row.createdAt.toISOString(),
  };
}

function categoriasMPCache(userId: string) {
  return unstable_cache(
    async (): Promise<CategoriaMateriaPrimaDB[]> => {
      const categorias = await prisma.categoriaMateriaPrima.findMany({
        select: {
          id: true,
          nome: true,
          ordem: true,
          createdAt: true,
        },
        orderBy: { ordem: "asc" },
      });
      const mapped = categorias.map(mapCategoriaMateriaPrima);
      return mapped.length > 0 ? mapped : CATEGORIAS_PADRAO;
    },
    ["list-categorias-mp", userId],
    { revalidate: LIST_REVALIDATE, tags: [`list-categorias-mp-${userId}`] },
  );
}

export function fetchMatériasPrimasList(userId: string): Promise<MateriaPrima[]> {
  return materiasPrimasCache(userId)();
}

export function fetchFornecedoresSelect(
  userId: string,
): Promise<Pick<Fornecedor, "id" | "nome">[]> {
  return fornecedoresSelectCache(userId)();
}

export function fetchCategoriasMateriaPrimaList(
  userId: string,
): Promise<CategoriaMateriaPrimaDB[]> {
  return categoriasMPCache(userId)();
}

// ============================================================
// Facas (com custo calculado via BOM)
// ============================================================

function facasComCustoCache(userId: string) {
  return unstable_cache(
    async (): Promise<Faca[]> => {
      const rows = await prisma.faca.findMany({
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
          createdAt: true,
        },
        orderBy: { codigo: "asc" },
        take: 120,
      });
      const facas: Faca[] = rows.map((row) => ({
        id: row.id,
        codigo: row.codigo,
        sku: row.sku,
        nome: row.nome,
        categoria: row.categoria,
        foto_url: row.fotoUrl,
        taxa_producao: decimalToNumber(row.taxaProducao),
        taxa_venda: decimalToNumber(row.taxaVenda),
        preco_venda: decimalToNumber(row.precoVenda),
        estoque_atual: row.estoqueAtual,
        estoque_minimo: row.estoqueMinimo,
        ncm: null,
        cfop_padrao: null,
        cst_icms: null,
        cst_pis: null,
        cst_cofins: null,
        origem: null,
        unidade: null,
        ean_gtin: null,
        created_at: row.createdAt.toISOString(),
      }));
      const ids = facas.map((f) => f.id);
      if (ids.length === 0) return facas;
      const boms = await prisma.facaMateriaPrima.findMany({
        where: { facaId: { in: ids } },
        select: {
          facaId: true,
          quantidade: true,
          materiaPrima: {
            select: {
              precoCusto: true,
            },
          },
        },
      });
      const base = new Map<string, number>();
      for (const b of boms) {
        const custo = Number(b.materiaPrima.precoCusto.toNumber() ?? 0);
        const qtd = Number(b.quantidade.toNumber() ?? 0);
        base.set(b.facaId, (base.get(b.facaId) ?? 0) + custo * qtd);
      }
      return facas.map((f) => ({
        ...f,
        preco_custo: Math.round((base.get(f.id) ?? 0) * 100) / 100,
      }));
    },
    ["list-facas-com-custo", userId],
    { revalidate: LIST_REVALIDATE, tags: [`list-facas-${userId}`] },
  );
}

export function fetchFacasComCustoList(userId: string): Promise<Faca[]> {
  return facasComCustoCache(userId)();
}

// ============================================================
// Categorias de Faca
// ============================================================

function categoriasFacaCache(userId: string) {
  return unstable_cache(
    async (): Promise<CategoriaFacaDB[]> => {
      const categorias = await prisma.categoriaFaca.findMany({
        select: {
          id: true,
          nome: true,
          corTexto: true,
          corFundo: true,
          corBorda: true,
          ordem: true,
          createdAt: true,
        },
        orderBy: { ordem: "asc" },
      });
      return categorias.map(mapCategoriaFaca);
    },
    ["list-categorias-faca", userId],
    { revalidate: LIST_REVALIDATE, tags: [`list-categorias-faca-${userId}`] },
  );
}

export function fetchCategoriasFacaList(userId: string): Promise<CategoriaFacaDB[]> {
  return categoriasFacaCache(userId)();
}

// ============================================================
// Fornecedores (lista completa)
// ============================================================

function fornecedoresFullCache(userId: string) {
  return unstable_cache(
    async (): Promise<Fornecedor[]> => {
      const data = await prisma.fornecedor.findMany({
        orderBy: { nome: "asc" },
        take: 120,
      });
      return data.map(mapFornecedor);
    },
    ["list-fornecedores-full", userId],
    { revalidate: LIST_REVALIDATE, tags: [`list-fornecedores-${userId}`] },
  );
}

export function fetchFornecedoresFullList(userId: string): Promise<Fornecedor[]> {
  return fornecedoresFullCache(userId)();
}

// ============================================================
// Clientes
// ============================================================

function clientesCache(userId: string) {
  return unstable_cache(
    async (): Promise<Cliente[]> => {
      const data = await prisma.cliente.findMany({
        orderBy: { nome: "asc" },
        take: 120,
      });
      return data.map(mapCliente);
    },
    ["list-clientes", userId],
    { revalidate: LIST_REVALIDATE, tags: [`list-clientes-${userId}`] },
  );
}

export function fetchClientesList(userId: string): Promise<Cliente[]> {
  return clientesCache(userId)();
}

// ============================================================
// Taxas de Lucro (config global)
// ============================================================

const taxasLucroCacheFn = unstable_cache(
  async (): Promise<TaxasLucroConfig> => {
    const data = await prisma.appConfig.findUnique({
      where: { id: 1 },
      select: {
        taxaProducaoLucro: true,
        margemLucro: true,
        taxaComissaoLucro: true,
      },
    });
    if (!data) return { taxa_producao: 0, margem_lucro: 0, taxa_comissao: 0 };
    return {
      taxa_producao: decimalToNumber(data.taxaProducaoLucro),
      margem_lucro: decimalToNumber(data.margemLucro),
      taxa_comissao: decimalToNumber(data.taxaComissaoLucro),
    };
  },
  ["app-config-taxas-lucro"],
  { revalidate: 600, tags: ["app-config-taxas-lucro"] },
);

export function fetchTaxasLucroConfig(): Promise<TaxasLucroConfig> {
  return taxasLucroCacheFn();
}

// ============================================================
// Ordens de Compra (lista) — 4 queries em paralelo, depois cacheado.
// IMPORTANTE: NÃO unificar isso num único grafo relacional pesado. Em testes
// anteriores a consulta agregada ficou lenta demais para a navegação do ERP.
// O padrão atual mantém cada round-trip curto; combinado com unstable_cache
// (revalidate 60s), o refresh da tela permanece responsivo.
// ============================================================

function numberFrom(value: { toNumber(): number } | number | null | undefined): number {
  if (typeof value === "number") return value;
  return value?.toNumber() ?? 0;
}

function ordensCompraCache(userId: string) {
  return unstable_cache(
    async (): Promise<OrdemCompra[]> => {
      const rows = await prisma.ordemCompra.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          fornecedor: { select: { id: true, nome: true } },
          ultimaAlteracaoUsuario: { select: { id: true, nome: true } },
          itens: {
            include: {
              materiaPrima: { select: { id: true, codigo: true, nome: true, categoria: true } },
            },
          },
          filaReposicao: {
            include: {
              pedido: {
                include: {
                  cliente: { select: { id: true, nome: true } },
                },
              },
            },
          },
        },
      });

      return rows.map((row) => {
        const pedido = row.filaReposicao?.pedido ?? null;
        const cliente = pedido?.cliente ?? null;
        const { status, pago } = normalizarStatusEPagoCache(row);

        return {
          id: row.id,
          codigo: row.codigo,
          sequencial_fornecedor: row.sequencialFornecedor ?? null,
          fornecedor_id: row.fornecedorId ?? null,
          fila_reposicao_id: row.filaReposicaoId ?? null,
          status,
          pago,
          forma_pagamento: (row.formaPagamento as OrdemCompra["forma_pagamento"]) ?? null,
          data_geracao: row.dataGeracao.toISOString().slice(0, 10),
          desconto_total: numberFrom(row.descontoTotal),
          observacao: row.observacao ?? null,
          ultima_alteracao_usuario_id: row.ultimaAlteracaoUsuarioId ?? null,
          ultima_alteracao_em: row.ultimaAlteracaoEm?.toISOString() ?? null,
          ultima_alteracao_usuario: row.ultimaAlteracaoUsuario
            ? { id: row.ultimaAlteracaoUsuario.id, nome: row.ultimaAlteracaoUsuario.nome }
            : null,
          created_at: row.createdAt.toISOString(),
          fornecedor: row.fornecedor ? { id: row.fornecedor.id, nome: row.fornecedor.nome } : null,
          pedido_id: pedido?.id ?? null,
          pedido_codigo: pedido?.codigo ?? null,
          pedido_sequencial: pedido?.sequencial ? Number(pedido.sequencial) : null,
          cliente_nome: cliente?.nome ?? null,
          itens: row.itens.map((item) => ({
            id: item.id,
            ordem_compra_id: item.ordemCompraId,
            materia_prima_id: item.materiaPrimaId,
            quantidade: numberFrom(item.quantidade),
            quantidade_vendida: numberFrom(item.quantidadeVendida),
            quantidade_adicional: numberFrom(item.quantidadeAdicional),
            preco_unitario: item.precoUnitario ? numberFrom(item.precoUnitario) : null,
            materia_prima: item.materiaPrima
              ? {
                  id: item.materiaPrima.id,
                  codigo: item.materiaPrima.codigo,
                  nome: item.materiaPrima.nome,
                  categoria: item.materiaPrima.categoria,
                }
              : undefined,
          })),
        };
      });
    },
    ["list-ordens-compra", userId],
    { revalidate: 60, tags: [`list-ordens-compra-${userId}`] },
  );
}

export function fetchOrdensCompraList(userId: string): Promise<OrdemCompra[]> {
  return withTiming("cache:fetchOrdensCompraList", () => ordensCompraCache(userId)());
}

// ============================================================
// Fila de Reposição (lista) — só pendentes, com contagem de itens.
// ============================================================

function filaReposicaoCache(userId: string) {
  return unstable_cache(
    async (): Promise<FilaReposicao[]> => {
      const rows = await prisma.filaReposicao.findMany({
        where: { status: "pendente" },
        orderBy: { createdAt: "desc" },
        include: {
          pedido: {
            include: {
              cliente: { select: { id: true, nome: true } },
            },
          },
          itens: {
            select: { id: true },
          },
        },
      });

      return rows.map((row) => {
        const pedido = row.pedido;
        const cliente = pedido?.cliente ?? null;
        return {
          id: row.id,
          pedido_id: row.pedidoId,
          pedido_codigo: pedido?.codigo ?? "—",
          pedido_sequencial: pedido?.sequencial ? Number(pedido.sequencial) : null,
          cliente_nome: cliente?.nome ?? "—",
          status: row.status as FilaReposicao["status"],
          created_at: row.createdAt.toISOString(),
          itens_count: row.itens.length,
        };
      });
    },
    ["list-fila-reposicao", userId],
    { revalidate: 60, tags: [`list-fila-reposicao-${userId}`] },
  );
}

export function fetchFilaReposicaoList(userId: string): Promise<FilaReposicao[]> {
  return withTiming("cache:fetchFilaReposicaoList", () => filaReposicaoCache(userId)());
}

// ============================================================
// Usuários ativos (para registrar alteração na OC)
// ============================================================

function usuariosRegistroOCCache(userId: string) {
  return unstable_cache(
    async (): Promise<{ id: string; nome: string }[]> => {
      const data = await prisma.usuarioPerfil.findMany({
        where: { ativo: true },
        select: { id: true, nome: true },
        orderBy: { nome: "asc" },
      });
      return data;
    },
    ["list-usuarios-registro-oc", userId],
    { revalidate: 300, tags: [`list-usuarios-registro-oc-${userId}`] },
  );
}

export function fetchUsuariosRegistroOC(userId: string): Promise<{ id: string; nome: string }[]> {
  return withTiming("cache:fetchUsuariosRegistroOC", () => usuariosRegistroOCCache(userId)());
}
