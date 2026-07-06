"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { alterarStatus, definirPagoVenda } from "@/lib/actions/vendas";
import { STATUS_PEDIDO, FORMAS_PAGAMENTO_OC } from "@/types";
import type { Pedido, PedidoClienteJoin, StatusPedido } from "@/types";

const STATUS_OPTIONS: StatusPedido[] = ["em_espera", "em_producao", "entregue"];
import {
  abrirImpressaoPedido,
  abrirImpressaoVendaSemValor,
} from "@/components/vendas/venda-impressao";
import { getOptimizedImageUrl } from "@/lib/images";
import { formatarDocumento } from "@/lib/br/documento";

function fmtDataHora(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function fmtCep(v: string | null | undefined) {
  if (!v?.trim()) return "";
  const d = v.replace(/\D/g, "");
  if (d.length === 8) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return v.trim();
}

function clienteTemContatoOuEndereco(c: PedidoClienteJoin) {
  return !!(
    c.telefone?.trim() ||
    c.email?.trim() ||
    c.cep?.trim() ||
    c.logradouro?.trim() ||
    c.numero?.trim() ||
    c.bairro?.trim() ||
    c.complemento?.trim() ||
    (c.cidade?.trim() && c.estado?.trim()) ||
    (c.cidade?.trim() && !c.estado?.trim()) ||
    (c.estado?.trim() && !c.cidade?.trim())
  );
}

/** Endereço formatado ou null quando não há nada a exibir */
function textoEnderecoCliente(c: PedidoClienteJoin): string | null {
  const cep = fmtCep(c.cep);
  const rua = [c.logradouro?.trim(), c.numero?.trim()].filter(Boolean).join(", ");
  const comp = c.complemento?.trim();
  const bai = c.bairro?.trim();
  const cidadeUf = c.cidade && c.estado ? `${c.cidade}/${c.estado}` : c.cidade || c.estado || "";

  const line1 = [cep, rua].filter(Boolean).join(" · ");
  const line2 = [comp, bai].filter(Boolean).join(" · ");
  const blocos = [line1, line2, cidadeUf.trim()].filter((s) => s.length > 0);
  if (blocos.length === 0) return null;
  return blocos.join("\n");
}

function DetailMeta({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
      <span
        className="text-xs font-semibold shrink-0 sm:w-36 tabular-nums"
        style={{ color: "var(--ac-muted)" }}
      >
        {label}
      </span>
      <span className="text-sm break-words" style={{ color: "var(--ac-text)" }}>
        {value}
      </span>
    </div>
  );
}

type Props = {
  pedido: Pedido | null;
  onClose: () => void;
  onStatusChange?: (id: string, novoStatus: StatusPedido, entregue_at?: string) => void;
  perm: { editar: boolean };
};

export function VendaDetalheModal({ pedido, onClose, onStatusChange, perm }: Props) {
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingPago, setLoadingPago] = useState(false);
  const [pagoLocal, setPagoLocal] = useState<boolean>(!!pedido?.pago);
  const [imprimirOpen, setImprimirOpen] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => {
    setPagoLocal(!!pedido?.pago);
  }, [pedido?.id, pedido?.pago]);
  const imprimirRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!imprimirOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!imprimirRef.current) return;
      if (!imprimirRef.current.contains(e.target as Node)) setImprimirOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setImprimirOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [imprimirOpen]);

  if (!pedido) return null;

  const status = STATUS_PEDIDO[pedido.status];
  const pedidoId = pedido.id;

  function exportarVendaSemValor() {
    const p = pedido;
    if (!p) return;
    setErro("");
    setImprimirOpen(false);
    abrirImpressaoVendaSemValor(p);
  }

  function exportarPedido() {
    const p = pedido;
    if (!p) return;
    setErro("");
    setImprimirOpen(false);
    abrirImpressaoPedido(p);
  }

  async function handleTogglePago(novo: boolean) {
    if (!pedido) return;
    setErro("");
    setLoadingPago(true);
    const anterior = pagoLocal;
    setPagoLocal(novo);
    try {
      await definirPagoVenda(pedidoId, novo);
    } catch (e: unknown) {
      setPagoLocal(anterior);
      setErro(e instanceof Error ? e.message : "Erro ao atualizar pagamento.");
    } finally {
      setLoadingPago(false);
    }
  }

  async function handleAlterarStatus(novoStatus: StatusPedido) {
    if (!pedido || novoStatus === pedido.status) return;
    if (novoStatus === "entregue") {
      const ok = window.confirm("Marcar como entregue dará baixa no estoque das facas. Confirmar?");
      if (!ok) return;
    } else if (pedido.status === "entregue") {
      const ok = window.confirm(
        "Voltar de Entregue irá reverter a baixa de estoque (criando movimentações de ajuste). Confirmar?",
      );
      if (!ok) return;
    }
    setErro("");
    setLoadingStatus(true);
    try {
      await alterarStatus(pedidoId, novoStatus);
      const entregue_at = novoStatus === "entregue" ? new Date().toISOString() : undefined;
      onStatusChange?.(pedidoId, novoStatus, entregue_at);
      onClose();
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao alterar status.");
    } finally {
      setLoadingStatus(false);
    }
  }

  const subtotalItens = pedido.itens?.reduce((s, i) => s + i.subtotal, 0) ?? 0;
  const frete = pedido.frete ?? 0;
  const descontoTotal = pedido.desconto_total ?? 0;
  const total = pedido.valor_total ?? Math.max(0, subtotalItens + frete - descontoTotal);

  return (
    <Modal
      open={!!pedido}
      onClose={onClose}
      title={`Venda ${pedido.sequencial != null ? `#${pedido.sequencial} · ` : ""}${pedido.codigo}`}
      width="820px"
    >
      <div className="flex flex-col gap-5">
        {/* Info header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold"
                style={{
                  color: status.color,
                  background: status.bg,
                  border: `1px solid ${status.border}`,
                }}
              >
                {status.label}
              </span>
              {pedido.entregue_at && (
                <span className="text-xs" style={{ color: "var(--ac-muted)" }}>
                  Entregue em {new Date(pedido.entregue_at).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
            <p className="text-sm mt-1" style={{ color: "var(--ac-muted)" }}>
              <strong style={{ color: "var(--ac-text)" }}>
                {pedido.cliente?.nome ?? "Sem cliente"}
              </strong>
              {pedido.cliente?.tipo && (
                <span className="ml-2 text-xs" style={{ color: "var(--ac-muted)" }}>
                  ({pedido.cliente.tipo})
                </span>
              )}
            </p>
            {pedido.cliente?.documento ? (
              <p className="text-xs font-mono" style={{ color: "var(--ac-muted)" }}>
                {formatarDocumento(
                  pedido.cliente.tipo_documento === "cpf" ? "cpf" : "cnpj",
                  pedido.cliente.documento,
                )}
                {pedido.cliente.cidade && pedido.cliente.estado
                  ? ` · ${pedido.cliente.cidade}/${pedido.cliente.estado}`
                  : ""}
              </p>
            ) : pedido.cliente?.cidade && pedido.cliente?.estado ? (
              <p className="text-xs" style={{ color: "var(--ac-muted)" }}>
                {pedido.cliente.cidade}/{pedido.cliente.estado}
              </p>
            ) : null}
            {pedido.cliente?.razao_social?.trim() ? (
              <p className="text-xs mt-1" style={{ color: "var(--ac-muted)" }}>
                Razão social:{" "}
                <span style={{ color: "var(--ac-text)" }}>{pedido.cliente.razao_social}</span>
              </p>
            ) : null}
            {pedido.cliente?.ie?.trim() ? (
              <p className="text-xs font-mono" style={{ color: "var(--ac-muted)" }}>
                IE: {pedido.cliente.ie}
              </p>
            ) : null}
            <p className="text-xs" style={{ color: "var(--ac-muted)" }}>
              Data da venda:{" "}
              {new Date(pedido.data_pedido + "T12:00:00").toLocaleDateString("pt-BR")}
            </p>
            {pedido.observacao && (
              <p className="text-xs mt-0.5 italic" style={{ color: "var(--ac-muted)" }}>
                {pedido.observacao}
              </p>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            <p
              className="text-xs uppercase tracking-wide font-semibold"
              style={{ color: "var(--ac-muted)" }}
            >
              Total
            </p>
            <p className="text-2xl font-bold" style={{ color: "var(--ac-accent)" }}>
              {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </div>
        </div>

        {/* Registro da venda (cadastro no sistema) */}
        <div
          className="rounded-xl px-4 py-3 flex flex-col gap-2 text-sm"
          style={{
            border: "1px solid var(--ac-border)",
            background: "color-mix(in srgb, var(--ac-bg) 88%, transparent)",
          }}
        >
          <p
            className="text-[11px] font-semibold uppercase tracking-wide"
            style={{ color: "var(--ac-muted)" }}
          >
            Cadastro no sistema
          </p>
          <DetailMeta label="Vendedor responsável" value={pedido.vendedor?.nome?.trim() || "—"} />
          <DetailMeta label="Registrado em" value={fmtDataHora(pedido.created_at)} />
          {pedido.natureza_operacao?.trim() ? (
            <DetailMeta label="Natureza da operação" value={pedido.natureza_operacao.trim()} />
          ) : null}
          {pedido.forma_pagamento ? (
            <DetailMeta
              label="Forma de pagamento"
              value={FORMAS_PAGAMENTO_OC[pedido.forma_pagamento].label}
            />
          ) : null}
        </div>

        {/* Contato e endereço do cliente */}
        {pedido.cliente && clienteTemContatoOuEndereco(pedido.cliente) && (
          <div
            className="rounded-xl px-4 py-3 flex flex-col gap-2 text-sm"
            style={{
              border: "1px solid var(--ac-border)",
              background: "color-mix(in srgb, var(--ac-bg) 88%, transparent)",
            }}
          >
            <p
              className="text-[11px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--ac-muted)" }}
            >
              Contato e endereço
            </p>
            {pedido.cliente.telefone?.trim() ? (
              <DetailMeta label="Telefone" value={pedido.cliente.telefone.trim()} />
            ) : null}
            {pedido.cliente.email?.trim() ? (
              <DetailMeta
                label="E-mail"
                value={
                  <a
                    href={`mailto:${pedido.cliente.email.trim()}`}
                    className="underline decoration-dotted"
                    style={{ color: "var(--ac-accent-strong, var(--ac-accent))" }}
                  >
                    {pedido.cliente.email.trim()}
                  </a>
                }
              />
            ) : null}
            {(() => {
              const t = textoEnderecoCliente(pedido.cliente);
              if (!t) return null;
              return (
                <DetailMeta
                  label="Endereço"
                  value={<span className="whitespace-pre-wrap">{t}</span>}
                />
              );
            })()}
          </div>
        )}

        {/* Tabela de itens */}
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
                  className="text-left px-4 py-2.5 font-semibold text-xs uppercase tracking-wide"
                  style={{ color: "var(--ac-muted)" }}
                >
                  Faca
                </th>
                <th
                  className="text-center px-3 py-2.5 font-semibold text-xs uppercase tracking-wide"
                  style={{ color: "var(--ac-muted)" }}
                >
                  Qtd
                </th>
                <th
                  className="text-right px-3 py-2.5 font-semibold text-xs uppercase tracking-wide"
                  style={{ color: "var(--ac-muted)" }}
                >
                  Preço
                </th>
                <th
                  className="text-right px-4 py-2.5 font-semibold text-xs uppercase tracking-wide"
                  style={{ color: "var(--ac-muted)" }}
                >
                  Subtotal
                </th>
              </tr>
            </thead>
            <tbody>
              {(!pedido.itens || pedido.itens.length === 0) && (
                <tr>
                  <td
                    colSpan={4}
                    className="text-center py-8 text-sm"
                    style={{ color: "var(--ac-muted)" }}
                  >
                    Nenhum item.
                  </td>
                </tr>
              )}
              {pedido.itens?.map((item, i) => (
                <tr
                  key={item.id}
                  style={{
                    borderTop: i > 0 ? "1px solid var(--ac-border)" : undefined,
                    background: "var(--ac-card)",
                  }}
                >
                  <td className="px-4 py-2.5" style={{ color: "var(--ac-text)" }}>
                    {(() => {
                      const thumbUrl = getOptimizedImageUrl(item.faca?.foto_url, {
                        width: 36,
                        height: 36,
                        quality: 60,
                        resize: "cover",
                        fallbackUrl: "",
                      });

                      return (
                        <div className="flex items-start gap-3 min-w-0">
                          {thumbUrl ? (
                            <img
                              src={thumbUrl}
                              alt={`Foto de ${item.faca?.nome ?? "faca"}`}
                              width={36}
                              height={36}
                              loading="lazy"
                              className="shrink-0"
                              style={{
                                borderRadius: 8,
                                objectFit: "cover",
                                border: "1px solid var(--ac-border)",
                              }}
                            />
                          ) : (
                            <div
                              aria-label={`Sem foto para ${item.faca?.nome ?? "faca"}`}
                              className="shrink-0"
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: 10,
                                background: "#facc15",
                                border: "1px solid var(--ac-border)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <img
                                src="/images/favicon-yellow.png"
                                alt="Sem foto"
                                width={18}
                                height={18}
                                style={{ objectFit: "contain" }}
                              />
                            </div>
                          )}

                          <div className="flex min-w-0 flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className="font-mono text-xs shrink-0"
                                style={{ color: "var(--ac-muted)" }}
                              >
                                {item.faca?.codigo}
                              </span>
                              <span className="text-sm">{item.faca?.nome ?? "—"}</span>
                            </div>
                            {item.ncm?.trim() || item.cfop?.trim() ? (
                              <div
                                className="text-[11px] font-mono"
                                style={{ color: "var(--ac-muted)" }}
                              >
                                {[
                                  item.ncm?.trim() ? `NCM ${item.ncm.trim()}` : null,
                                  item.cfop?.trim() ? `CFOP ${item.cfop.trim()}` : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td
                    className="px-3 py-2.5 text-center tabular-nums font-semibold"
                    style={{ color: "var(--ac-text)" }}
                  >
                    {item.quantidade}
                  </td>
                  <td
                    className="px-3 py-2.5 text-right tabular-nums"
                    style={{ color: "var(--ac-muted)" }}
                  >
                    {item.preco_unitario.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })}
                  </td>
                  <td
                    className="px-4 py-2.5 text-right tabular-nums font-semibold"
                    style={{ color: "var(--ac-text)" }}
                  >
                    {item.subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </td>
                </tr>
              ))}
            </tbody>
            {(frete > 0 || descontoTotal > 0) && (
              <tfoot>
                {frete > 0 && (
                  <tr style={{ borderTop: "1px solid var(--ac-border)" }}>
                    <td
                      colSpan={3}
                      className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--ac-muted)" }}
                    >
                      Frete
                    </td>
                    <td
                      className="px-4 py-2.5 text-right tabular-nums font-semibold"
                      style={{ color: "var(--ac-text)" }}
                    >
                      {frete.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>
                  </tr>
                )}
                {descontoTotal > 0 && (
                  <tr style={{ borderTop: frete > 0 ? undefined : "1px solid var(--ac-border)" }}>
                    <td
                      colSpan={3}
                      className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--ac-muted)" }}
                    >
                      Desconto no total
                    </td>
                    <td
                      className="px-4 py-2.5 text-right tabular-nums font-semibold"
                      style={{ color: "#b45309" }}
                    >
                      -
                      {descontoTotal.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                  </tr>
                )}
              </tfoot>
            )}
          </table>
        </div>

        {/* Erro */}
        {erro && (
          <p
            className="text-sm rounded-lg px-3 py-2"
            style={{ color: "#dc2626", background: "#fee2e2" }}
          >
            {erro}
          </p>
        )}

        {/* Botão Imprimir (dropdown) — reutilizado em ambos os modos */}
        {(() => {
          const pagoToggle =
            pedido.forma_pagamento && pedido.forma_pagamento !== "boleto" ? (
              perm.editar ? (
                <label
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-all cursor-pointer select-none"
                  style={{
                    background: pagoLocal ? "#dcfce7" : "transparent",
                    color: pagoLocal ? "#15803d" : "var(--ac-text)",
                    border: `1px solid ${pagoLocal ? "#bbf7d0" : "var(--ac-border)"}`,
                    fontWeight: 500,
                    opacity: loadingPago ? 0.6 : 1,
                    cursor: loadingPago ? "not-allowed" : "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={pagoLocal}
                    disabled={loadingPago}
                    onChange={(e) => void handleTogglePago(e.target.checked)}
                  />
                  <span>Pago</span>
                </label>
              ) : (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold"
                  style={{
                    color: pagoLocal ? "#15803d" : "#b45309",
                    background: pagoLocal ? "#dcfce7" : "#fef3c7",
                    border: `1px solid ${pagoLocal ? "#bbf7d0" : "#fde68a"}`,
                  }}
                >
                  {pagoLocal ? "Pago" : "Aguardando pagamento"}
                </span>
              )
            ) : null;

          const imprimirDropdown = (
            <div ref={imprimirRef} style={{ position: "relative" }}>
              <Button
                variant="secondary"
                onClick={() => setImprimirOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={imprimirOpen}
              >
                Imprimir ▾
              </Button>
              {imprimirOpen && (
                <div
                  role="menu"
                  className="rounded-md shadow-lg"
                  style={{
                    position: "absolute",
                    bottom: "calc(100% + 4px)",
                    left: 0,
                    minWidth: 200,
                    background: "var(--ac-card)",
                    border: "1px solid var(--ac-border)",
                    zIndex: 50,
                    overflow: "hidden",
                  }}
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={exportarVendaSemValor}
                    className="w-full text-left px-3 py-2 text-sm hover:opacity-80"
                    style={{ color: "var(--ac-text)", background: "transparent" }}
                  >
                    Venda sem valor
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={exportarPedido}
                    className="w-full text-left px-3 py-2 text-sm hover:opacity-80"
                    style={{
                      color: "var(--ac-text)",
                      background: "transparent",
                      borderTop: "1px solid var(--ac-border)",
                    }}
                  >
                    Imprimir pedido
                  </button>
                </div>
              )}
            </div>
          );

          if (perm.editar) {
            return (
              <div
                className="flex items-center justify-between gap-2 pt-1 flex-wrap"
                style={{ borderTop: "1px solid var(--ac-border)" }}
              >
                <div className="flex gap-3 items-center">
                  {imprimirDropdown}
                  {pagoToggle}
                </div>

                <div className="flex gap-2 items-center">
                  <label className="text-xs font-semibold" style={{ color: "var(--ac-muted)" }}>
                    Status
                  </label>
                  <select
                    value={pedido.status}
                    disabled={loadingStatus}
                    onChange={(e) => void handleAlterarStatus(e.target.value as StatusPedido)}
                    className="text-sm rounded px-2 py-1.5"
                    style={{
                      border: "1px solid var(--ac-border)",
                      background: "var(--ac-card)",
                      color: "var(--ac-text)",
                      minWidth: 180,
                    }}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_PEDIDO[s].label}
                      </option>
                    ))}
                  </select>
                  <Button variant="secondary" onClick={onClose} disabled={loadingStatus}>
                    Fechar
                  </Button>
                </div>
              </div>
            );
          }

          return (
            <div
              className="flex items-center justify-between gap-2 pt-1 flex-wrap"
              style={{ borderTop: "1px solid var(--ac-border)" }}
            >
              <div className="flex gap-3 items-center">
                {imprimirDropdown}
                {pagoToggle}
              </div>
              <Button variant="secondary" onClick={onClose}>
                Fechar
              </Button>
            </div>
          );
        })()}
      </div>
    </Modal>
  );
}
