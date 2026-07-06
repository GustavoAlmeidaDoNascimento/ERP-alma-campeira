"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { MateriaPrima } from "@/types";

export type BomItemDraft = {
  materia_prima_id: string;
  quantidade: string;
};

type Props = {
  onClose: () => void;
  materiasPrimas: MateriaPrima[];
  existingItems: BomItemDraft[];
  onConfirm: (items: BomItemDraft[]) => void;
};

type SortField = "nome" | "codigo" | "estoque" | "preco_custo";
type SortDirection = "asc" | "desc";

function compareText(a: string, b: string): number {
  return a.localeCompare(b, "pt-BR", { sensitivity: "base", numeric: true });
}

export function MPSelectorModal({
  onClose,
  materiasPrimas,
  existingItems,
  onConfirm,
}: Props) {
  const [categoriaAtual, setCategoriaAtual] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("nome");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [selecoesTemporarias, setSelecoesTemporarias] = useState<Record<string, { quantidade: string }>>(
    {},
  );
  const [erro, setErro] = useState("");

  const existentesPorId = useMemo(() => {
    const map = new Map<string, BomItemDraft>();
    for (const item of existingItems) {
      if (!item.materia_prima_id) continue;
      map.set(item.materia_prima_id, item);
    }
    return map;
  }, [existingItems]);

  const materiasPrimasOrdenadas = useMemo(
    () =>
      [...materiasPrimas].sort((a, b) => {
        const categoria = compareText(a.categoria, b.categoria);
        if (categoria !== 0) return categoria;
        const codigo = compareText(a.codigo, b.codigo);
        if (codigo !== 0) return codigo;
        return compareText(a.nome, b.nome);
      }),
    [materiasPrimas],
  );

  const categorias = useMemo(() => {
    const counts = new Map<string, number>();
    const novos = new Map<string, number>();
    const existentes = new Map<string, number>();

    for (const mp of materiasPrimasOrdenadas) {
      counts.set(mp.categoria, (counts.get(mp.categoria) ?? 0) + 1);
      if (existentesPorId.has(mp.id)) {
        existentes.set(mp.categoria, (existentes.get(mp.categoria) ?? 0) + 1);
      }
      if (selecoesTemporarias[mp.id]) {
        novos.set(mp.categoria, (novos.get(mp.categoria) ?? 0) + 1);
      }
    }

    return Array.from(counts.entries())
      .map(([nome, quantidade]) => ({
        nome,
        quantidade,
        novasSelecionadas: novos.get(nome) ?? 0,
        jaAdicionadas: existentes.get(nome) ?? 0,
      }))
      .sort((a, b) => compareText(a.nome, b.nome));
  }, [existentesPorId, materiasPrimasOrdenadas, selecoesTemporarias]);

  const itensDaCategoria = useMemo(() => {
    if (!categoriaAtual) return [];
    const itens = materiasPrimasOrdenadas.filter((mp) => mp.categoria === categoriaAtual);
    const sorted = [...itens].sort((a, b) => {
      let primary = 0;
      switch (sortField) {
        case "nome":
          primary = compareText(a.nome, b.nome);
          break;
        case "codigo":
          primary = compareText(a.codigo, b.codigo);
          break;
        case "estoque":
          primary = Number(a.estoque_atual) - Number(b.estoque_atual);
          break;
        case "preco_custo":
          primary = Number(a.preco_custo) - Number(b.preco_custo);
          break;
      }
      if (primary !== 0) return sortDirection === "asc" ? primary : -primary;

      const fallbackNome = compareText(a.nome, b.nome);
      if (fallbackNome !== 0) return fallbackNome;
      return compareText(a.codigo, b.codigo);
    });
    return sorted;
  }, [categoriaAtual, materiasPrimasOrdenadas, sortDirection, sortField]);

  const totalNovosSelecionados = Object.keys(selecoesTemporarias).length;

  function toggleSelecao(mp: MateriaPrima, checked: boolean) {
    if (existentesPorId.has(mp.id)) return;

    setSelecoesTemporarias((prev) => {
      const next = { ...prev };
      if (checked) {
        next[mp.id] = next[mp.id] ?? { quantidade: "1" };
      } else {
        delete next[mp.id];
      }
      return next;
    });
    setErro("");
  }

  function atualizarQuantidade(mpId: string, quantidade: string) {
    setSelecoesTemporarias((prev) => {
      if (!prev[mpId]) return prev;
      return {
        ...prev,
        [mpId]: { quantidade },
      };
    });
    setErro("");
  }

  function handleConfirm() {
    const novosItens = Object.entries(selecoesTemporarias).map(([materia_prima_id, item]) => ({
      materia_prima_id,
      quantidade: item.quantidade,
    }));

    for (const item of novosItens) {
      const quantidade = Number(item.quantidade);
      if (!item.quantidade || !Number.isFinite(quantidade) || quantidade <= 0) {
        setErro("Informe uma quantidade maior que 0 para todas as matérias-primas marcadas.");
        return;
      }
    }

    setErro("");
    onConfirm(novosItens);
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection("asc");
  }

  function getSortIndicator(field: SortField): string {
    if (sortField !== field) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
  }

  return (
    <Modal open onClose={onClose} title="Adicionar Matérias-Primas" width="980px">
      <div className="flex flex-col gap-4">
        <div
          className="rounded-xl p-3 flex items-center justify-between gap-3"
          style={{ border: "1px solid var(--ac-border)", background: "var(--ac-bg)" }}
        >
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--ac-text)" }}>
              {categoriaAtual ? categoriaAtual : "Escolha uma categoria"}
            </p>
            <p className="text-xs" style={{ color: "var(--ac-muted)" }}>
              {totalNovosSelecionados === 0
                ? "Nenhuma nova matéria-prima selecionada."
                : `${totalNovosSelecionados} nova(s) matéria(s)-prima(s) pronta(s) para adicionar.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {categoriaAtual ? (
              <Button type="button" variant="secondary" onClick={() => setCategoriaAtual(null)}>
                Voltar para categorias
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={totalNovosSelecionados === 0}
            >
              Salvar selecionadas
            </Button>
          </div>
        </div>

        {!categoriaAtual ? (
          categorias.length === 0 ? (
            <div
              className="rounded-xl px-4 py-8 text-center text-sm"
              style={{
                color: "var(--ac-muted)",
                border: "1px dashed var(--ac-border)",
                background: "var(--ac-bg)",
              }}
            >
              Nenhuma matéria-prima cadastrada para selecionar.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {categorias.map((categoria) => (
                <button
                  key={categoria.nome}
                  type="button"
                  onClick={() => setCategoriaAtual(categoria.nome)}
                  className="rounded-xl p-4 text-left transition-all"
                  style={{
                    border: "1px solid var(--ac-border)",
                    background: "var(--ac-card)",
                    color: "var(--ac-text)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "var(--ac-accent)";
                    e.currentTarget.style.background =
                      "color-mix(in srgb, var(--ac-accent) 6%, var(--ac-card))";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "var(--ac-border)";
                    e.currentTarget.style.background = "var(--ac-card)";
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{categoria.nome}</p>
                      <p className="text-xs mt-1" style={{ color: "var(--ac-muted)" }}>
                        {categoria.quantidade} item(ns) nesta categoria
                      </p>
                    </div>
                    <span
                      className="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold"
                      style={{
                        color: "var(--ac-accent)",
                        background: "color-mix(in srgb, var(--ac-accent) 12%, transparent)",
                      }}
                    >
                      Abrir
                    </span>
                  </div>
                  {(categoria.novasSelecionadas > 0 || categoria.jaAdicionadas > 0) && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      {categoria.novasSelecionadas > 0 ? (
                        <span
                          className="rounded-full px-2 py-1"
                          style={{
                            color: "#0369a1",
                            background: "#e0f2fe",
                          }}
                        >
                          {categoria.novasSelecionadas} nova(s) marcada(s)
                        </span>
                      ) : null}
                      {categoria.jaAdicionadas > 0 ? (
                        <span
                          className="rounded-full px-2 py-1"
                          style={{
                            color: "var(--ac-muted)",
                            background: "var(--ac-bg)",
                            border: "1px solid var(--ac-border)",
                          }}
                        >
                          {categoria.jaAdicionadas} ja adicionada(s)
                        </span>
                      ) : null}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )
        ) : (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--ac-border)", background: "var(--ac-card)" }}
          >
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: "var(--ac-bg)", borderBottom: "1px solid var(--ac-border)" }}>
                  <th className="px-4 py-3 text-left text-xs uppercase" style={{ color: "var(--ac-muted)" }}>
                    Marcar
                  </th>
                  <th className="px-4 py-3 text-left text-xs uppercase" style={{ color: "var(--ac-muted)" }}>
                    <button
                      type="button"
                      onClick={() => toggleSort("codigo")}
                      className="inline-flex items-center gap-1 transition-colors"
                      style={{ color: sortField === "codigo" ? "var(--ac-text)" : "inherit" }}
                    >
                      <span>Codigo</span>
                      <span aria-hidden="true" className="text-[11px] leading-none">
                        {getSortIndicator("codigo")}
                      </span>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs uppercase" style={{ color: "var(--ac-muted)" }}>
                    <button
                      type="button"
                      onClick={() => toggleSort("nome")}
                      className="inline-flex items-center gap-1 transition-colors"
                      style={{ color: sortField === "nome" ? "var(--ac-text)" : "inherit" }}
                    >
                      <span>Nome</span>
                      <span aria-hidden="true" className="text-[11px] leading-none">
                        {getSortIndicator("nome")}
                      </span>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-xs uppercase" style={{ color: "var(--ac-muted)" }}>
                    <button
                      type="button"
                      onClick={() => toggleSort("estoque")}
                      className="inline-flex items-center justify-end gap-1 transition-colors"
                      style={{ color: sortField === "estoque" ? "var(--ac-text)" : "inherit", width: "100%" }}
                    >
                      <span>Estoque</span>
                      <span aria-hidden="true" className="text-[11px] leading-none">
                        {getSortIndicator("estoque")}
                      </span>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-xs uppercase" style={{ color: "var(--ac-muted)" }}>
                    <button
                      type="button"
                      onClick={() => toggleSort("preco_custo")}
                      className="inline-flex items-center justify-end gap-1 transition-colors"
                      style={{
                        color: sortField === "preco_custo" ? "var(--ac-text)" : "inherit",
                        width: "100%",
                      }}
                    >
                      <span>Preco custo</span>
                      <span aria-hidden="true" className="text-[11px] leading-none">
                        {getSortIndicator("preco_custo")}
                      </span>
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right text-xs uppercase" style={{ color: "var(--ac-muted)" }}>
                    Quantidade
                  </th>
                </tr>
              </thead>
              <tbody>
                {itensDaCategoria.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm"
                      style={{ color: "var(--ac-muted)" }}
                    >
                      Nenhuma matéria-prima encontrada nesta categoria.
                    </td>
                  </tr>
                ) : (
                  itensDaCategoria.map((mp, index) => {
                    const itemExistente = existentesPorId.get(mp.id);
                    const itemNovo = selecoesTemporarias[mp.id];
                    const checked = Boolean(itemExistente || itemNovo);
                    const bloqueado = Boolean(itemExistente);
                    const quantidade = itemExistente?.quantidade ?? itemNovo?.quantidade ?? "";

                    return (
                      <tr
                        key={mp.id}
                        style={{
                          borderTop: index > 0 ? "1px solid var(--ac-border)" : undefined,
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={bloqueado}
                              onChange={(e) => toggleSelecao(mp, e.target.checked)}
                            />
                            {bloqueado ? (
                              <span
                                className="rounded-full px-2 py-1 text-[11px]"
                                style={{
                                  color: "var(--ac-muted)",
                                  background: "var(--ac-bg)",
                                  border: "1px solid var(--ac-border)",
                                }}
                              >
                                Ja adicionada
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs" style={{ color: "var(--ac-muted)" }}>
                          {mp.codigo}
                        </td>
                        <td className="px-4 py-3" style={{ color: "var(--ac-text)" }}>
                          <div className="font-medium">{mp.nome}</div>
                          <div className="text-xs mt-0.5" style={{ color: "var(--ac-muted)" }}>
                            SKU: {mp.sku}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums" style={{ color: "var(--ac-text)" }}>
                          {Number(mp.estoque_atual).toLocaleString("pt-BR")}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums" style={{ color: "var(--ac-text)" }}>
                          {Number(mp.preco_custo).toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={quantidade}
                            disabled={!checked || bloqueado}
                            onChange={(e) => atualizarQuantidade(mp.id, e.target.value)}
                            className="w-24 rounded-lg px-2 py-2 text-sm text-right outline-none transition-all"
                            style={{
                              background: !checked || bloqueado ? "var(--ac-bg)" : "var(--ac-card)",
                              border: "1px solid var(--ac-border)",
                              color: !checked || bloqueado ? "var(--ac-muted)" : "var(--ac-text)",
                            }}
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {erro ? (
          <p
            className="rounded-lg px-3 py-2 text-sm"
            style={{ color: "#dc2626", background: "#fee2e2" }}
          >
            {erro}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
