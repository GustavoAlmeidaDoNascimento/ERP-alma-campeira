"use client";

import { useState, useEffect, useMemo, type KeyboardEvent } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { criarOrcamento, atualizarOrcamento } from "@/lib/actions/orcamentos";
import type { Orcamento, Cliente, Faca, OrcamentoItem } from "@/types";
import { getOptimizedImageUrl } from "@/lib/images";

type Props = {
  open: boolean;
  onClose: () => void;
  editando: Orcamento | null;
  clientes: Cliente[];
  facas: Faca[];
  usuarios: { id: string; nome: string }[];
  /** Pré-seleciona o vendedor em novo orçamento quando o usuário logado está na lista. */
  usuarioLogadoId: string | null;
  /** Chamado após salvar, com o ID do orçamento (útil pra abrir detalhe direto). */
  onSaved?: (orcamentoId: string) => void;
};

type ItemForm = {
  faca_id: string;
  quantidade: number;
  preco_unitario: number;
  desconto_pct: number;
  desconto_val: number;
};

function today() {
  return new Date().toISOString().split("T")[0];
}

function moeda2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Setas ↑/↓: passo inteiro (1); step=0.01 no HTML continua válido para digitação decimal. */
function applyArrowStep(
  e: KeyboardEvent<HTMLInputElement>,
  current: number,
  set: (n: number) => void,
  opts: { min?: number; max?: number; step?: number },
) {
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
  e.preventDefault();
  const base = Number.isFinite(current) ? current : 0;
  const inc = opts.step ?? 1;
  const delta = e.key === "ArrowUp" ? inc : -inc;
  let next = moeda2(base + delta);
  if (opts.min !== undefined) next = Math.max(opts.min, next);
  if (opts.max !== undefined) next = Math.min(opts.max, next);
  set(moeda2(next));
}

/**
 * O banco guarda só o preço líquido por item. Ao reabrir o formulário, recompomos
 * "preço de tabela" (catálogo atual da faca) + desconto unitário para não aplicar
 * desconto duas vezes nem perder a visualização do desconto.
 */
function itemFormDesdePersistido(i: OrcamentoItem, facas: Faca[]): ItemForm {
  const net = moeda2(Number(i.preco_unitario));
  const faca = facas.find((f) => f.id === i.faca_id);
  if (!faca) {
    return {
      faca_id: i.faca_id,
      quantidade: i.quantidade,
      preco_unitario: net,
      desconto_pct: 0,
      desconto_val: 0,
    };
  }
  const catalogo = moeda2(Number(faca.preco_venda));
  if (catalogo - net <= 0.009) {
    return {
      faca_id: i.faca_id,
      quantidade: i.quantidade,
      preco_unitario: net,
      desconto_pct: 0,
      desconto_val: 0,
    };
  }
  const descontoVal = moeda2(catalogo - net);
  const descontoPct = catalogo > 0 ? parseFloat(((descontoVal / catalogo) * 100).toFixed(4)) : 0;
  return {
    faca_id: i.faca_id,
    quantidade: i.quantidade,
    preco_unitario: catalogo,
    desconto_pct: descontoPct,
    desconto_val: descontoVal,
  };
}

export function OrcamentoFormModal({
  open,
  onClose,
  editando,
  clientes,
  facas,
  usuarios,
  usuarioLogadoId,
  onSaved,
}: Props) {
  const [clienteId, setClienteId] = useState("");
  const [vendedorId, setVendedorId] = useState("");
  const [dataOrcamento, setDataOrcamento] = useState(today());
  const [observacao, setObservacao] = useState("");
  const [frete, setFrete] = useState(0);
  const [descontoTotalVal, setDescontoTotalVal] = useState(0);
  const [itens, setItens] = useState<ItemForm[]>([
    { faca_id: "", quantidade: 1, preco_unitario: 0, desconto_pct: 0, desconto_val: 0 },
  ]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");

  const opcoesFaca = useMemo<SearchableSelectOption[]>(
    () =>
      facas.map((f) => ({
        value: f.id,
        label: `${f.codigo} — ${f.nome}`,
        imageUrl: f.foto_url
          ? getOptimizedImageUrl(f.foto_url, {
              width: 40,
              height: 40,
              quality: 60,
              resize: "cover",
              fallbackUrl: "",
            })
          : null,
      })),
    [facas],
  );

  useEffect(() => {
    if (!open) return;
    setErro("");
    if (editando) {
      setClienteId(editando.cliente_id ?? "");
      setVendedorId(editando.vendedor_id ?? "");
      setDataOrcamento(editando.data_orcamento);
      setObservacao(editando.observacao ?? "");
      setFrete(editando.frete ?? 0);
      {
        const subLinhas = editando.itens?.reduce((s, i) => s + i.subtotal, 0) ?? 0;
        const base = subLinhas + (editando.frete ?? 0);
        setDescontoTotalVal(Math.min(editando.desconto_total ?? 0, base));
      }
      setItens(
        editando.itens && editando.itens.length > 0
          ? editando.itens.map((i) => itemFormDesdePersistido(i, facas))
          : [{ faca_id: "", quantidade: 1, preco_unitario: 0, desconto_pct: 0, desconto_val: 0 }],
      );
    } else {
      setClienteId("");
      setVendedorId(
        usuarioLogadoId && usuarios.some((u) => u.id === usuarioLogadoId) ? usuarioLogadoId : "",
      );
      setDataOrcamento(today());
      setObservacao("");
      setFrete(0);
      setDescontoTotalVal(0);
      setItens([
        { faca_id: "", quantidade: 1, preco_unitario: 0, desconto_pct: 0, desconto_val: 0 },
      ]);
    }
  }, [open, editando, facas, usuarioLogadoId, usuarios]);

  const subtotalItens = useMemo(
    () =>
      itens.reduce((s, i) => {
        const precoLiquido = Math.max(0, (i.preco_unitario || 0) - (i.desconto_val || 0));
        return s + (i.quantidade || 0) * precoLiquido;
      }, 0),
    [itens],
  );

  const baseAntesDescontoTotal = useMemo(
    () => subtotalItens + (frete || 0),
    [subtotalItens, frete],
  );

  const descontoTotalAplicado = Math.min(descontoTotalVal, baseAntesDescontoTotal);
  const pctDescontoTotal =
    baseAntesDescontoTotal > 0
      ? parseFloat(((descontoTotalAplicado / baseAntesDescontoTotal) * 100).toFixed(4))
      : 0;

  useEffect(() => {
    setDescontoTotalVal((v) => Math.min(v, baseAntesDescontoTotal));
  }, [baseAntesDescontoTotal]);

  const total = useMemo(
    () => Math.max(0, baseAntesDescontoTotal - descontoTotalAplicado),
    [baseAntesDescontoTotal, descontoTotalAplicado],
  );

  function setDescontoTotalPorPct(pct: number) {
    const p = Math.max(0, Math.min(100, pct));
    const v =
      baseAntesDescontoTotal > 0
        ? Math.min(
            parseFloat(((baseAntesDescontoTotal * p) / 100).toFixed(2)),
            baseAntesDescontoTotal,
          )
        : 0;
    setDescontoTotalVal(v);
  }

  function setDescontoTotalPorValor(v: number) {
    setDescontoTotalVal(Math.min(Math.max(0, v), baseAntesDescontoTotal));
  }

  function addItem() {
    setItens((prev) => [
      ...prev,
      { faca_id: "", quantidade: 1, preco_unitario: 0, desconto_pct: 0, desconto_val: 0 },
    ]);
  }

  function removeItem(idx: number) {
    setItens((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, field: keyof ItemForm, value: string | number) {
    setItens((prev) => {
      const next = [...prev];
      const item = { ...next[idx], [field]: value };

      if (field === "faca_id") {
        const faca = facas.find((f) => f.id === value);
        if (faca) {
          item.preco_unitario = faca.preco_venda;
          item.desconto_pct = 0;
          item.desconto_val = 0;
        }
      }

      if (field === "preco_unitario") {
        const preco = parseFloat(String(value)) || 0;
        const pct = item.desconto_pct || 0;
        item.desconto_val = preco > 0 ? parseFloat(((preco * pct) / 100).toFixed(2)) : 0;
      }

      if (field === "desconto_val") {
        const val = parseFloat(String(value)) || 0;
        const preco = item.preco_unitario || 0;
        item.desconto_pct = preco > 0 ? parseFloat(((val / preco) * 100).toFixed(4)) : 0;
      }

      if (field === "desconto_pct") {
        const pct = parseFloat(String(value)) || 0;
        const preco = item.preco_unitario || 0;
        item.desconto_val = parseFloat(((preco * pct) / 100).toFixed(2));
      }

      next[idx] = item;
      return next;
    });
  }

  async function salvar() {
    const itensValidos = itens.filter((i) => i.faca_id);
    if (itensValidos.length === 0) {
      setErro("Adicione ao menos um item com faca selecionada.");
      return;
    }

    setErro("");
    setLoading(true);
    try {
      const input = {
        cliente_id: clienteId || null,
        vendedor_id: vendedorId || null,
        data_orcamento: dataOrcamento,
        observacao,
        frete: frete || 0,
        desconto_total: descontoTotalAplicado,
        itens: itensValidos.map((i) => ({
          faca_id: i.faca_id,
          quantidade: i.quantidade,
          preco_unitario: parseFloat(
            Math.max(0, (i.preco_unitario || 0) - (i.desconto_val || 0)).toFixed(2),
          ),
        })),
      };

      let id: string;
      if (editando) {
        await atualizarOrcamento(editando.id, input);
        id = editando.id;
      } else {
        const res = await criarOrcamento(input);
        id = res.id;
      }
      onClose();
      onSaved?.(id);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  const selectStyle: React.CSSProperties = {
    background: "var(--ac-card)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--ac-border)",
    color: "var(--ac-text)",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%236b7280' stroke-width='2' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 8px center",
    backgroundSize: "16px",
    paddingRight: "32px",
  };

  /** Só borda em forma longa — evita conflito com onFocus que altera `borderColor` (warning do React). */
  const inputStyle: React.CSSProperties = {
    background: "var(--ac-card)",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "var(--ac-border)",
    color: "var(--ac-text)",
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? `Editar orçamento ${editando.codigo}` : "Novo orçamento"}
      width="1000px"
    >
      <div className="flex flex-col gap-5">
        {/* Linha 1: Cliente + Vendedor */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--ac-muted)" }}
              >
                Cliente
              </label>
              <Link
                href="/clientes"
                onClick={onClose}
                className="flex items-center gap-1 text-xs font-medium transition-colors"
                style={{ color: "var(--ac-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ac-accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ac-muted)")}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  className="size-3.5 shrink-0"
                  aria-hidden
                >
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Gerenciar clientes
              </Link>
            </div>
            <select
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
              style={selectStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ac-accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ac-border)")}
            >
              <option value="">— Sem cliente —</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--ac-muted)" }}
            >
              Vendedor
            </label>
            <select
              value={vendedorId}
              onChange={(e) => setVendedorId(e.target.value)}
              className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
              style={selectStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ac-accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ac-border)")}
            >
              <option value="">— Sem vendedor —</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Data do orçamento */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--ac-muted)" }}
            >
              Data do orçamento
            </label>
            <input
              type="date"
              value={dataOrcamento}
              onChange={(e) => setDataOrcamento(e.target.value)}
              className="px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ac-accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ac-border)")}
            />
          </div>
        </div>

        {/* Observação */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--ac-muted)" }}
          >
            Observação
          </label>
          <textarea
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Validade do orçamento, prazo, condições..."
            rows={2}
            className="px-3 py-2.5 rounded-lg text-sm outline-none transition-all resize-none"
            style={inputStyle}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ac-accent)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ac-border)")}
          />
        </div>

        {/* Itens */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--ac-muted)" }}
            >
              Itens do orçamento
            </label>
            <button
              onClick={addItem}
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors"
              style={{
                color: "var(--ac-accent)",
                background: "color-mix(in srgb, var(--ac-accent) 12%, transparent)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background =
                  "color-mix(in srgb, var(--ac-accent) 20%, transparent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background =
                  "color-mix(in srgb, var(--ac-accent) 12%, transparent)";
              }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
                className="size-3.5"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Adicionar item
            </button>
          </div>

          {/* Header */}
          <div
            className="grid gap-2 text-xs font-semibold uppercase tracking-wide px-1"
            style={{
              gridTemplateColumns: "1fr 70px 110px 180px 90px 32px",
              color: "var(--ac-muted)",
            }}
          >
            <span>Faca</span>
            <span className="text-center">Qtd</span>
            <span className="text-right">Preço unit.</span>
            <span className="text-center">Desconto unitário</span>
            <span className="text-right">Subtotal</span>
            <span></span>
          </div>

          <div className="flex flex-col gap-1.5">
            {itens.map((item, idx) => {
              const precoLiquido = Math.max(
                0,
                (item.preco_unitario || 0) - (item.desconto_val || 0),
              );
              const subtotal = (item.quantidade || 0) * precoLiquido;
              const temDesconto = (item.desconto_val || 0) > 0;
              return (
                <div
                  key={idx}
                  className="grid gap-2 items-center"
                  style={{ gridTemplateColumns: "1fr 70px 110px 180px 90px 32px" }}
                >
                  <SearchableSelect
                    value={item.faca_id}
                    onChange={(v) => updateItem(idx, "faca_id", v)}
                    options={opcoesFaca}
                    placeholder="Pesquisar por código ou nome…"
                    emptyMessage="Nenhuma faca encontrada"
                  />

                  <input
                    type="number"
                    min={1}
                    value={item.quantidade}
                    onChange={(e) => updateItem(idx, "quantidade", parseInt(e.target.value) || 1)}
                    className="px-2.5 py-2 rounded-lg text-sm outline-none text-center tabular-nums"
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ac-accent)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ac-border)")}
                  />

                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={item.preco_unitario}
                    onChange={(e) =>
                      updateItem(idx, "preco_unitario", parseFloat(e.target.value) || 0)
                    }
                    className="px-2.5 py-2 rounded-lg text-sm outline-none text-right tabular-nums"
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ac-accent)")}
                    onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ac-border)")}
                  />

                  <div className="grid grid-cols-2 gap-1">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={item.desconto_pct === 0 ? "" : item.desconto_pct}
                        placeholder="0"
                        onChange={(e) =>
                          updateItem(idx, "desconto_pct", parseFloat(e.target.value) || 0)
                        }
                        onKeyDown={(e) =>
                          applyArrowStep(
                            e,
                            item.desconto_pct,
                            (n) => updateItem(idx, "desconto_pct", n),
                            {
                              min: 0,
                              max: 100,
                            },
                          )
                        }
                        className="w-full px-2 py-2 rounded-lg text-sm outline-none text-right tabular-nums"
                        style={
                          temDesconto
                            ? { ...inputStyle, borderColor: "#f59e0b", color: "#b45309" }
                            : inputStyle
                        }
                        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ac-accent)")}
                        onBlur={(e) =>
                          (e.currentTarget.style.borderColor = temDesconto
                            ? "#f59e0b"
                            : "var(--ac-border)")
                        }
                      />
                      <span className="text-xs shrink-0" style={{ color: "var(--ac-muted)" }}>
                        %
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs shrink-0" style={{ color: "var(--ac-muted)" }}>
                        R$
                      </span>
                      <input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.desconto_val === 0 ? "" : item.desconto_val}
                        placeholder="0,00"
                        onChange={(e) =>
                          updateItem(idx, "desconto_val", parseFloat(e.target.value) || 0)
                        }
                        onKeyDown={(e) =>
                          applyArrowStep(
                            e,
                            item.desconto_val,
                            (n) => updateItem(idx, "desconto_val", n),
                            {
                              min: 0,
                              max: item.preco_unitario || 0,
                            },
                          )
                        }
                        className="w-full px-2 py-2 rounded-lg text-sm outline-none text-right tabular-nums"
                        style={
                          temDesconto
                            ? { ...inputStyle, borderColor: "#f59e0b", color: "#b45309" }
                            : inputStyle
                        }
                        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ac-accent)")}
                        onBlur={(e) =>
                          (e.currentTarget.style.borderColor = temDesconto
                            ? "#f59e0b"
                            : "var(--ac-border)")
                        }
                      />
                    </div>
                  </div>

                  <div className="text-right">
                    {temDesconto && (
                      <div
                        className="text-xs tabular-nums line-through"
                        style={{ color: "var(--ac-muted)" }}
                      >
                        {((item.quantidade || 0) * (item.preco_unitario || 0)).toLocaleString(
                          "pt-BR",
                          { style: "currency", currency: "BRL" },
                        )}
                      </div>
                    )}
                    <span
                      className="text-sm tabular-nums font-medium"
                      style={{ color: temDesconto ? "#15803d" : "var(--ac-text)" }}
                    >
                      {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>

                  <button
                    onClick={() => removeItem(idx)}
                    disabled={itens.length <= 1}
                    className="p-1 rounded-lg transition-colors flex items-center justify-center"
                    style={{ color: itens.length <= 1 ? "var(--ac-border)" : "var(--ac-muted)" }}
                    onMouseEnter={(e) => {
                      if (itens.length > 1) {
                        e.currentTarget.style.background = "#fee2e2";
                        e.currentTarget.style.color = "#dc2626";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color =
                        itens.length <= 1 ? "var(--ac-border)" : "var(--ac-muted)";
                    }}
                    title="Remover item"
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      className="size-4"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>

          {/* Frete + Desconto + Total */}
          <div
            className="flex flex-col gap-2 pt-2 mt-1"
            style={{ borderTop: "1px solid var(--ac-border)" }}
          >
            <div className="flex items-center justify-end gap-3">
              <label
                className="text-sm font-semibold uppercase tracking-wide"
                style={{ color: "var(--ac-muted)" }}
              >
                Frete
              </label>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-sm tabular-nums pointer-events-none"
                  style={{ color: "var(--ac-muted)" }}
                >
                  R$
                </span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={frete === 0 ? "" : frete}
                  placeholder="0,00"
                  onChange={(e) => setFrete(parseFloat(e.target.value) || 0)}
                  className="pl-9 pr-3 py-1.5 rounded-lg text-sm outline-none text-right tabular-nums w-32"
                  style={inputStyle}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ac-accent)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ac-border)")}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              <label
                className="text-sm font-semibold uppercase tracking-wide shrink-0"
                style={{ color: "var(--ac-muted)" }}
              >
                Desconto no total
              </label>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={pctDescontoTotal === 0 ? "" : pctDescontoTotal}
                    placeholder="0"
                    onChange={(e) => setDescontoTotalPorPct(parseFloat(e.target.value) || 0)}
                    onKeyDown={(e) =>
                      applyArrowStep(e, pctDescontoTotal, setDescontoTotalPorPct, {
                        min: 0,
                        max: 100,
                      })
                    }
                    disabled={baseAntesDescontoTotal <= 0}
                    className="w-[4.5rem] px-2 py-1.5 rounded-lg text-sm outline-none text-right tabular-nums"
                    style={
                      descontoTotalAplicado > 0
                        ? { ...inputStyle, borderColor: "#f59e0b", color: "#b45309" }
                        : inputStyle
                    }
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ac-accent)")}
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor =
                        descontoTotalAplicado > 0 ? "#f59e0b" : "var(--ac-border)")
                    }
                  />
                  <span className="text-xs shrink-0" style={{ color: "var(--ac-muted)" }}>
                    %
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs shrink-0" style={{ color: "var(--ac-muted)" }}>
                    R$
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={descontoTotalVal === 0 ? "" : descontoTotalVal}
                    placeholder="0,00"
                    onChange={(e) => setDescontoTotalPorValor(parseFloat(e.target.value) || 0)}
                    onKeyDown={(e) =>
                      applyArrowStep(e, descontoTotalVal, setDescontoTotalPorValor, {
                        min: 0,
                        max: baseAntesDescontoTotal,
                      })
                    }
                    disabled={baseAntesDescontoTotal <= 0}
                    className="w-28 px-2 py-1.5 rounded-lg text-sm outline-none text-right tabular-nums"
                    style={
                      descontoTotalAplicado > 0
                        ? { ...inputStyle, borderColor: "#f59e0b", color: "#b45309" }
                        : inputStyle
                    }
                    onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ac-accent)")}
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor =
                        descontoTotalAplicado > 0 ? "#f59e0b" : "var(--ac-border)")
                    }
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col items-end gap-0.5">
              {descontoTotalAplicado > 0 && (
                <div
                  className="text-xs tabular-nums line-through"
                  style={{ color: "var(--ac-muted)" }}
                >
                  {baseAntesDescontoTotal.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </div>
              )}
              <div className="flex items-center justify-end gap-3">
                <span
                  className="text-sm font-semibold uppercase tracking-wide"
                  style={{ color: "var(--ac-muted)" }}
                >
                  Total
                </span>
                <span
                  className="text-xl font-bold"
                  style={{ color: descontoTotalAplicado > 0 ? "#15803d" : "var(--ac-accent)" }}
                >
                  {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {erro && (
          <p
            className="text-sm rounded-lg px-3 py-2"
            style={{ color: "#dc2626", background: "#fee2e2" }}
          >
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button loading={loading} onClick={salvar}>
            {editando ? "Salvar" : "Criar orçamento"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
