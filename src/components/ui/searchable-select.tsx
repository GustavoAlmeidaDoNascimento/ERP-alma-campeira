"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

export type SearchableSelectOption = {
  value: string;
  label: string;
  secondaryLabel?: string;
  searchText?: string;
  /** URL já otimizada (ex.: `getOptimizedImageUrl`); se ausente ou vazio, mostra placeholder */
  imageUrl?: string | null;
};

function OptionThumb({ src, title }: { src?: string | null; title: string }) {
  const box = "size-9 shrink-0 overflow-hidden rounded-md border sm:size-10";
  if (src) {
    return (
      <span className={box} style={{ borderColor: "var(--ac-border)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- miniatura pequena, URL já otimizada */}
        <img src={src} alt="" className="size-full object-cover" title={title} />
      </span>
    );
  }
  return (
    <span
      className={`${box} flex items-center justify-center`}
      style={{
        borderColor: "var(--ac-border)",
        background: "color-mix(in srgb, var(--ac-border) 22%, transparent)",
      }}
      title="Sem foto"
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="size-4 opacity-50"
        style={{ color: "var(--ac-muted)" }}
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <path d="M21 15l-5-5L5 21" />
      </svg>
    </span>
  );
}

function normalize(s: string) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  inputClassName?: string;
  /** Se false, não exibe miniaturas (útil para listas só texto, ex.: usuários). Default: true. */
  showThumbnails?: boolean;
};

export function SearchableSelect({
  id: idProp,
  value,
  onChange,
  options,
  placeholder = "Pesquisar…",
  disabled,
  loading,
  emptyMessage = "Nenhum resultado",
  className = "",
  inputClassName = "",
  showThumbnails = true,
}: Props) {
  const genId = useId();
  const id = idProp ?? genId;
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [openUpward, setOpenUpward] = useState(false);

  const selectedOption = useMemo(() => options.find((o) => o.value === value), [options, value]);
  const selectedLabel = selectedOption?.label ?? "";
  const selectedImageUrl = selectedOption?.imageUrl;
  const selectedIndex = useMemo(
    () => options.findIndex((o) => o.value === value),
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return options;
    return options.filter((o) => {
      const hay = normalize(o.searchText ?? `${o.label} ${o.secondaryLabel ?? ""}`);
      return hay.includes(q);
    });
  }, [options, query]);

  const highlightSafe = filtered.length === 0 ? 0 : Math.min(highlight, filtered.length - 1);

  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-idx="${highlightSafe}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightSafe, open]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const expectedListHeight = 320;
    setOpenUpward(spaceBelow < expectedListHeight && spaceAbove > spaceBelow);
  }, [open]);

  const pick = useCallback(
    (v: string, label: string) => {
      onChange(v);
      setQuery(label);
      setOpen(false);
    },
    [onChange],
  );

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
      return;
    }
    if (disabled || loading) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setOpen(true);
      else setHighlight((h) => Math.min(h + 1, Math.max(0, filtered.length - 1)));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (open) setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      const o = filtered[highlightSafe];
      if (open && o) {
        e.preventDefault();
        pick(o.value, o.label);
      }
      return;
    }
    if (e.key === "Tab") {
      setOpen(false);
    }
  }

  const showList = open && !disabled && !loading;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div
        className={`mt-1 flex gap-2 ${value && showThumbnails ? "items-center" : "items-stretch"}`}
      >
        {value && showThumbnails ? (
          <OptionThumb src={selectedImageUrl} title={selectedLabel} />
        ) : null}
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${id}-listbox`}
          aria-autocomplete="list"
          disabled={disabled || loading}
          value={open ? query : selectedLabel}
          placeholder={placeholder}
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            setHighlight(0);
            setOpen(true);
            if (value) onChange("");
          }}
          onFocus={() => {
            // Ao abrir, mostramos toda a lista em vez de filtrar pelo valor selecionado.
            setQuery("");
            setHighlight(selectedIndex >= 0 ? selectedIndex : 0);
            setOpen(true);
          }}
          onKeyDown={onInputKeyDown}
          className={`min-w-0 flex-1 px-3 py-2 rounded-lg text-sm outline-none transition-[box-shadow] focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--ac-muted)_35%,transparent)] focus-visible:ring-offset-0 ${inputClassName}`}
          style={{
            background: "var(--ac-bg)",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "var(--ac-border)",
            color: "var(--ac-text)",
          }}
        />
      </div>

      {loading && (
        <p className="mt-1 text-xs" style={{ color: "var(--ac-muted)" }}>
          Carregando…
        </p>
      )}

      {showList && (
        <ul
          id={`${id}-listbox`}
          ref={listRef}
          role="listbox"
          className={`absolute left-0 z-[60] w-full overflow-auto rounded-lg py-1 shadow-lg ${
            openUpward
              ? "bottom-full mb-1 max-h-52 sm:max-h-60"
              : "top-full mt-1 max-h-60 sm:max-h-72"
          }`}
          style={{
            background: "var(--ac-card)",
            borderWidth: "1px",
            borderStyle: "solid",
            borderColor: "var(--ac-border)",
          }}
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm" style={{ color: "var(--ac-muted)" }}>
              {emptyMessage}
            </li>
          ) : (
            filtered.map((o, idx) => (
              <li key={o.value} role="presentation">
                <button
                  type="button"
                  data-idx={idx}
                  role="option"
                  aria-selected={value === o.value}
                  className="flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-sm transition-colors sm:gap-3 sm:px-3 sm:py-2"
                  style={{
                    background:
                      highlightSafe === idx
                        ? "color-mix(in srgb, var(--ac-border) 45%, transparent)"
                        : "transparent",
                    color: "var(--ac-text)",
                  }}
                  onMouseEnter={() => setHighlight(idx)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(o.value, o.label)}
                >
                  {showThumbnails ? <OptionThumb src={o.imageUrl} title={o.label} /> : null}
                  <span className="min-w-0 flex-1 leading-snug">
                    <span className="block truncate">{o.label}</span>
                    {o.secondaryLabel ? (
                      <span
                        className="mt-0.5 block truncate text-xs"
                        style={{ color: "var(--ac-muted)" }}
                      >
                        {o.secondaryLabel}
                      </span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
