"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { criarMateriasPrimasEmLote } from "@/lib/actions/materias-primas";
import { salvarMPComFoto } from "@/lib/actions/materias-primas-upload";
import { getOptimizedImageUrl } from "@/lib/images";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import type { CategoriaMateriaPrimaDB, Fornecedor, MateriaPrima } from "@/types";

type Props = {
  open: boolean;
  onClose: () => void;
  fornecedores: Fornecedor[];
  categoriasMateriaPrima: CategoriaMateriaPrimaDB[];
  loadingReferencias?: boolean;
  editando?: MateriaPrima | null;
  onSaved?: () => void;
};

type Form = {
  sku: string;
  nome: string;
  categoria: string;
  fornecedor_id: string;
  preco_custo: string;
  estoque_atual: string;
  estoque_minimo: string;
};

type BulkMode = "single" | "bulk";

type BulkRow = {
  id: string;
  sku: string;
  nome: string;
  categoria: string;
  fornecedor: string;
  preco_custo: string;
  estoque_atual: string;
  estoque_minimo: string;
};

type BulkField = Exclude<keyof BulkRow, "id">;

const BULK_COLUMNS: BulkField[] = [
  "sku",
  "nome",
  "categoria",
  "fornecedor",
  "preco_custo",
  "estoque_atual",
  "estoque_minimo",
];

const BULK_ROWS_STEP = 5;

const formVazio: Form = {
  sku: "",
  nome: "",
  categoria: "",
  fornecedor_id: "",
  preco_custo: "",
  estoque_atual: "0",
  estoque_minimo: "0",
};

function getInitialForm(
  editando: MateriaPrima | null | undefined,
  categoriasMateriaPrima: CategoriaMateriaPrimaDB[],
): Form {
  if (editando) {
    return {
      sku: editando.sku,
      nome: editando.nome,
      categoria: editando.categoria,
      fornecedor_id: editando.fornecedor_id ?? "",
      preco_custo: String(editando.preco_custo),
      estoque_atual: String(editando.estoque_atual),
      estoque_minimo: String(editando.estoque_minimo),
    };
  }

  return {
    ...formVazio,
    categoria: categoriasMateriaPrima[0]?.nome ?? "Bainha",
  };
}

function createBulkRow(): BulkRow {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sku: "",
    nome: "",
    categoria: "",
    fornecedor: "",
    preco_custo: "",
    estoque_atual: "",
    estoque_minimo: "",
  };
}

function createBulkRows(count = BULK_ROWS_STEP): BulkRow[] {
  return Array.from({ length: count }, () => createBulkRow());
}

function parseDecimal(value: string): number {
  const normalized = sanitizeNumericValue(value).replace(",", ".");
  return normalized ? Number(normalized) : NaN;
}

function isNumericBulkField(
  field: BulkField,
): field is "preco_custo" | "estoque_atual" | "estoque_minimo" {
  return field === "preco_custo" || field === "estoque_atual" || field === "estoque_minimo";
}

function sanitizeNumericValue(value: string): string {
  const cleaned = value.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return "";

  const signal = cleaned.startsWith("-") ? "-" : "";
  const unsigned = cleaned.replace(/-/g, "");
  const lastComma = unsigned.lastIndexOf(",");
  const lastDot = unsigned.lastIndexOf(".");
  const decimalIndex = Math.max(lastComma, lastDot);

  if (decimalIndex === -1) {
    const digits = unsigned.replace(/[^\d]/g, "");
    return digits ? `${signal}${digits}` : "";
  }

  const integerPart = unsigned.slice(0, decimalIndex).replace(/[^\d]/g, "");
  const decimalPart = unsigned.slice(decimalIndex + 1).replace(/[^\d]/g, "");
  if (!integerPart && !decimalPart) return "";
  if (!decimalPart) return `${signal}${integerPart}`;
  return `${signal}${integerPart || "0"},${decimalPart}`;
}

function normalizeBulkCellValue(field: BulkField, value: string): string {
  return isNumericBulkField(field) ? sanitizeNumericValue(value) : value.trim();
}

function isSpreadsheetPaste(text: string): boolean {
  return text.includes("\t") || text.includes("\n");
}

function isBulkRowEmpty(row: BulkRow): boolean {
  return [
    row.nome,
    row.categoria,
    row.fornecedor,
    row.preco_custo,
    row.estoque_atual,
    row.estoque_minimo,
    row.sku,
  ].every((value) => !value.trim());
}

export function MPModal({
  open,
  onClose,
  fornecedores,
  categoriasMateriaPrima,
  loadingReferencias = false,
  editando,
  onSaved,
}: Props) {
  const [form, setForm] = useState<Form>(() => getInitialForm(editando, categoriasMateriaPrima));
  const [modo, setModo] = useState<BulkMode>("single");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>(() => createBulkRows());
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string>("");
  const [fotoDragActive, setFotoDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fotoLightboxOpen, setFotoLightboxOpen] = useState(false);
  const [fotoLightboxSrc, setFotoLightboxSrc] = useState<string>("");

  const fotoPreviewAtual = editando?.foto_url
    ? getOptimizedImageUrl(editando.foto_url, {
        width: 120,
        height: 120,
        quality: 70,
        resize: "cover",
        fallbackUrl: "",
      })
    : "";

  useEffect(() => {
    return () => {
      if (fotoPreview) URL.revokeObjectURL(fotoPreview);
    };
  }, [fotoPreview]);

  function setFotoFromFile(file: File | null) {
    setFotoFile(file);
    if (file) setFotoPreview(URL.createObjectURL(file));
    else setFotoPreview("");
  }

  function openFotoLightbox(src: string) {
    setFotoLightboxSrc(src);
    setFotoLightboxOpen(true);
  }

  function closeFotoLightbox() {
    setFotoLightboxOpen(false);
    setFotoLightboxSrc("");
  }

  function set(field: keyof Form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function setBulkCell(rowId: string, field: BulkField, value: string) {
    const normalizedValue = normalizeBulkCellValue(field, value);
    setBulkRows((rows) =>
      rows.map((row) => (row.id === rowId ? { ...row, [field]: normalizedValue } : row)),
    );
  }

  function addBulkRows(count = BULK_ROWS_STEP) {
    setBulkRows((rows) => [...rows, ...createBulkRows(count)]);
  }

  function applyBulkPaste(startRowIndex: number, startColumnIndex: number, text: string): boolean {
    if (!isSpreadsheetPaste(text)) return false;

    const rowsFromClipboard = text
      .replace(/\r/g, "")
      .split("\n")
      .filter((row, index, list) => !(index === list.length - 1 && row === ""));

    if (rowsFromClipboard.length === 0) return false;

    setBulkRows((currentRows) => {
      const nextRows = [...currentRows];
      while (nextRows.length < startRowIndex + rowsFromClipboard.length) {
        nextRows.push(createBulkRow());
      }

      rowsFromClipboard.forEach((rowText, rowOffset) => {
        const values = rowText.split("\t");
        values.forEach((value, colOffset) => {
          const field = BULK_COLUMNS[startColumnIndex + colOffset];
          if (!field) return;
          const rowIndex = startRowIndex + rowOffset;
          nextRows[rowIndex] = {
            ...nextRows[rowIndex],
            [field]: normalizeBulkCellValue(field, value),
          };
        });
      });

      return nextRows;
    });

    return true;
  }

  function validateBulkRows() {
    const errors: string[] = [];
    const categoriasValidas = new Set(
      categoriasMateriaPrima.map((categoria) => categoria.nome.trim().toLowerCase()),
    );
    const fornecedoresPorNome = new Map(
      fornecedores.map((fornecedor) => [fornecedor.nome.trim().toLowerCase(), fornecedor.id]),
    );

    const items = bulkRows.flatMap((row, index) => {
      if (isBulkRowEmpty(row)) return [];

      const linha = index + 1;
      const sku = row.sku.trim();
      const nome = row.nome.trim();
      const categoria = row.categoria.trim();
      const fornecedor = row.fornecedor.trim();
      const precoText = row.preco_custo.trim();
      const estoqueAtualText = row.estoque_atual.trim();
      const estoqueMinimoText = row.estoque_minimo.trim();

      const missing: string[] = [];
      if (!sku) missing.push("sku");
      if (!nome) missing.push("nome");
      if (!categoria) missing.push("categoria");
      if (!precoText) missing.push("preço de custo");
      if (missing.length > 0) {
        errors.push(`Linha ${linha}: preencha ${missing.join(", ")}.`);
        return [];
      }

      if (!categoriasValidas.has(categoria.toLowerCase())) {
        errors.push(`Linha ${linha}: selecione uma categoria válida.`);
        return [];
      }

      const preco = parseDecimal(precoText);
      if (!Number.isFinite(preco)) {
        errors.push(`Linha ${linha}: preço de custo inválido.`);
        return [];
      }

      const estoqueAtual = estoqueAtualText ? parseDecimal(estoqueAtualText) : 0;
      if (estoqueAtualText && !Number.isFinite(estoqueAtual)) {
        errors.push(`Linha ${linha}: estoque atual inválido.`);
        return [];
      }

      const estoqueMinimo = estoqueMinimoText ? parseDecimal(estoqueMinimoText) : 0;
      if (estoqueMinimoText && !Number.isFinite(estoqueMinimo)) {
        errors.push(`Linha ${linha}: estoque mínimo inválido.`);
        return [];
      }

      const fornecedorId = fornecedor
        ? (fornecedoresPorNome.get(fornecedor.toLowerCase()) ?? null)
        : null;

      if (fornecedor && !fornecedorId) {
        errors.push(`Linha ${linha}: informe um fornecedor válido.`);
        return [];
      }

      return [
        {
          nome,
          sku,
          categoria,
          fornecedor_id: fornecedorId,
          preco_custo: preco,
          estoque_atual: estoqueAtual,
          estoque_minimo: estoqueMinimo,
        },
      ];
    });

    if (items.length === 0 && errors.length === 0) {
      errors.push("Preencha ao menos uma linha válida para criar em massa.");
    }

    const skuCategoriaKeys = items.map(
      (item) => `${item.categoria.trim().toLowerCase()}::${item.sku.trim().toLowerCase()}`,
    );
    if (new Set(skuCategoriaKeys).size !== skuCategoriaKeys.length) {
      errors.push("Existem linhas com SKU duplicado dentro da mesma categoria.");
    }

    return { items, errors };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (editando || modo === "single") {
      const categoriaSelecionada =
        form.categoria.trim() || categoriasMateriaPrima[0]?.nome?.trim() || "";

      if (!form.nome.trim()) {
        setErro("Nome é obrigatório.");
        return;
      }
      if (!form.sku.trim()) {
        setErro("SKU é obrigatório.");
        return;
      }
      if (!categoriaSelecionada) {
        setErro("Categoria é obrigatória.");
        return;
      }
      if (!form.preco_custo || Number.isNaN(Number(form.preco_custo))) {
        setErro("Preço de custo inválido.");
        return;
      }

      setLoading(true);
      try {
        const fd = new FormData();
        if (editando?.id) fd.append("id", editando.id);
        fd.append("sku", form.sku);
        fd.append("nome", form.nome);
        fd.append("categoria", categoriaSelecionada);
        fd.append("fornecedor_id", form.fornecedor_id);
        fd.append("preco_custo", String(parseFloat(form.preco_custo)));
        fd.append("estoque_atual", String(parseFloat(form.estoque_atual) || 0));
        fd.append("estoque_minimo", String(parseFloat(form.estoque_minimo) || 0));
        if (fotoFile) fd.append("foto", fotoFile, fotoFile.name);

        await salvarMPComFoto(fd);
        onClose();
        onSaved?.();
      } catch (submitError: unknown) {
        setErro(submitError instanceof Error ? submitError.message : "Erro ao salvar.");
      } finally {
        setLoading(false);
      }
      return;
    }

    const { items, errors } = validateBulkRows();
    if (errors.length > 0) {
      setErro(errors.join("\n"));
      return;
    }

    setLoading(true);
    try {
      await criarMateriasPrimasEmLote(items);
      onClose();
      onSaved?.();
    } catch (submitError: unknown) {
      setErro(submitError instanceof Error ? submitError.message : "Erro ao criar em massa.");
    } finally {
      setLoading(false);
    }
  }

  const cellInputStyle = {
    width: "100%",
    minWidth: 120,
    borderRadius: 10,
    border: "1px solid var(--ac-border)",
    background: "var(--ac-card)",
    color: "var(--ac-text)",
    padding: "10px 12px",
    fontSize: 13,
    outline: "none",
  } as const;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? `Editar — ${editando.codigo}` : "Nova Matéria-Prima"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {loadingReferencias && (
          <p className="text-sm" style={{ color: "var(--ac-muted)" }}>
            Carregando fornecedores e categorias…
          </p>
        )}

        {!editando && (
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium" style={{ color: "var(--ac-text)" }}>
              Tipo de adição
            </span>
            <div
              className="inline-flex w-fit gap-1 rounded-xl p-1"
              style={{
                background: "var(--ac-bg)",
                border: "1px solid var(--ac-border)",
              }}
            >
              {[
                { key: "single" as const, label: "Adição única" },
                { key: "bulk" as const, label: "Adição em massa" },
              ].map((option) => {
                const active = modo === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      setModo(option.key);
                      setErro("");
                    }}
                    className="rounded-lg px-3 py-2 text-sm font-medium transition-all"
                    style={{
                      background: active ? "var(--ac-card)" : "transparent",
                      color: active ? "var(--ac-text)" : "var(--ac-muted)",
                      boxShadow: active ? "0 1px 3px rgba(0,0,0,.08)" : undefined,
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(editando || modo === "single") && (
          <>
            <Input
              id="sku"
              label="SKU *"
              disabled={loadingReferencias}
              placeholder="Ex: MP-0001"
              value={form.sku}
              onChange={(e) => set("sku", e.target.value)}
            />
            <Input
              id="nome"
              label="Nome *"
              disabled={loadingReferencias}
              placeholder="Ex: Lâmina Aço Inox 420"
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
            />

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="categoria"
                  className="text-sm font-medium"
                  style={{ color: "var(--ac-text)" }}
                >
                  Categoria *
                </label>
                <Link
                  href="/configuracoes#categorias-materia-prima"
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
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  Gerenciar categorias
                </Link>
              </div>
              <Select
                id="categoria"
                value={form.categoria || categoriasMateriaPrima[0]?.nome || ""}
                onChange={(e) => set("categoria", e.target.value)}
              >
                {categoriasMateriaPrima.map((cat) => (
                  <option key={cat.id} value={cat.nome}>
                    {cat.nome}
                  </option>
                ))}
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="fornecedor"
                  className="text-sm font-medium"
                  style={{ color: "var(--ac-text)" }}
                >
                  Fornecedor
                </label>
                <Link
                  href="/fornecedores"
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
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  Gerenciar fornecedores
                </Link>
              </div>
              <Select
                id="fornecedor"
                value={form.fornecedor_id}
                onChange={(e) => set("fornecedor_id", e.target.value)}
              >
                <option value="">— Sem fornecedor —</option>
                {fornecedores.map((fornecedor) => (
                  <option key={fornecedor.id} value={fornecedor.id}>
                    {fornecedor.nome}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Input
                id="preco_custo"
                label="Preço de Custo (R$) *"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                value={form.preco_custo}
                onChange={(e) => set("preco_custo", e.target.value)}
              />
              <Input
                id="estoque_atual"
                label="Estoque Atual"
                type="number"
                min="0"
                step="0.001"
                value={form.estoque_atual}
                onChange={(e) => set("estoque_atual", e.target.value)}
              />
              <Input
                id="estoque_minimo"
                label="Estoque Mínimo"
                type="number"
                min="0"
                step="0.001"
                value={form.estoque_minimo}
                onChange={(e) => set("estoque_minimo", e.target.value)}
              />
            </div>

            <div className="flex items-start gap-3">
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 12,
                  border: "1px solid var(--ac-border)",
                  background:
                    fotoPreview || fotoPreviewAtual
                      ? "transparent"
                      : "linear-gradient(135deg, rgba(250, 204, 21, 0.18), rgba(250, 204, 21, 0.06))",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {(() => {
                  const src = fotoPreview || fotoPreviewAtual;
                  if (src) {
                    return (
                      <button
                        type="button"
                        onClick={() => openFotoLightbox(src)}
                        style={{
                          width: "100%",
                          height: "100%",
                          border: "none",
                          padding: 0,
                          borderRadius: 12,
                          background: "transparent",
                          cursor: "zoom-in",
                        }}
                        aria-label="Expandir foto da matéria-prima"
                      >
                        <img
                          src={src}
                          alt="Foto da matéria-prima"
                          width={64}
                          height={64}
                          style={{ objectFit: "cover", borderRadius: 12 }}
                        />
                      </button>
                    );
                  }

                  return (
                    <img
                      src="/images/favicon-yellow.png"
                      alt="Sem foto"
                      width={28}
                      height={28}
                      style={{ objectFit: "contain" }}
                    />
                  );
                })()}
              </div>

              <div className="flex flex-col gap-1.5" style={{ flex: 1 }}>
                <label className="text-sm font-medium" style={{ color: "var(--ac-text)" }}>
                  Foto (opcional)
                </label>

                <div
                  role="button"
                  tabIndex={0}
                  aria-label="Arraste e solte uma imagem ou clique para selecionar"
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                  }}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setFotoDragActive(true);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setFotoDragActive(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setFotoDragActive(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setFotoDragActive(false);
                    const file = e.dataTransfer.files?.[0] ?? null;
                    setFotoFromFile(file);
                  }}
                  style={{
                    borderRadius: 14,
                    border: `2px dashed ${fotoDragActive ? "var(--ac-accent)" : "var(--ac-border)"}`,
                    background: fotoDragActive
                      ? "color-mix(in srgb, var(--ac-accent) 14%, transparent)"
                      : "var(--ac-card)",
                    padding: "14px 12px",
                    cursor: "pointer",
                    transition:
                      "transform 150ms ease, border-color 150ms ease, background 150ms ease, box-shadow 150ms ease",
                    transform: fotoDragActive ? "scale(1.01)" : "scale(1)",
                    boxShadow: fotoDragActive
                      ? "0 0 0 3px color-mix(in srgb, var(--ac-accent) 18%, transparent)"
                      : "none",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    gap: 8,
                    userSelect: "none",
                  }}
                  className="hover:scale-[1.01]"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setFotoFromFile(file);
                    }}
                  />

                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.8}
                    className="size-5"
                    style={{ color: fotoDragActive ? "var(--ac-accent)" : "var(--ac-muted)" }}
                  >
                    <path d="M12 16V4" strokeLinecap="round" />
                    <path d="M7 9l5-5 5 5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M20 16v4H4v-4" strokeLinecap="round" />
                  </svg>

                  <div className="text-sm font-semibold" style={{ color: "var(--ac-text)" }}>
                    {fotoDragActive
                      ? "Solte a imagem aqui"
                      : "Arraste uma imagem aqui ou clique para selecionar"}
                  </div>

                  <div className="text-xs" style={{ color: "var(--ac-muted)" }}>
                    PNG, JPG ou WEBP. A imagem substitui a anterior.
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {!editando && modo === "bulk" && (
          <>
            <div
              className="rounded-xl px-4 py-3 text-sm"
              style={{
                border: "1px solid var(--ac-border)",
                background: "var(--ac-bg)",
                color: "var(--ac-muted)",
              }}
            >
              Preencha ou cole várias linhas no formato planilha. Linhas totalmente vazias serão
              ignoradas. Linhas incompletas, com SKU duplicado ou com fornecedor/categoria inválidos
              serão bloqueadas antes de criar.
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="text-xs" style={{ color: "var(--ac-muted)" }}>
                Use o SKU desejado, o nome da categoria e, no fornecedor, o nome já cadastrado.
              </div>
              <Button type="button" variant="secondary" onClick={() => addBulkRows()}>
                Adicionar mais {BULK_ROWS_STEP} linhas
              </Button>
            </div>

            <div
              className="overflow-auto rounded-xl"
              style={{ border: "1px solid var(--ac-border)" }}
            >
              <table className="w-full min-w-[940px] text-sm">
                <thead>
                  <tr
                    style={{
                      background: "var(--ac-bg)",
                      borderBottom: "1px solid var(--ac-border)",
                    }}
                  >
                    <th
                      className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--ac-muted)", width: 60 }}
                    >
                      #
                    </th>
                    <th
                      className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--ac-muted)" }}
                    >
                      SKU *
                    </th>
                    <th
                      className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--ac-muted)" }}
                    >
                      Nome *
                    </th>
                    <th
                      className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--ac-muted)" }}
                    >
                      Categoria *
                    </th>
                    <th
                      className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--ac-muted)" }}
                    >
                      Fornecedor
                    </th>
                    <th
                      className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--ac-muted)" }}
                    >
                      Preço de Custo *
                    </th>
                    <th
                      className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--ac-muted)" }}
                    >
                      Estoque Atual
                    </th>
                    <th
                      className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: "var(--ac-muted)" }}
                    >
                      Estoque Mínimo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {bulkRows.map((row, rowIndex) => (
                    <tr
                      key={row.id}
                      style={{
                        borderTop: rowIndex > 0 ? "1px solid var(--ac-border)" : undefined,
                        background: "var(--ac-card)",
                      }}
                    >
                      <td
                        className="px-3 py-2 text-center text-xs font-medium"
                        style={{ color: "var(--ac-muted)" }}
                      >
                        {rowIndex + 1}
                      </td>
                      {BULK_COLUMNS.map((field, colIndex) => (
                        <td key={field} className="px-2 py-2 align-top">
                          <input
                            value={row[field]}
                            list={
                              field === "categoria"
                                ? "mp-bulk-categorias"
                                : field === "fornecedor"
                                  ? "mp-bulk-fornecedores"
                                  : undefined
                            }
                            placeholder={
                              field === "sku"
                                ? "SKU"
                                : field === "nome"
                                  ? "Nome da matéria-prima"
                                  : field === "categoria"
                                    ? "Categoria"
                                    : field === "fornecedor"
                                      ? "Fornecedor"
                                      : "0"
                            }
                            inputMode={
                              field === "preco_custo" ||
                              field === "estoque_atual" ||
                              field === "estoque_minimo"
                                ? "decimal"
                                : undefined
                            }
                            onChange={(e) => setBulkCell(row.id, field, e.target.value)}
                            onPaste={(e) => {
                              const text = e.clipboardData.getData("text");
                              if (applyBulkPaste(rowIndex, colIndex, text)) e.preventDefault();
                            }}
                            style={cellInputStyle}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <datalist id="mp-bulk-categorias">
              {categoriasMateriaPrima.map((categoria) => (
                <option key={categoria.id} value={categoria.nome} />
              ))}
            </datalist>

            <datalist id="mp-bulk-fornecedores">
              {fornecedores.map((fornecedor) => (
                <option key={fornecedor.id} value={fornecedor.nome} />
              ))}
            </datalist>
          </>
        )}

        {erro && (
          <div
            className="rounded-lg px-3 py-2 text-sm"
            style={{ color: "#dc2626", background: "#fee2e2", whiteSpace: "pre-line" }}
          >
            {erro}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {editando
              ? "Salvar alterações"
              : modo === "bulk"
                ? "Criar matérias-primas"
                : "Criar matéria-prima"}
          </Button>
        </div>
      </form>

      <Modal
        open={fotoLightboxOpen}
        onClose={closeFotoLightbox}
        title="Foto da matéria-prima"
        width="520px"
      >
        <div className="flex flex-col gap-3">
          <div
            style={{
              width: "100%",
              border: "1px solid var(--ac-border)",
              borderRadius: 14,
              overflow: "hidden",
              background: "var(--ac-card)",
            }}
          >
            {fotoLightboxSrc ? (
              <img
                src={fotoLightboxSrc}
                alt="Foto da matéria-prima"
                style={{ width: "100%", height: "auto", display: "block" }}
              />
            ) : null}
          </div>
          <p className="text-xs" style={{ color: "var(--ac-muted)" }}>
            Clique fora ou use &quot;Fechar&quot; para voltar.
          </p>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={closeFotoLightbox}>
              Fechar
            </Button>
          </div>
        </div>
      </Modal>
    </Modal>
  );
}
