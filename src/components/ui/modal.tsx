"use client";

import { useEffect, useRef } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  width?: string;
};

export function Modal({ open, onClose, title, children, width = "800px" }: ModalProps) {
  /** Evita fechar ao soltar o mouse no backdrop após seleção de texto iniciada dentro do modal. */
  const pointerDownOnBackdrop = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onMouseDown={(e) => {
        pointerDownOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pointerDownOnBackdrop.current && e.target === e.currentTarget) {
          onClose();
        }
        pointerDownOnBackdrop.current = false;
      }}
    >
      <div
        className="relative flex max-h-[min(90vh,calc(100vh-2rem))] w-full flex-col overflow-hidden rounded-xl shadow-xl"
        style={{
          maxWidth: width,
          background: "var(--ac-card)",
          border: "1px solid var(--ac-border)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — fixo no topo enquanto o corpo rola */}
        <div
          className="flex shrink-0 items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--ac-border)" }}
        >
          <h2 className="font-semibold text-base" style={{ color: "var(--ac-text)" }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 transition-colors"
            style={{ color: "var(--ac-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--ac-border)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="size-4"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Corpo rolável (matrizes longas, formulários grandes) */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
