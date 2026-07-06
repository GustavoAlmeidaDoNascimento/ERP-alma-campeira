"use client";

import { useState, useEffect, useMemo, type KeyboardEvent } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { SearchableSelect, type SearchableSelectOption } from "@/components/ui/searchable-select";
import { DateInputBR } from "@/components/ui/date-input-br";
import { criarVenda, atualizarVenda } from "@/lib/actions/vendas";
import type { ParcelaInput } from "@/lib/actions/boletos";
import { STATUS_PEDIDO, FORMAS_PAGAMENTO_OC } from "@/types";
import type { Pedido, Cliente, Faca, StatusPedido, FormaPagamentoOC } from "@/types";
import { getOptimizedImageUrl } from "@/lib/images";

type Props = {
  open: boolean;
  onClose: () => void;
  editando: Pedido | null;
  clientes: Cliente[];
  facas: Faca[];
  usuarios: { id: string; nome: string }[];
  /** Pré-seleciona o vendedor em nova venda quando o usuário logado está na lista. */
  usuarioLogadoId: string | null;
  onSaved?: () => void;
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
/** Linhas com quantidade total por faca acima do estoque_atual do cadastro. */
function listarEstoqueInsuficiente(
  itens: { faca_id: string; quantidade: number }[],
  facas: Faca[],
): string[] {
  const quantidadePorFaca = new Map<string, number>();
  for (const item of itens) {
    if (!item.faca_id) continue;
    const qtd = Number(item.quantidade) || 0;
    quantidadePorFaca.set(item.faca_id, (quantidadePorFaca.get(item.faca_id) ?? 0) + qtd);
  }
  const insuficientes: string[] = [];
  for (const [facaId, qtdTotal] of quantidadePorFaca.entries()) {
    const faca = facas.find((f) => f.id === facaId);
    const estoqueAtual = Number(faca?.estoque_atual ?? 0);
    if (!faca || qtdTotal > estoqueAtual) {
      insuficientes.push(
        `${faca?.codigo ?? "Faca"} — solicitado: ${qtdTotal}, disponível: ${estoqueAtual}`,
      );
    }
  }
  return insuficientes;
}

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

export function VendaFormModal({
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
  const [dataPedido, setDataPedido] = useState(today());
  const [status, setStatus] = useState<StatusPedido>("em_espera");
  const [observacao, setObservacao] = useState("");
  const [naturezaOperacao, setNaturezaOperacao] = useState("VENDA DE MERCADORIA");
  const [frete, setFrete] = useState(0);
  const [descontoTotalVal, setDescontoTotalVal] = useState(0);
  const [itens, setItens] = useState<ItemForm[]>([
    { faca_id: "", quantidade: 1, preco_unitario: 0, desconto_pct: 0, desconto_val: 0 },
  ]);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamentoOC | "">("");
  const [pago, setPago] = useState(false);
  const [qtdParcelas, setQtdParcelas] = useState(0);
  const [boletoParcelas, setBoletoParcelas] = useState<
    { numero: number; vencimento: string; valor: string; pago: boolean; pago_em: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState("");
  /** Detalhes do aviso de estoque; quando preenchido, exige confirmação na UI antes de salvar. */
  const [avisoEstoqueInsuficiente, setAvisoEstoqueInsuficiente] = useState<string[] | null>(null);

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
    setAvisoEstoqueInsuficiente(null);
    if (editando) {
      setClienteId(editando.cliente_id ?? "");
      setVendedorId(editando.vendedor_id ?? "");
      setDataPedido(editando.data_pedido);
      setStatus(editando.status);
      setObservacao(editando.observacao ?? "");
      setNaturezaOperacao(editando.natureza_operacao ?? "VENDA DE MERCADORIA");
      setFrete(editando.frete ?? 0);
      setFormaPagamento(editando.forma_pagamento ?? "");
      setPago(!!editando.pago);
      setQtdParcelas(0);
      setBoletoParcelas([]);
      {
        const subLinhas = editando.itens?.reduce((s, i) => s + i.subtotal, 0) ?? 0;
        const base = subLinhas + (editando.frete ?? 0);
        setDescontoTotalVal(Math.min(editando.desconto_total ?? 0, base));
      }
      setItens(
        editando.itens && editando.itens.length > 0
          ? editando.itens.map((i) => ({
              faca_id: i.faca_id,
              quantidade: i.quantidade,
              preco_unitario: i.preco_unitario,
              desconto_pct: 0,
              desconto_val: 0,
            }))
          : [{ faca_id: "", quantidade: 1, preco_unitario: 0, desconto_pct: 0, desconto_val: 0 }],
      );
    } else {
      setClienteId("");
      setVendedorId(
        usuarioLogadoId && usuarios.some((u) => u.id === usuarioLogadoId) ? usuarioLogadoId : "",
      );
      setDataPedido(today());
      setStatus("em_espera");
      setObservacao("");
      setNaturezaOperacao("VENDA DE MERCADORIA");
      setFrete(0);
      setDescontoTotalVal(0);
      setItens([
        { faca_id: "", quantidade: 1, preco_unitario: 0, desconto_pct: 0, desconto_val: 0 },
      ]);
      setFormaPagamento("");
      setPago(false);
      setQtdParcelas(0);
      setBoletoParcelas([]);
    }
  }, [open, editando, usuarioLogadoId, usuarios]);

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

  // Redistribui parcelas automaticamente quando o total muda
  useEffect(() => {
    if (qtdParcelas < 1 || total <= 0) return;
    const n = qtdParcelas;
    const vCada = Number((total / n).toFixed(2));
    let acumulado = 0;
    setBoletoParcelas((prev) =>
      prev.map((p, i) => {
        const ult = i === n - 1;
        const v = ult ? Math.max(0, Number((total - acumulado).toFixed(2))) : vCada;
        acumulado += v;
        return { ...p, valor: v > 0 ? v.toFixed(2) : "" };
      }),
    );
  }, [total, qtdParcelas]);

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

  function salvar() {
    if (!clienteId.trim()) {
      setErro("Selecione um cliente.");
      return;
    }
    if (!vendedorId.trim()) {
      setErro("Selecione um vendedor.");
      return;
    }

    const itensValidos = itens.filter((i) => i.faca_id);
    if (itensValidos.length === 0) {
      setErro("Adicione ao menos um item com faca selecionada.");
      return;
    }

    const insuficientes = listarEstoqueInsuficiente(itensValidos, facas);
    if (insuficientes.length > 0) {
      setErro("");
      setAvisoEstoqueInsuficiente(insuficientes);
      return;
    }

    void executarSalvar(false);
  }

  async function executarSalvar(confirmarEstoqueInsuficiente: boolean) {
    setAvisoEstoqueInsuficiente(null);

    const itensValidos = itens.filter((i) => i.faca_id);

    const parcelasBoleto: ParcelaInput[] = boletoParcelas
      .filter((p) => p.vencimento && Number(p.valor.replace(",", ".")) > 0)
      .map((p) => ({
        numero: p.numero,
        vencimento: p.vencimento,
        valor: Number(p.valor.replace(",", ".")) || 0,
        pago_em: p.pago && p.pago_em ? p.pago_em : null,
        valor_pago: p.pago ? Number(p.valor.replace(",", ".")) || 0 : null,
      }));

    if (!editando && formaPagamento === "boleto" && parcelasBoleto.length === 0) {
      setErro("Preencha ao menos uma parcela do boleto.");
      return;
    }

    setErro("");
    setLoading(true);
    try {
      const input = {
        cliente_id: clienteId.trim(),
        vendedor_id: vendedorId.trim(),
        data_pedido: dataPedido,
        status,
        observacao,
        natureza_operacao: naturezaOperacao,
        frete: frete || 0,
        desconto_total: descontoTotalAplicado,
        forma_pagamento: formaPagamento || null,
        pago: formaPagamento && formaPagamento !== "boleto" ? pago : false,
        boletoParcelas: formaPagamento === "boleto" ? parcelasBoleto : undefined,
        itens: itensValidos.map((i) => ({
          faca_id: i.faca_id,
          quantidade: i.quantidade,
          preco_unitario: parseFloat(
            Math.max(0, (i.preco_unitario || 0) - (i.desconto_val || 0)).toFixed(2),
          ),
        })),
        confirmarEstoqueInsuficiente,
      };
      if (editando) await atualizarVenda(editando.id, input);
      else await criarVenda(input);
      onClose();
      onSaved?.();
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  const selectStyle: React.CSSProperties = {
    background: "var(--ac-card)",
    border: "1px solid var(--ac-border)",
    color: "var(--ac-text)",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'%3E%3Cpath stroke='%236b7280' stroke-width='2' d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 8px center",
    backgroundSize: "16px",
    paddingRight: "32px",
  };

  const inputStyle: React.CSSProperties = {
    background: "var(--ac-card)",
    border: "1px solid var(--ac-border)",
    color: "var(--ac-text)",
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? `Editar venda ${editando.codigo}` : "Nova venda"}
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
              <option value="">Selecione um cliente…</option>
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
              <option value="">Selecione um vendedor…</option>
              {usuarios.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Linha 2: Data da venda + Status */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--ac-muted)" }}
            >
              Data da venda
            </label>
            <input
              type="date"
              value={dataPedido}
              onChange={(e) => setDataPedido(e.target.value)}
              className="px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
              style={inputStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ac-accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ac-border)")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label
              className="text-xs font-semibold uppercase tracking-wide"
              style={{ color: "var(--ac-muted)" }}
            >
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusPedido)}
              className="px-3 py-2.5 rounded-lg text-sm outline-none appearance-none"
              style={selectStyle}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ac-accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ac-border)")}
            >
              <option value="em_espera">{STATUS_PEDIDO.em_espera.label}</option>
              <option value="em_producao">{STATUS_PEDIDO.em_producao.label}</option>
              <option value="entregue">{STATUS_PEDIDO.entregue.label}</option>
            </select>
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
            placeholder="Prazo de entrega, condições especiais..."
            rows={2}
            className="px-3 py-2.5 rounded-lg text-sm outline-none transition-all resize-none"
            style={inputStyle}
            onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ac-accent)")}
            onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ac-border)")}
          />
        </div>

        {/* Natureza da operação (NF-e) */}
        <div className="flex flex-col gap-1.5">
          <label
            className="text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--ac-muted)" }}
          >
            Natureza da operação (NF-e)
          </label>
          <input
            type="text"
            value={naturezaOperacao}
            onChange={(e) => setNaturezaOperacao(e.target.value)}
            placeholder="VENDA DE MERCADORIA"
            className="px-3 py-2.5 rounded-lg text-sm outline-none transition-all"
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
              Itens da venda
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
              const faca = item.faca_id ? facas.find((f) => f.id === item.faca_id) : undefined;
              const estoqueAtual = faca != null ? Number(faca.estoque_atual ?? 0) : null;
              const qtdTotalFacaNoPedido = item.faca_id
                ? itens
                    .filter((i) => i.faca_id === item.faca_id)
                    .reduce((s, i) => s + (Number(i.quantidade) || 0), 0)
                : 0;
              const acimaDoEstoque = estoqueAtual != null && qtdTotalFacaNoPedido > estoqueAtual;
              return (
                <div key={idx} className="flex flex-col gap-0.5">
                  <div
                    className="grid gap-2 items-center"
                    style={{ gridTemplateColumns: "1fr 70px 110px 180px 90px 32px" }}
                  >
                    {/* Faca */}
                    <SearchableSelect
                      value={item.faca_id}
                      onChange={(v) => updateItem(idx, "faca_id", v)}
                      options={opcoesFaca}
                      placeholder="Pesquisar por código ou nome…"
                      emptyMessage="Nenhuma faca encontrada"
                    />

                    {/* Quantidade */}
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

                    {/* Preço unitário */}
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

                    {/* Desconto: % e R$ */}
                    <div className="grid grid-cols-2 gap-1">
                      {/* Porcentagem: sufixo % fora do input */}
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
                      {/* Valor: prefixo R$ fora do input */}
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

                    {/* Subtotal */}
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

                    {/* Remove */}
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
                  {estoqueAtual != null && (
                    <p
                      className="text-xs px-1 tabular-nums"
                      style={{ color: acimaDoEstoque ? "#b45309" : "var(--ac-muted)" }}
                    >
                      Em estoque: {estoqueAtual}
                      {acimaDoEstoque && (
                        <span> · total neste pedido: {qtdTotalFacaNoPedido}</span>
                      )}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Forma de pagamento + boleto inline */}
          <div
            className="flex flex-col gap-2 pt-2 mt-1"
            style={{ borderTop: "1px solid var(--ac-border)" }}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <label
                className="text-sm font-semibold uppercase tracking-wide shrink-0"
                style={{ color: "var(--ac-muted)" }}
              >
                Forma de pagamento
              </label>
              <select
                value={formaPagamento}
                onChange={(e) => {
                  const v = e.target.value as FormaPagamentoOC | "";
                  setFormaPagamento(v);
                  if (!v || v === "boleto") setPago(false);
                }}
                className="px-3 py-2 rounded-lg text-sm outline-none appearance-none"
                style={{ ...selectStyle, minWidth: 180 }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--ac-accent)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--ac-border)")}
              >
                <option value="">— Selecione —</option>
                {(
                  Object.entries(FORMAS_PAGAMENTO_OC) as [FormaPagamentoOC, { label: string }][]
                ).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
              {formaPagamento && formaPagamento !== "boleto" && (
                <label
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm transition-all cursor-pointer select-none"
                  style={{
                    background: pago ? "#dcfce7" : "transparent",
                    color: pago ? "#15803d" : "var(--ac-text)",
                    border: `1px solid ${pago ? "#bbf7d0" : "var(--ac-border)"}`,
                    fontWeight: 500,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={pago}
                    onChange={(e) => setPago(e.target.checked)}
                  />
                  <span>Pago</span>
                </label>
              )}
            </div>

            {/* Parcelas do boleto — aparece quando forma = boleto */}
            {formaPagamento === "boleto" && (
              <div
                className="flex flex-col gap-3 rounded-lg p-3"
                style={{ background: "var(--ac-bg)", border: "1px solid var(--ac-border)" }}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span
                    className="text-xs font-semibold uppercase tracking-wide"
                    style={{ color: "var(--ac-muted)" }}
                  >
                    Parcelas
                  </span>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setQtdParcelas(n);
                          const base = new Date().toISOString().slice(0, 10);
                          const vCada = total > 0 ? Number((total / n).toFixed(2)) : 0;
                          let acumulado = 0;
                          setBoletoParcelas(
                            Array.from({ length: n }, (_, i) => {
                              const ult = i === n - 1;
                              const v = ult
                                ? Math.max(0, Number((total - acumulado).toFixed(2)))
                                : vCada;
                              acumulado += v;
                              const d = new Date(base);
                              d.setMonth(d.getMonth() + i + 1);
                              return {
                                numero: i + 1,
                                vencimento: d.toISOString().slice(0, 10),
                                valor: v > 0 ? v.toFixed(2) : "",
                                pago: false,
                                pago_em: "",
                              };
                            }),
                          );
                        }}
                        className="px-2.5 py-1 rounded text-xs font-medium"
                        style={{
                          background: qtdParcelas === n ? "var(--ac-accent)" : "var(--ac-card)",
                          color: qtdParcelas === n ? "white" : "var(--ac-text)",
                          border: "1px solid var(--ac-border)",
                        }}
                      >
                        {n}x
                      </button>
                    ))}
                  </div>
                </div>

                {boletoParcelas.length > 0 && (
                  <div
                    className="rounded-lg overflow-hidden"
                    style={{ border: "1px solid var(--ac-border)" }}
                  >
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: "var(--ac-bg)" }}>
                          <th
                            className="px-3 py-2 text-left text-xs uppercase font-semibold"
                            style={{ color: "var(--ac-muted)" }}
                          >
                            #
                          </th>
                          <th
                            className="px-3 py-2 text-left text-xs uppercase font-semibold"
                            style={{ color: "var(--ac-muted)" }}
                          >
                            Vencimento
                          </th>
                          <th
                            className="px-3 py-2 text-right text-xs uppercase font-semibold"
                            style={{ color: "var(--ac-muted)" }}
                          >
                            Valor
                          </th>
                          <th
                            className="px-3 py-2 text-center text-xs uppercase font-semibold"
                            style={{ color: "var(--ac-muted)" }}
                          >
                            Pago
                          </th>
                          <th
                            className="px-3 py-2 text-left text-xs uppercase font-semibold"
                            style={{ color: "var(--ac-muted)" }}
                          >
                            Data pago
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {boletoParcelas.map((p, i) => (
                          <tr
                            key={i}
                            style={{ borderTop: i > 0 ? "1px solid var(--ac-border)" : undefined }}
                          >
                            <td
                              className="px-3 py-2 font-mono text-xs"
                              style={{ color: "var(--ac-muted)" }}
                            >
                              {p.numero}
                            </td>
                            <td className="px-3 py-2">
                              <DateInputBR
                                value={p.vencimento}
                                onChange={(iso) =>
                                  setBoletoParcelas((prev) =>
                                    prev.map((l, j) => (j === i ? { ...l, vencimento: iso } : l)),
                                  )
                                }
                                className="rounded px-2 py-1 text-sm outline-none w-full"
                                style={{
                                  background: "var(--ac-card)",
                                  border: "1px solid var(--ac-border)",
                                  color: "var(--ac-text)",
                                }}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={p.valor}
                                onChange={(e) =>
                                  setBoletoParcelas((prev) =>
                                    prev.map((l, j) =>
                                      j === i ? { ...l, valor: e.target.value } : l,
                                    ),
                                  )
                                }
                                className="rounded px-2 py-1 text-sm outline-none w-full text-right tabular-nums"
                                style={{
                                  background: "var(--ac-card)",
                                  border: "1px solid var(--ac-border)",
                                  color: "var(--ac-text)",
                                }}
                              />
                            </td>
                            <td className="px-3 py-2 text-center">
                              <input
                                type="checkbox"
                                checked={p.pago}
                                onChange={(e) =>
                                  setBoletoParcelas((prev) =>
                                    prev.map((l, j) =>
                                      j === i
                                        ? {
                                            ...l,
                                            pago: e.target.checked,
                                            pago_em:
                                              e.target.checked && !l.pago_em
                                                ? new Date().toISOString().slice(0, 10)
                                                : l.pago_em,
                                          }
                                        : l,
                                    ),
                                  )
                                }
                                className="w-4 h-4 rounded"
                                style={{ accentColor: "var(--ac-accent)" }}
                              />
                            </td>
                            <td className="px-3 py-2">
                              {p.pago && (
                                <DateInputBR
                                  value={p.pago_em}
                                  onChange={(iso) =>
                                    setBoletoParcelas((prev) =>
                                      prev.map((l, j) => (j === i ? { ...l, pago_em: iso } : l)),
                                    )
                                  }
                                  className="rounded px-2 py-1 text-sm outline-none w-full"
                                  style={{
                                    background: "var(--ac-card)",
                                    border: "1px solid var(--ac-border)",
                                    color: "var(--ac-text)",
                                  }}
                                />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {editando && (
                  <p className="text-xs" style={{ color: "var(--ac-muted)" }}>
                    O boleto só é criado se a venda ainda não tiver um vinculado.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Frete + Total */}
          <div
            className="flex flex-col gap-2 pt-2 mt-1"
            style={{ borderTop: "1px solid var(--ac-border)" }}
          >
            {/* Linha de frete */}
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

            {/* Desconto sobre o total (% + R$) */}
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

            {/* Total geral */}
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

        {avisoEstoqueInsuficiente && avisoEstoqueInsuficiente.length > 0 && (
          <div
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{ background: "#fffbeb", border: "1px solid #fde68a" }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: "#92400e" }}>
                Estoque insuficiente
              </p>
              <p className="text-xs mt-1" style={{ color: "#b45309" }}>
                A venda pode ser registrada mesmo assim — a produção pode ocorrer depois do
                pedido.
              </p>
              <ul className="mt-2 text-xs list-disc pl-4 space-y-0.5" style={{ color: "#92400e" }}>
                {avisoEstoqueInsuficiente.map((linha) => (
                  <li key={linha}>{linha}</li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setAvisoEstoqueInsuficiente(null)}
                disabled={loading}
              >
                Voltar e ajustar
              </Button>
              <Button loading={loading} onClick={() => void executarSalvar(true)}>
                {editando ? "Salvar mesmo assim" : "Criar venda mesmo assim"}
              </Button>
            </div>
          </div>
        )}

        {erro && (
          <p
            className="text-sm rounded-lg px-3 py-2"
            style={{ color: "#dc2626", background: "#fee2e2" }}
          >
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          {!avisoEstoqueInsuficiente && (
            <Button loading={loading} onClick={salvar}>
              {editando ? "Salvar" : "Criar venda"}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
