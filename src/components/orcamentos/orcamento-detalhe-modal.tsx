"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { STATUS_PEDIDO } from "@/types";
import type { Orcamento, StatusPedido } from "@/types";
import { getOptimizedImageUrl } from "@/lib/images";
import { formatarDocumento } from "@/lib/br/documento";
import {
  transformarOrcamentoEmVenda,
  deletarOrcamento,
  getOrcamentoDetalhe,
} from "@/lib/actions/orcamentos";
import { gerarPdfOrcamento } from "./orcamento-pdf";

type Props = {
  orcamento: Orcamento | null;
  /** Detalhe completo ainda sendo buscado no servidor — mostra skeleton no corpo do modal. */
  carregando?: boolean;
  /** Erro ao buscar detalhe completo (dados parciais da lista podem permanecer visíveis). */
  erroCarregar?: string | null;
  onClose: () => void;
  onEditar?: (o: Orcamento) => void;
  onConvertido?: (o: Orcamento, pedidoId: string) => void;
  onDeletado?: (id: string) => void;
  perm: { editar: boolean; deletar: boolean; converterEmVenda: boolean };
};

function descontoUnitarioLinha(
  precoVenda: number | null | undefined,
  precoLiquido: number,
): { catalogo: number; desconto: number; pct: number } | null {
  if (precoVenda == null || Number.isNaN(precoVenda)) return null;
  const cat = Math.round(precoVenda * 100) / 100;
  const liq = Math.round(precoLiquido * 100) / 100;
  if (cat - liq <= 0.009) return null;
  const desconto = Math.round((cat - liq) * 100) / 100;
  const pct = cat > 0 ? parseFloat(((desconto / cat) * 100).toFixed(2)) : 0;
  return { catalogo: cat, desconto, pct };
}

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-md animate-pulse ${className ?? ""}`}
      style={{ background: "color-mix(in srgb, var(--ac-border) 60%, transparent)" }}
      aria-hidden
    />
  );
}

const STATUS_DISPONIVEIS: Extract<StatusPedido, "em_espera" | "em_producao">[] = [
  "em_espera",
  "em_producao",
];

export function OrcamentoDetalheModal({
  orcamento,
  carregando = false,
  erroCarregar = null,
  onClose,
  onEditar,
  onConvertido,
  onDeletado,
  perm,
}: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [erro, setErro] = useState("");
  const [confirmandoConversao, setConfirmandoConversao] = useState(false);
  const [statusEscolhido, setStatusEscolhido] =
    useState<Extract<StatusPedido, "em_espera" | "em_producao">>("em_espera");
  const [confirmandoDelete, setConfirmandoDelete] = useState(false);

  useEffect(() => {
    if (!orcamento?.id) return;
    setConfirmandoConversao(false);
    setConfirmandoDelete(false);
    setErro("");
    setLoading(null);
  }, [orcamento?.id]);

  if (!orcamento) return null;

  if (carregando) {
    return (
      <Modal open onClose={onClose} title={`Orçamento ${orcamento.codigo}`} width="640px">
        <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-1 flex-col gap-2.5 min-w-0">
              <SkeletonBar className="h-4 w-[55%]" />
              <SkeletonBar className="h-3 w-[40%]" />
              <SkeletonBar className="h-3 w-[35%]" />
              <SkeletonBar className="h-3 w-[28%]" />
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <SkeletonBar className="h-3 w-16" />
              <SkeletonBar className="h-9 w-28" />
            </div>
          </div>
          <div
            className="rounded-xl overflow-hidden p-4 flex flex-col gap-3"
            style={{ border: "1px solid var(--ac-border)" }}
          >
            <SkeletonBar className="h-3 w-full max-w-[90%]" />
            {[0, 1, 2, 3].map((k) => (
              <div key={k} className="flex items-center gap-3 pt-1">
                <SkeletonBar className="size-9 shrink-0 rounded-lg" />
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                  <SkeletonBar className="h-3 w-[45%]" />
                  <SkeletonBar className="h-3 w-[70%]" />
                </div>
                <SkeletonBar className="h-3 w-10 shrink-0" />
                <SkeletonBar className="h-3 w-16 shrink-0" />
                <SkeletonBar className="h-3 w-16 shrink-0" />
              </div>
            ))}
          </div>
          <p className="text-xs text-center" style={{ color: "var(--ac-muted)" }}>
            Carregando itens e fotos…
          </p>
          <div
            className="flex justify-end pt-1"
            style={{ borderTop: "1px solid var(--ac-border)" }}
          >
            <Button variant="secondary" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  const subtotalItens = orcamento.itens?.reduce((s, i) => s + i.subtotal, 0) ?? 0;
  const frete = orcamento.frete ?? 0;
  const descontoTotal = orcamento.desconto_total ?? 0;
  const total = orcamento.valor_total ?? Math.max(0, subtotalItens + frete - descontoTotal);
  const jaConvertido = !!orcamento.convertido_pedido_id;

  async function exportarPdf() {
    if (!orcamento) return;
    setErro("");
    setLoading("pdf");
    try {
      const detalhe = await getOrcamentoDetalhe(orcamento.id);
      await gerarPdfOrcamento(detalhe);
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao gerar PDF.");
    } finally {
      setLoading(null);
    }
  }

  async function confirmarConversao() {
    if (!orcamento) return;
    setErro("");
    setLoading("converter");
    try {
      const res = await transformarOrcamentoEmVenda(orcamento.id, statusEscolhido);
      onConvertido?.(orcamento, res.pedido_id);
      onClose();
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao converter.");
    } finally {
      setLoading(null);
      setConfirmandoConversao(false);
    }
  }

  async function confirmarDelete() {
    if (!orcamento) return;
    setErro("");
    setLoading("delete");
    try {
      await deletarOrcamento(orcamento.id);
      onDeletado?.(orcamento.id);
      onClose();
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao excluir.");
    } finally {
      setLoading(null);
      setConfirmandoDelete(false);
    }
  }

  const statusPedidoConvertido = orcamento.pedido_convertido?.status
    ? STATUS_PEDIDO[orcamento.pedido_convertido.status]
    : null;

  return (
    <Modal
      open={!!orcamento}
      onClose={onClose}
      title={`Orçamento ${orcamento.codigo}`}
      width="640px"
    >
      <div className="flex flex-col gap-5">
        {erroCarregar && (
          <p
            className="text-sm rounded-lg px-3 py-2"
            style={{ color: "#b45309", background: "#fef3c7", border: "1px solid #fde68a" }}
          >
            {erroCarregar}
          </p>
        )}
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            {jaConvertido && (
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-semibold"
                  style={{ color: "#6b21a8", background: "#f3e8ff", border: "1px solid #e9d5ff" }}
                >
                  Convertido em venda
                </span>
                {orcamento.pedido_convertido?.codigo && (
                  <span className="text-xs" style={{ color: "var(--ac-muted)" }}>
                    Pedido{" "}
                    <strong style={{ color: "var(--ac-text)" }}>
                      {orcamento.pedido_convertido.codigo}
                    </strong>
                    {statusPedidoConvertido && (
                      <span
                        className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold"
                        style={{
                          color: statusPedidoConvertido.color,
                          background: statusPedidoConvertido.bg,
                          border: `1px solid ${statusPedidoConvertido.border}`,
                        }}
                      >
                        {statusPedidoConvertido.label}
                      </span>
                    )}
                  </span>
                )}
              </div>
            )}
            <p className="text-sm" style={{ color: "var(--ac-muted)" }}>
              <strong style={{ color: "var(--ac-text)" }}>
                {orcamento.cliente?.nome ?? "Sem cliente"}
              </strong>
              {orcamento.cliente?.tipo && (
                <span className="ml-2 text-xs" style={{ color: "var(--ac-muted)" }}>
                  ({orcamento.cliente.tipo})
                </span>
              )}
            </p>
            {orcamento.cliente?.documento ? (
              <p className="text-xs font-mono" style={{ color: "var(--ac-muted)" }}>
                {formatarDocumento(
                  orcamento.cliente.tipo_documento === "cpf" ? "cpf" : "cnpj",
                  orcamento.cliente.documento,
                )}
                {orcamento.cliente.cidade && orcamento.cliente.estado
                  ? ` · ${orcamento.cliente.cidade}/${orcamento.cliente.estado}`
                  : ""}
              </p>
            ) : orcamento.cliente?.cidade && orcamento.cliente?.estado ? (
              <p className="text-xs" style={{ color: "var(--ac-muted)" }}>
                {orcamento.cliente.cidade}/{orcamento.cliente.estado}
              </p>
            ) : null}
            <p className="text-xs" style={{ color: "var(--ac-muted)" }}>
              Data: {new Date(orcamento.data_orcamento + "T12:00:00").toLocaleDateString("pt-BR")}
            </p>
            {orcamento.vendedor?.nome && (
              <p className="text-xs" style={{ color: "var(--ac-muted)" }}>
                Vendedor:{" "}
                <strong style={{ color: "var(--ac-text)" }}>{orcamento.vendedor.nome}</strong>
              </p>
            )}
            {orcamento.observacao && (
              <p className="text-xs mt-0.5 italic" style={{ color: "var(--ac-muted)" }}>
                {orcamento.observacao}
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

        {/* Itens */}
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
                  Preço unit.
                </th>
                <th
                  className="text-right px-3 py-2.5 font-semibold text-xs uppercase tracking-wide"
                  style={{ color: "var(--ac-muted)" }}
                >
                  Desc. unit.
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
              {(!orcamento.itens || orcamento.itens.length === 0) && (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-8 text-sm"
                    style={{ color: "var(--ac-muted)" }}
                  >
                    Nenhum item.
                  </td>
                </tr>
              )}
              {orcamento.itens?.map((item, i) => {
                const thumbUrl = getOptimizedImageUrl(item.faca?.foto_url, {
                  width: 36,
                  height: 36,
                  quality: 60,
                  resize: "cover",
                  fallbackUrl: "",
                });
                const linhaDesc = descontoUnitarioLinha(
                  item.faca?.preco_venda,
                  item.preco_unitario,
                );
                return (
                  <tr
                    key={item.id}
                    style={{
                      borderTop: i > 0 ? "1px solid var(--ac-border)" : undefined,
                      background: "var(--ac-card)",
                    }}
                  >
                    <td className="px-4 py-2.5" style={{ color: "var(--ac-text)" }}>
                      <div className="flex items-center gap-3">
                        {thumbUrl ? (
                          <img
                            src={thumbUrl}
                            alt={`Foto de ${item.faca?.nome ?? "faca"}`}
                            width={36}
                            height={36}
                            loading="lazy"
                            style={{
                              borderRadius: 8,
                              objectFit: "cover",
                              border: "1px solid var(--ac-border)",
                            }}
                          />
                        ) : (
                          <div
                            aria-label={`Sem foto para ${item.faca?.nome ?? "faca"}`}
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
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs" style={{ color: "var(--ac-muted)" }}>
                            {item.faca?.codigo}
                          </span>
                          <span className="text-sm">{item.faca?.nome ?? "—"}</span>
                        </div>
                      </div>
                    </td>
                    <td
                      className="px-3 py-2.5 text-center tabular-nums font-semibold"
                      style={{ color: "var(--ac-text)" }}
                    >
                      {item.quantidade}
                    </td>
                    <td
                      className="px-3 py-2.5 text-right tabular-nums align-top"
                      style={{ color: "var(--ac-text)" }}
                    >
                      {linhaDesc ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span
                            className="text-xs line-through"
                            style={{ color: "var(--ac-muted)" }}
                          >
                            {linhaDesc.catalogo.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </span>
                          <span className="font-medium">
                            {item.preco_unitario.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: "var(--ac-muted)" }}>
                          {item.preco_unitario.toLocaleString("pt-BR", {
                            style: "currency",
                            currency: "BRL",
                          })}
                        </span>
                      )}
                    </td>
                    <td
                      className="px-3 py-2.5 text-right tabular-nums align-top"
                      style={{ color: "var(--ac-muted)" }}
                    >
                      {linhaDesc ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-sm font-medium" style={{ color: "#b45309" }}>
                            -
                            {linhaDesc.desconto.toLocaleString("pt-BR", {
                              style: "currency",
                              currency: "BRL",
                            })}
                          </span>
                          <span className="text-xs">-{linhaDesc.pct}%</span>
                        </div>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                    <td
                      className="px-4 py-2.5 text-right tabular-nums font-semibold"
                      style={{ color: "var(--ac-text)" }}
                    >
                      {item.subtotal.toLocaleString("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {(frete > 0 || descontoTotal > 0) && (
              <tfoot>
                {frete > 0 && (
                  <tr style={{ borderTop: "1px solid var(--ac-border)" }}>
                    <td
                      colSpan={4}
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
                      colSpan={4}
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

        {erro && (
          <p
            className="text-sm rounded-lg px-3 py-2"
            style={{ color: "#dc2626", background: "#fee2e2" }}
          >
            {erro}
          </p>
        )}

        {/* Confirmação de conversão em venda */}
        {confirmandoConversao && (
          <div
            className="rounded-xl p-4 flex flex-col gap-3"
            style={{
              background: "color-mix(in srgb, var(--ac-accent) 8%, transparent)",
              border: "1px solid var(--ac-border)",
            }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: "var(--ac-text)" }}>
                Transformar em venda
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--ac-muted)" }}>
                Será criado um novo pedido com base neste orçamento. O estoque das facas envolvidas
                será reservado conforme a regra normal de vendas.
              </p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label
                className="text-xs font-semibold uppercase tracking-wide"
                style={{ color: "var(--ac-muted)" }}
              >
                Status inicial do pedido
              </label>
              <div className="flex gap-2 flex-wrap">
                {STATUS_DISPONIVEIS.map((s) => {
                  const meta = STATUS_PEDIDO[s];
                  const ativo = statusEscolhido === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatusEscolhido(s)}
                      className="px-3 py-1.5 rounded-lg text-sm font-semibold transition-all"
                      style={{
                        color: ativo ? "#fff" : meta.color,
                        background: ativo ? meta.color : meta.bg,
                        border: `1px solid ${ativo ? meta.color : meta.border}`,
                      }}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setConfirmandoConversao(false)}
                disabled={loading === "converter"}
              >
                Cancelar
              </Button>
              <Button loading={loading === "converter"} onClick={confirmarConversao}>
                Confirmar conversão
              </Button>
            </div>
          </div>
        )}

        {/* Confirmação de exclusão */}
        {confirmandoDelete && (
          <div
            className="rounded-xl p-4 flex items-center justify-between gap-3"
            style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
          >
            <div>
              <p className="text-sm font-semibold" style={{ color: "#991b1b" }}>
                Excluir orçamento {orcamento.codigo}?
              </p>
              <p className="text-xs mt-0.5" style={{ color: "#b91c1c" }}>
                Esta ação não pode ser desfeita.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                variant="secondary"
                onClick={() => setConfirmandoDelete(false)}
                disabled={loading === "delete"}
              >
                Cancelar
              </Button>
              <Button
                loading={loading === "delete"}
                onClick={confirmarDelete}
                style={{ background: "#dc2626", color: "#fff", border: "none" }}
              >
                Excluir
              </Button>
            </div>
          </div>
        )}

        {/* Ações */}
        {!confirmandoConversao && !confirmandoDelete && (
          <div
            className="flex items-center justify-between gap-2 pt-1 flex-wrap"
            style={{ borderTop: "1px solid var(--ac-border)" }}
          >
            <div className="flex gap-2">
              {perm.deletar && !jaConvertido && (
                <Button
                  variant="secondary"
                  onClick={() => setConfirmandoDelete(true)}
                  style={{
                    background: "transparent",
                    color: "#dc2626",
                    border: "1px solid #fecaca",
                    fontWeight: 500,
                  }}
                >
                  Excluir
                </Button>
              )}
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <Button variant="secondary" onClick={onClose}>
                Fechar
              </Button>
              <Button variant="secondary" onClick={exportarPdf} loading={loading === "pdf"}>
                Exportar PDF
              </Button>
              {perm.editar && !jaConvertido && (
                <Button variant="secondary" onClick={() => onEditar?.(orcamento)}>
                  Editar
                </Button>
              )}
              {perm.converterEmVenda && !jaConvertido && (
                <Button
                  onClick={() => setConfirmandoConversao(true)}
                  style={{ background: "#7e22ce", color: "#fff", border: "none" }}
                >
                  Transformar em venda
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
