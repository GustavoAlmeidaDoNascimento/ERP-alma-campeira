"use client";

import { useState, useMemo } from "react";
import { BadgeEstoque } from "@/components/ui/badge-estoque";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { ConsumivelModal } from "./consumivel-modal";
import {
  baixaEstoqueConsumivel,
  deletarConsumivel,
  entradaEstoqueConsumivel,
} from "@/lib/actions/consumiveis";
import { statusEstoqueConsumivel } from "@/types";
import type { Consumivel, Fornecedor, CategoriaConsumivelDB } from "@/types";
import { useErpTabs } from "@/components/layout/erp-tabs";
import { useConsumiveis, useFornecedores, useCategoriasConsumivel } from "@/lib/query/hooks";
import { getOptimizedImageUrl } from "@/lib/images";

type Perm = { ver: boolean; criar: boolean; editar: boolean; deletar: boolean };

type Props = {
  consumiveis: Consumivel[];
  fornecedores: Fornecedor[];
  categoriasConsumivel: CategoriaConsumivelDB[];
  perm: Perm;
};

export function ConsumivelClient({
  consumiveis: initialConsumiveis,
  fornecedores: initialFornecedores,
  categoriasConsumivel: initialCategorias,
  perm,
}: Props) {
  const { refreshActiveTab } = useErpTabs();
  const { data: consumiveis = initialConsumiveis } = useConsumiveis({
    initialData: initialConsumiveis,
  });
  const { data: fornecedores = initialFornecedores } = useFornecedores({
    initialData: initialFornecedores,
  });
  const { data: categoriasConsumivel = initialCategorias } = useCategoriasConsumivel({
    initialData: initialCategorias,
  });
  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<Consumivel | null>(null);
  const [deletando, setDeletando] = useState<Consumivel | null>(null);
  const [erroDelete, setErroDelete] = useState("");
  const [loadingDelete, setLoadingDelete] = useState(false);
  const [busca, setBusca] = useState("");
  const [fotoLightboxSrc, setFotoLightboxSrc] = useState<string>("");
  const [fotoLightboxAlt, setFotoLightboxAlt] = useState<string>("");

  const [movModal, setMovModal] = useState<null | { tipo: "entrada" | "baixa"; item: Consumivel }>(
    null,
  );
  const [movQtd, setMovQtd] = useState("1");
  const [movObs, setMovObs] = useState("");
  const [movErro, setMovErro] = useState("");
  const [movLoading, setMovLoading] = useState(false);

  const filtrados = useMemo(() => {
    if (!busca.trim()) return consumiveis;
    const q = busca.toLowerCase();
    return consumiveis.filter(
      (c) =>
        c.nome.toLowerCase().includes(q) ||
        c.codigo.toLowerCase().includes(q) ||
        c.sku.toLowerCase().includes(q) ||
        c.categoria.toLowerCase().includes(q) ||
        c.fornecedor?.nome?.toLowerCase().includes(q),
    );
  }, [consumiveis, busca]);

  const fotoUrlById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of consumiveis) {
      if (!c.foto_url) continue;
      map.set(
        c.id,
        getOptimizedImageUrl(c.foto_url, {
          width: 64,
          height: 64,
          quality: 65,
        }),
      );
    }
    return map;
  }, [consumiveis]);

  function abrirNovo() {
    setEditando(null);
    setModalAberto(true);
  }

  function abrirEditar(c: Consumivel) {
    setEditando(c);
    setModalAberto(true);
  }

  function abrirFotoLightbox(c: Consumivel, thumbFallback: string) {
    if (!c.foto_url) return;
    const srcGrande = getOptimizedImageUrl(c.foto_url, {
      width: 520,
      height: 520,
      quality: 80,
      resize: "contain",
    });
    setFotoLightboxSrc(srcGrande || thumbFallback);
    setFotoLightboxAlt(c.nome);
  }

  function abrirMovimento(tipo: "entrada" | "baixa", item: Consumivel) {
    setMovModal({ tipo, item });
    setMovQtd("1");
    setMovObs("");
    setMovErro("");
  }

  const movQtdNum = Number(movQtd.replace(",", ".")) || 0;

  async function confirmarMovimento() {
    if (!movModal) return;
    if (movQtdNum <= 0) {
      setMovErro("Informe uma quantidade maior que zero.");
      return;
    }
    setMovErro("");
    setMovLoading(true);
    try {
      if (movModal.tipo === "entrada") {
        await entradaEstoqueConsumivel(movModal.item.id, movQtdNum, movObs);
      } else {
        await baixaEstoqueConsumivel(movModal.item.id, movQtdNum, movObs);
      }
      setMovModal(null);
      refreshActiveTab();
    } catch (e: unknown) {
      setMovErro(e instanceof Error ? e.message : "Erro ao registrar movimentação.");
    } finally {
      setMovLoading(false);
    }
  }

  async function confirmarDelete() {
    if (!deletando) return;
    setErroDelete("");
    setLoadingDelete(true);
    try {
      await deletarConsumivel(deletando.id);
      setDeletando(null);
      refreshActiveTab();
    } catch (e: unknown) {
      setErroDelete(e instanceof Error ? e.message : "Erro ao excluir.");
    } finally {
      setLoadingDelete(false);
    }
  }

  return (
    <>
      {/* Header da página */}
      <div
        className="flex items-center justify-between px-8 py-6"
        style={{ borderBottom: "1px solid var(--ac-border)" }}
      >
        <div>
          <h2 className="text-2xl font-bold" style={{ color: "var(--ac-text)" }}>
            Consumíveis
          </h2>
          <p className="text-sm mt-0.5" style={{ color: "var(--ac-muted)" }}>
            {consumiveis.length}{" "}
            {consumiveis.length === 1 ? "item cadastrado" : "itens cadastrados"}
          </p>
        </div>
        {perm.criar && (
          <Button onClick={abrirNovo}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              className="size-4"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Novo consumível
          </Button>
        )}
      </div>

      {/* Busca */}
      <div className="px-8 py-4">
        <div className="relative max-w-sm">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            className="absolute left-3 top-1/2 -translate-y-1/2 size-4 pointer-events-none"
            style={{ color: "var(--ac-muted)" }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por nome, código, SKU, categoria ou fornecedor..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm outline-none transition-all"
            style={{
              background: "var(--ac-card)",
              border: "1px solid var(--ac-border)",
              color: "var(--ac-text)",
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--ac-accent)";
              e.currentTarget.style.boxShadow =
                "0 0 0 3px color-mix(in srgb, var(--ac-accent) 20%, transparent)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--ac-border)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>
      </div>

      {/* Tabela */}
      <div className="px-8 pb-8">
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--ac-border)" }}
        >
          <table className="w-full text-sm">
            <thead>
              <tr
                style={{ background: "var(--ac-bg)", borderBottom: "1px solid var(--ac-border)" }}
              >
                <th
                  className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide"
                  style={{ color: "var(--ac-muted)", width: 80 }}
                >
                  Foto
                </th>
                <th
                  className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide"
                  style={{ color: "var(--ac-muted)" }}
                >
                  Código
                </th>
                <th
                  className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide"
                  style={{ color: "var(--ac-muted)" }}
                >
                  Nome
                </th>
                <th
                  className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide"
                  style={{ color: "var(--ac-muted)" }}
                >
                  Categoria
                </th>
                <th
                  className="text-left px-4 py-3 font-semibold text-xs uppercase tracking-wide"
                  style={{ color: "var(--ac-muted)" }}
                >
                  Fornecedor
                </th>
                <th
                  className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide"
                  style={{ color: "var(--ac-muted)" }}
                >
                  Preço Custo
                </th>
                <th
                  className="text-right px-4 py-3 font-semibold text-xs uppercase tracking-wide"
                  style={{ color: "var(--ac-muted)" }}
                >
                  Estoque / Mín.
                </th>
                <th
                  className="text-center px-4 py-3 font-semibold text-xs uppercase tracking-wide"
                  style={{ color: "var(--ac-muted)" }}
                >
                  Status
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center py-12 text-sm"
                    style={{ color: "var(--ac-muted)" }}
                  >
                    {busca
                      ? "Nenhum resultado para essa busca."
                      : "Nenhum consumível cadastrado ainda."}
                  </td>
                </tr>
              )}
              {filtrados.map((c, i) => {
                const status = statusEstoqueConsumivel(c);
                return (
                  <tr
                    key={c.id}
                    style={{
                      borderTop: i > 0 ? "1px solid var(--ac-border)" : undefined,
                      background: "var(--ac-card)",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ac-bg)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "var(--ac-card)")}
                  >
                    <td className="px-4 py-3">
                      {(() => {
                        const thumbUrl = fotoUrlById.get(c.id);
                        if (thumbUrl) {
                          return (
                            <button
                              type="button"
                              onClick={() => abrirFotoLightbox(c, thumbUrl)}
                              aria-label={`Expandir foto de ${c.nome}`}
                              style={{
                                background: "transparent",
                                border: "none",
                                padding: 0,
                                cursor: "zoom-in",
                                display: "block",
                                borderRadius: 8,
                                overflow: "hidden",
                              }}
                            >
                              <img
                                src={thumbUrl}
                                alt={c.nome}
                                width={64}
                                height={64}
                                loading="lazy"
                                style={{
                                  objectFit: "cover",
                                  borderRadius: 8,
                                  display: "block",
                                  border: "1px solid var(--ac-border)",
                                }}
                              />
                            </button>
                          );
                        }
                        return (
                          <div
                            aria-label={`Sem foto para ${c.nome}`}
                            style={{
                              width: 64,
                              height: 64,
                              borderRadius: 8,
                              border: "1px solid var(--ac-border)",
                              background:
                                "linear-gradient(135deg, rgba(250, 204, 21, 0.18), rgba(250, 204, 21, 0.06))",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <img
                              src="/images/favicon-yellow.png"
                              alt="Sem foto"
                              width={28}
                              height={28}
                              style={{ objectFit: "contain" }}
                            />
                          </div>
                        );
                      })()}
                    </td>
                    <td
                      className="px-4 py-3 font-mono text-xs font-medium"
                      style={{ color: "var(--ac-muted)" }}
                    >
                      <div>{c.codigo}</div>
                      <div>SKU: {c.sku}</div>
                    </td>
                    <td className="px-4 py-3 font-medium" style={{ color: "var(--ac-text)" }}>
                      {c.nome}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--ac-muted)" }}>
                      {c.categoria}
                    </td>
                    <td className="px-4 py-3" style={{ color: "var(--ac-muted)" }}>
                      {c.fornecedor?.nome ?? "—"}
                    </td>
                    <td
                      className="px-4 py-3 text-right tabular-nums"
                      style={{ color: "var(--ac-text)" }}
                    >
                      {c.preco_custo.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                    <td
                      className="px-4 py-3 text-right tabular-nums"
                      style={{ color: "var(--ac-text)" }}
                    >
                      <span className="font-semibold">
                        {Number(c.estoque_atual).toLocaleString("pt-BR")}
                      </span>
                      <span className="mx-1 font-normal" style={{ color: "var(--ac-border)" }}>
                        /
                      </span>
                      <span style={{ color: "var(--ac-muted)" }}>
                        {Number(c.estoque_minimo).toLocaleString("pt-BR")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <BadgeEstoque status={status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-end gap-1 sm:gap-1.5">
                        {perm.editar && (
                          <>
                            <button
                              type="button"
                              onClick={() => abrirMovimento("entrada", c)}
                              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
                              style={{
                                color: "#15803d",
                                background: "color-mix(in srgb, #15803d 12%, transparent)",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background =
                                  "color-mix(in srgb, #15803d 20%, transparent)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background =
                                  "color-mix(in srgb, #15803d 12%, transparent)";
                              }}
                            >
                              Registrar entrada
                            </button>
                            <button
                              type="button"
                              onClick={() => abrirMovimento("baixa", c)}
                              className="text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
                              style={{
                                color: "#c2410c",
                                background: "color-mix(in srgb, #c2410c 12%, transparent)",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background =
                                  "color-mix(in srgb, #c2410c 20%, transparent)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background =
                                  "color-mix(in srgb, #c2410c 12%, transparent)";
                              }}
                            >
                              Baixa
                            </button>
                          </>
                        )}
                        {perm.editar && (
                          <button
                            type="button"
                            onClick={() => abrirEditar(c)}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: "var(--ac-muted)" }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "var(--ac-border)";
                              e.currentTarget.style.color = "var(--ac-text)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.color = "var(--ac-muted)";
                            }}
                            title="Editar"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.8}
                              className="size-4"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}
                        {perm.deletar && (
                          <button
                            type="button"
                            onClick={() => {
                              setDeletando(c);
                              setErroDelete("");
                            }}
                            className="p-1.5 rounded-lg transition-colors"
                            style={{ color: "var(--ac-muted)" }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = "#fee2e2";
                              e.currentTarget.style.color = "#dc2626";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = "transparent";
                              e.currentTarget.style.color = "var(--ac-muted)";
                            }}
                            title="Excluir"
                          >
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={1.8}
                              className="size-4"
                            >
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6M14 11v6" />
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal CRUD */}
      <ConsumivelModal
        open={modalAberto}
        onClose={() => setModalAberto(false)}
        fornecedores={fornecedores}
        categoriasConsumivel={categoriasConsumivel}
        editando={editando}
        onSaved={refreshActiveTab}
      />

      {/* Modal entrada / baixa de estoque */}
      <Modal
        open={!!movModal}
        onClose={() => setMovModal(null)}
        title={
          movModal
            ? movModal.tipo === "entrada"
              ? `Entrada de estoque — ${movModal.item.codigo}`
              : `Baixa — ${movModal.item.codigo}`
            : ""
        }
        width="440px"
      >
        {movModal && (
          <div className="flex flex-col gap-4">
            <p className="text-sm" style={{ color: "var(--ac-muted)" }}>
              {movModal.tipo === "entrada" ? (
                <>
                  Informe a quantidade recebida de{" "}
                  <strong style={{ color: "var(--ac-text)" }}>{movModal.item.nome}</strong>. O
                  estoque será atualizado e o registro entra no histórico de movimentações.
                </>
              ) : (
                <>
                  Registre a quantidade retirada de{" "}
                  <strong style={{ color: "var(--ac-text)" }}>{movModal.item.nome}</strong>. Não é
                  permitido baixar mais do que o estoque atual.
                </>
              )}
            </p>

            <div
              className="rounded-lg px-4 py-3 text-sm flex flex-wrap items-center gap-2"
              style={{ background: "var(--ac-bg)", border: "1px solid var(--ac-border)" }}
            >
              <span style={{ color: "var(--ac-muted)" }}>Estoque atual:</span>
              <strong style={{ color: "var(--ac-text)" }}>
                {Number(movModal.item.estoque_atual).toLocaleString("pt-BR")}
              </strong>
              {movQtdNum > 0 && (
                <>
                  <span style={{ color: "var(--ac-muted)" }}>→</span>
                  <strong
                    style={{
                      color:
                        movModal.tipo === "entrada"
                          ? "#15803d"
                          : Math.round((Number(movModal.item.estoque_atual) - movQtdNum) * 1000) /
                                1000 <
                              0
                            ? "#dc2626"
                            : "#c2410c",
                    }}
                  >
                    {(movModal.tipo === "entrada"
                      ? Number(movModal.item.estoque_atual) + movQtdNum
                      : Number(movModal.item.estoque_atual) - movQtdNum
                    ).toLocaleString("pt-BR")}
                  </strong>
                </>
              )}
            </div>

            <Input
              id="mov-qtd-consumivel"
              label={
                movModal.tipo === "entrada" ? "Quantidade recebida *" : "Quantidade da baixa *"
              }
              type="number"
              min="0.001"
              step="0.001"
              value={movQtd}
              onChange={(e) => {
                setMovQtd(e.target.value);
                setMovErro("");
              }}
            />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: "var(--ac-text)" }}>
                Observação (opcional)
              </label>
              <input
                type="text"
                value={movObs}
                onChange={(e) => setMovObs(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none transition-all"
                style={{
                  background: "var(--ac-card)",
                  border: "1px solid var(--ac-border)",
                  color: "var(--ac-text)",
                }}
                placeholder="Ex.: Uso no escritório, reposição..."
              />
            </div>

            {movErro && (
              <p
                className="text-sm rounded-lg px-3 py-2"
                style={{ color: "#dc2626", background: "#fee2e2" }}
              >
                {movErro}
              </p>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
              <Button variant="secondary" onClick={() => setMovModal(null)}>
                Cancelar
              </Button>
              <Button
                onClick={confirmarMovimento}
                loading={movLoading}
                disabled={movQtdNum <= 0}
                variant={movModal.tipo === "baixa" ? "danger" : "primary"}
              >
                {movModal.tipo === "entrada" ? "Confirmar entrada" : "Confirmar baixa"}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de confirmação de delete */}
      <Modal open={!!deletando} onClose={() => setDeletando(null)} title="Excluir consumível">
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: "var(--ac-text)" }}>
            Tem certeza que deseja excluir <strong>{deletando?.nome}</strong>? Esta ação não pode
            ser desfeita.
          </p>
          {erroDelete && (
            <p
              className="text-sm rounded-lg px-3 py-2"
              style={{ color: "#dc2626", background: "#fee2e2" }}
            >
              {erroDelete}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeletando(null)}>
              Cancelar
            </Button>
            <Button variant="danger" loading={loadingDelete} onClick={confirmarDelete}>
              Excluir
            </Button>
          </div>
        </div>
      </Modal>

      {/* Lightbox de foto */}
      <Modal
        open={!!fotoLightboxSrc}
        onClose={() => {
          setFotoLightboxSrc("");
          setFotoLightboxAlt("");
        }}
        title={`Foto — ${fotoLightboxAlt}`}
        width="520px"
      >
        <div
          style={{
            borderRadius: 14,
            overflow: "hidden",
            border: "1px solid var(--ac-border)",
            background: "var(--ac-card)",
          }}
        >
          <img
            src={fotoLightboxSrc}
            alt={`Foto de ${fotoLightboxAlt}`}
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        </div>
      </Modal>
    </>
  );
}
