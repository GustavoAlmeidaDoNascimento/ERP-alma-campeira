"use client";

import { useState, useEffect, useRef } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { salvarConsumivelComFoto } from "@/lib/actions/consumiveis-upload";
import Link from "next/link";
import type { Consumivel, Fornecedor, CategoriaConsumivelDB } from "@/types";
import { getOptimizedImageUrl } from "@/lib/images";

type Props = {
  open: boolean;
  onClose: () => void;
  fornecedores: Fornecedor[];
  categoriasConsumivel: CategoriaConsumivelDB[];
  editando?: Consumivel | null;
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

const formVazio: Form = {
  sku: "",
  nome: "",
  categoria: "",
  fornecedor_id: "",
  preco_custo: "",
  estoque_atual: "0",
  estoque_minimo: "0",
};

export function ConsumivelModal({
  open,
  onClose,
  fornecedores,
  categoriasConsumivel,
  editando,
  onSaved,
}: Props) {
  const [form, setForm] = useState<Form>(formVazio);
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
    if (editando) {
      setForm({
        sku: editando.sku,
        nome: editando.nome,
        categoria: editando.categoria,
        fornecedor_id: editando.fornecedor_id ?? "",
        preco_custo: String(editando.preco_custo),
        estoque_atual: String(editando.estoque_atual),
        estoque_minimo: String(editando.estoque_minimo),
      });
    } else {
      setForm({
        ...formVazio,
        categoria: categoriasConsumivel[0]?.nome ?? "Escritório",
      });
    }
    setErro("");
    setFotoFile(null);
    setFotoPreview("");
  }, [editando, open, categoriasConsumivel]);

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
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (!form.sku.trim()) {
      setErro("SKU é obrigatório.");
      return;
    }
    if (!form.nome.trim()) {
      setErro("Nome é obrigatório.");
      return;
    }
    if (!form.categoria.trim()) {
      setErro("Categoria é obrigatória.");
      return;
    }
    if (!form.preco_custo || isNaN(Number(form.preco_custo))) {
      setErro("Preço de custo inválido.");
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      if (editando?.id) fd.append("id", editando.id);
      fd.append("sku", form.sku);
      fd.append("nome", form.nome);
      fd.append("categoria", form.categoria);
      fd.append("fornecedor_id", form.fornecedor_id);
      fd.append("preco_custo", String(parseFloat(form.preco_custo)));
      fd.append("estoque_atual", String(parseFloat(form.estoque_atual) || 0));
      fd.append("estoque_minimo", String(parseFloat(form.estoque_minimo) || 0));
      if (fotoFile) fd.append("foto", fotoFile, fotoFile.name);

      await salvarConsumivelComFoto(fd);
      onClose();
      onSaved?.();
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? `Editar — ${editando.codigo}` : "Novo Consumível"}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          id="sku"
          label="SKU *"
          placeholder="Ex: CONS-0001"
          value={form.sku}
          onChange={(e) => set("sku", e.target.value)}
        />
        <Input
          id="nome"
          label="Nome *"
          placeholder="Ex: Papel A4 500 folhas"
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
              href="/configuracoes#categorias-consumivel"
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
            value={form.categoria}
            onChange={(e) => set("categoria", e.target.value)}
          >
            {categoriasConsumivel.map((cat) => (
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
            {fornecedores.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
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

        {/* Foto (opcional) */}
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
                    aria-label="Expandir foto do consumível"
                  >
                    <img
                      src={src}
                      alt="Foto do consumível"
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

        {erro && (
          <p
            className="text-sm rounded-lg px-3 py-2"
            style={{ color: "#dc2626", background: "#fee2e2" }}
          >
            {erro}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {editando ? "Salvar alterações" : "Criar consumível"}
          </Button>
        </div>
      </form>

      <Modal
        open={fotoLightboxOpen}
        onClose={closeFotoLightbox}
        title="Foto do consumível"
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
                alt="Foto do consumível"
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
