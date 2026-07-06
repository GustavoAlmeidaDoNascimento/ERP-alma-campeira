"use server";

import { revalidateTag } from "next/cache";
import { assertPermissao } from "@/lib/auth";
import { fetchTaxasLucroConfig } from "@/lib/cache/list-data";
import { prisma } from "@/lib/prisma";

export type TaxasLucroConfig = {
  /** Valor fixo em R$ adicionado ao custo de materiais (ex.: 27.00). */
  taxa_producao: number;
  /** Margem de lucro em % sobre o custo de produção (ex.: 60 = 60%). */
  margem_lucro: number;
  /** Comissão em % descontada do preço de venda (ex.: 10 = 10%). */
  taxa_comissao: number;
};

export async function getTaxasLucroConfig(): Promise<TaxasLucroConfig> {
  await assertPermissao("taxas_lucro", "ver");
  return fetchTaxasLucroConfig();
}

export async function updateTaxasLucroConfig(input: TaxasLucroConfig) {
  await assertPermissao("taxas_lucro", "editar");
  const tp = Number(input.taxa_producao);
  const ml = Number(input.margem_lucro);
  const tc = Number(input.taxa_comissao);
  if (!Number.isFinite(tp) || tp < 0) {
    throw new Error("Taxa de produção inválida (informe um valor em R$ maior ou igual a 0).");
  }
  if (!Number.isFinite(ml) || ml < 0) {
    throw new Error("Margem de lucro inválida (use 0% ou mais).");
  }
  if (!Number.isFinite(tc) || tc < 0 || tc > 100) {
    throw new Error("Taxa de comissão inválida (use 0 a 100%).");
  }

  await prisma.appConfig.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      taxaProducaoLucro: tp,
      margemLucro: ml,
      taxaComissaoLucro: tc,
      updatedAt: new Date(),
    },
    update: {
      taxaProducaoLucro: tp,
      margemLucro: ml,
      taxaComissaoLucro: tc,
      updatedAt: new Date(),
    },
  });
  revalidateTag("app-config-taxas-lucro", "max");
}
