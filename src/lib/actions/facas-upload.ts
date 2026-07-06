"use server";

import { Prisma } from "@prisma/client";
import { revalidateTag } from "next/cache";
import { assertPermissao, requireAuthenticatedUserId } from "@/lib/auth";
import { fetchTaxasLucroConfig } from "@/lib/cache/list-data";
import { prisma } from "@/lib/prisma";
import { createLocalStorage } from "@/lib/storage";
import { gerarCodigoForte } from "@/lib/utils/codigo";

const FOTO_BUCKET_FACAS = "facas-fotos";

async function revalidateFacasLists() {
  try {
    const userId = await requireAuthenticatedUserId();
    revalidateTag(`list-facas-${userId}`, "max");
    revalidateTag(`list-materias-primas-${userId}`, "max");
  } catch {}
}

async function gerarCodigoFaca(): Promise<string> {
  return gerarCodigoForte("FK");
}

function numberFrom(value: Prisma.Decimal | number | string | bigint | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") {
    return value.toNumber();
  }
  return Number(value) || 0;
}

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(Number.isFinite(value) ? value : 0);
}

function extFromFile(file: { type?: string; name?: string }): string {
  const mime = file.type ?? "";
  const n = file.name ?? "";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  if (mime.includes("jpeg") || mime.includes("jpg") || mime.includes("pjpeg")) return "jpg";
  const m = n.match(/\.([a-zA-Z0-9]+)$/);
  return (m?.[1]?.toLowerCase() ?? "jpg") === "jpeg" ? "jpg" : (m?.[1]?.toLowerCase() ?? "jpg");
}

function isFileLike(v: unknown): v is Blob & { type?: string; name?: string } {
  return typeof v === "object" && v !== null && typeof (v as Blob).arrayBuffer === "function";
}

function throwFriendlyUniqueError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const targets = Array.isArray(error.meta?.target) ? error.meta.target.map(String) : [];
    if (targets.includes("sku")) {
      throw new Error("Já existe uma faca com este SKU.");
    }
    if (targets.includes("codigo")) {
      throw new Error("Já existe uma faca com este código.");
    }
  }
  throw error;
}

export async function salvarFacaComFoto(formData: FormData) {
  const id = formData.get("id");
  const sku = String(formData.get("sku") ?? "").trim();
  const nome = String(formData.get("nome") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim();
  const estoque_atual = Number(formData.get("estoque_atual"));
  const estoque_minimo = Number(formData.get("estoque_minimo"));
  const foto = formData.get("foto");
  const bomRaw = formData.get("bom");

  const fiscaisRaw = {
    ncm: String(formData.get("ncm") ?? "")
      .replace(/\D/g, "")
      .trim(),
    cfop_padrao: String(formData.get("cfop_padrao") ?? "")
      .replace(/\D/g, "")
      .trim(),
    cst_icms: String(formData.get("cst_icms") ?? "").trim(),
    cst_pis: String(formData.get("cst_pis") ?? "").trim(),
    cst_cofins: String(formData.get("cst_cofins") ?? "").trim(),
    origem: String(formData.get("origem") ?? "").trim(),
    unidade: String(formData.get("unidade") ?? "")
      .trim()
      .toUpperCase(),
    ean_gtin: String(formData.get("ean_gtin") ?? "")
      .replace(/\D/g, "")
      .trim(),
  };
  if (fiscaisRaw.ncm && fiscaisRaw.ncm.length !== 8) throw new Error("NCM deve ter 8 dígitos.");
  if (fiscaisRaw.cfop_padrao && fiscaisRaw.cfop_padrao.length !== 4)
    throw new Error("CFOP deve ter 4 dígitos.");
  const origemNum = fiscaisRaw.origem === "" ? null : Number(fiscaisRaw.origem);
  if (origemNum != null && (!Number.isFinite(origemNum) || origemNum < 0 || origemNum > 8)) {
    throw new Error("Origem da mercadoria inválida.");
  }
  const dadosFiscais = {
    ncm: fiscaisRaw.ncm || null,
    cfop_padrao: fiscaisRaw.cfop_padrao || null,
    cst_icms: fiscaisRaw.cst_icms || null,
    cst_pis: fiscaisRaw.cst_pis || null,
    cst_cofins: fiscaisRaw.cst_cofins || null,
    origem: origemNum,
    unidade: fiscaisRaw.unidade || null,
    ean_gtin: fiscaisRaw.ean_gtin || null,
  };

  if (!sku) throw new Error("SKU é obrigatório.");
  if (!nome) throw new Error("Nome é obrigatório.");
  if (!categoria) throw new Error("Categoria é obrigatória.");
  if (!Number.isFinite(estoque_atual)) throw new Error("Estoque atual inválido.");
  if (!Number.isFinite(estoque_minimo)) throw new Error("Estoque mínimo inválido.");

  let bomItens: { materia_prima_id: string; quantidade: number }[] = [];
  if (typeof bomRaw === "string" && bomRaw.length > 0) {
    try {
      bomItens = JSON.parse(bomRaw);
    } catch {
      throw new Error("BOM inválido.");
    }
  }
  if (bomItens.length === 0) throw new Error("Adicione pelo menos 1 matéria-prima.");
  for (const item of bomItens) {
    if (!item.materia_prima_id || !item.quantidade || item.quantidade <= 0) {
      throw new Error("Cada matéria-prima precisa de uma quantidade válida (> 0).");
    }
  }

  const isEdit = typeof id === "string" && id.length > 0;

  await assertPermissao("facas", isEdit ? "editar" : "criar");

  const mpIds = [...new Set(bomItens.map((i) => i.materia_prima_id))];
  const mpsData = await prisma.materiaPrima.findMany({
    where: { id: { in: mpIds } },
    select: { id: true, precoCusto: true },
  });
  const precoCustoById = new Map(mpsData.map((m) => [m.id, numberFrom(m.precoCusto)]));
  const custoBom = bomItens.reduce(
    (acc, item) => acc + (precoCustoById.get(item.materia_prima_id) ?? 0) * item.quantidade,
    0,
  );

  const taxasConfig = await fetchTaxasLucroConfig();
  const taxas = {
    taxa_producao: taxasConfig.taxa_producao,
    margem_lucro: taxasConfig.margem_lucro,
  };
  const custoProd = custoBom + taxas.taxa_producao;
  const preco_venda = custoProd * (1 + taxas.margem_lucro / 100);

  let facaId: string;
  try {
    facaId = await prisma.$transaction(async (tx) => {
      let currentFacaId = typeof id === "string" && id.length > 0 ? id : "";

      if (isEdit) {
        await tx.faca.update({
          where: { id: currentFacaId },
          data: {
            sku,
            nome,
            categoria,
            taxaProducao: 0,
            taxaVenda: 0,
            precoVenda: preco_venda,
            estoqueAtual: estoque_atual,
            estoqueMinimo: estoque_minimo,
            ncm: dadosFiscais.ncm,
            cfopPadrao: dadosFiscais.cfop_padrao,
            cstIcms: dadosFiscais.cst_icms,
            cstPis: dadosFiscais.cst_pis,
            cstCofins: dadosFiscais.cst_cofins,
            origem: dadosFiscais.origem,
            unidade: dadosFiscais.unidade,
            eanGtin: dadosFiscais.ean_gtin,
          },
        });
      } else {
        const codigo = await gerarCodigoFaca();
        const inserted = await tx.faca.create({
          data: {
            codigo,
            sku,
            nome,
            categoria,
            taxaProducao: 0,
            taxaVenda: 0,
            precoVenda: preco_venda,
            estoqueAtual: estoque_atual,
            estoqueMinimo: estoque_minimo,
            ncm: dadosFiscais.ncm,
            cfopPadrao: dadosFiscais.cfop_padrao,
            cstIcms: dadosFiscais.cst_icms,
            cstPis: dadosFiscais.cst_pis,
            cstCofins: dadosFiscais.cst_cofins,
            origem: dadosFiscais.origem,
            unidade: dadosFiscais.unidade,
            eanGtin: dadosFiscais.ean_gtin,
          },
          select: { id: true },
        });
        currentFacaId = inserted.id ?? "";
        if (!currentFacaId) throw new Error("Falha ao criar faca.");
      }

      await tx.facaMateriaPrima.deleteMany({
        where: { facaId: currentFacaId },
      });

      await tx.facaMateriaPrima.createMany({
        data: bomItens.map((item) => ({
          facaId: currentFacaId,
          materiaPrimaId: item.materia_prima_id,
          quantidade: decimal(item.quantidade),
        })),
      });

      return currentFacaId;
    });
  } catch (error) {
    throwFriendlyUniqueError(error);
  }

  if (foto && isFileLike(foto)) {
    const storage = createLocalStorage();

    const { data: buckets, error: listErr } = await storage.listBuckets();
    if (listErr) throw new Error(listErr.message);

    const exists = (buckets ?? []).some((b: { name: string }) => b.name === FOTO_BUCKET_FACAS);
    if (!exists) {
      await storage.createBucket(FOTO_BUCKET_FACAS);
    }

    const fileExt = extFromFile(foto as unknown as { type?: string; name?: string });
    const filePath = `${facaId}/foto.${fileExt}`;

    const { error: upErr } = await storage.from(FOTO_BUCKET_FACAS).upload(filePath, foto, {
      upsert: true,
      contentType: foto.type ?? "image/jpeg",
      cacheControl: "3600",
    });
    if (upErr) throw new Error(upErr.message);

    const { data: pub } = storage.from(FOTO_BUCKET_FACAS).getPublicUrl(filePath);
    if (pub?.publicUrl) {
      await prisma.faca.update({
        where: { id: facaId },
        data: { fotoUrl: pub.publicUrl },
      });
    }
  }

  await revalidateFacasLists();
}
