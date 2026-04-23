'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { statusEstoqueFaca, type StatusEstoque } from '@/types'

/** Apenas amarelo e vermelho; "ok" não exibe tag (público). */
const CATALOGO_ESTOQUETag: Record<
  Exclude<StatusEstoque, 'ok'>,
  { label: string; style: CSSProperties }
> = {
  atencao: {
    label: 'Últimas unidades',
    style: { color: '#b45309', background: '#fef9c3', border: '1px solid #fde047' },
  },
  critico: {
    label: 'Sem estoque',
    style: { color: '#dc2626', background: '#fee2e2', border: '1px solid #fca5a5' },
  },
}

export type FacaCatalogoItem = {
  id: string
  nome: string
  categoria: string
  foto_url: string | null
  estoque_atual: number
  estoque_minimo: number
  /** Só preenchido quando a página é carregada com preços visíveis. */
  preco_venda?: number
}

function tagEstoquePublico(faca: FacaCatalogoItem) {
  const s = statusEstoqueFaca(faca)
  if (s === 'ok') return null
  const cfg = CATALOGO_ESTOQUETag[s]
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold"
      style={cfg.style}
    >
      {cfg.label}
    </span>
  )
}

function formatPreco(preco: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(preco)
}

function parsePrecoInput(raw: string): number | null {
  const t = raw.trim()
  if (t === '') return null
  const s = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function norm(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
}

function KnifeIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-14 h-14 opacity-25"
    >
      <path
        d="M10 54L28 12C30 8 34 6 38 7L54 10L32 38L22 48L10 54Z"
        stroke="#CA8A04"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M22 48L18 52L14 54L10 54L12 50L16 46L22 48Z"
        fill="#CA8A04"
        stroke="#CA8A04"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.6"
      />
      <path d="M28 12L54 10L32 38" stroke="#CA8A04" strokeWidth="1.5" strokeLinejoin="round" opacity="0.4" />
    </svg>
  )
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  fontSize: 14,
  border: '1px solid #d1d5db',
  borderRadius: 10,
  background: '#fff',
  color: '#111827',
  outline: 'none',
}

type Props = {
  facas: FacaCatalogoItem[]
  mostrarPrecos?: boolean
}

export function CatalogoClient({ facas, mostrarPrecos = true }: Props) {
  const [buscaNome, setBuscaNome] = useState('')
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('')
  const [precoMinStr, setPrecoMinStr] = useState('')
  const [precoMaxStr, setPrecoMaxStr] = useState('')
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null)

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  const categorias = useMemo(() => {
    const set = new Set(facas.map((f) => f.categoria).filter(Boolean))
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [facas])

  const filtradas = useMemo(() => {
    const qNome = norm(buscaNome.trim())
    const minP = parsePrecoInput(precoMinStr)
    const maxP = parsePrecoInput(precoMaxStr)

    return facas.filter((f) => {
      if (qNome && !norm(f.nome).includes(qNome)) return false
      if (categoriaSelecionada && f.categoria !== categoriaSelecionada) return false
      if (mostrarPrecos) {
        const pv = f.preco_venda
        if (pv === undefined) return false
        if (minP !== null && pv < minP) return false
        if (maxP !== null && pv > maxP) return false
      }
      return true
    })
  }, [facas, buscaNome, categoriaSelecionada, precoMinStr, precoMaxStr, mostrarPrecos])

  const total = facas.length
  const n = filtradas.length

  if (facas.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 20px', color: '#6b7280' }}>
        <KnifeIcon />
        <p style={{ marginTop: 16, fontSize: 16, fontWeight: 600, color: '#374151' }}>
          Nenhuma faca cadastrada ainda
        </p>
        <p style={{ marginTop: 6, fontSize: 13 }}>Volte em breve.</p>
      </div>
    )
  }

  return (
    <>
      <div
        style={{
          maxWidth: 560,
          margin: '0 auto 14px',
          textAlign: 'left',
        }}
      >
        <label htmlFor="catalogo-busca-nome" className="sr-only">
          Buscar facas por nome
        </label>
        <input
          id="catalogo-busca-nome"
          type="search"
          placeholder="Buscar por nome da faca…"
          value={buscaNome}
          onChange={(e) => setBuscaNome(e.target.value)}
          style={{
            ...inputStyle,
            boxSizing: 'border-box',
          }}
          autoComplete="off"
        />
        <p
          style={{
            marginTop: 6,
            fontSize: 11,
            color: '#9ca3af',
            letterSpacing: '0.02em',
          }}
        >
          {n === total
            ? `${total} ${total === 1 ? 'faca no catálogo' : 'facas no catálogo'}`
            : `${n} de ${total} ${total === 1 ? 'faca' : 'facas'}`}
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: 12,
            marginTop: 16,
          }}
        >
          <div>
            <label htmlFor="catalogo-categoria" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Categoria
            </label>
            <select
              id="catalogo-categoria"
              value={categoriaSelecionada}
              onChange={(e) => setCategoriaSelecionada(e.target.value)}
              style={{
                ...inputStyle,
                boxSizing: 'border-box',
                cursor: 'pointer',
                appearance: 'auto',
              }}
            >
              <option value="">Todas as categorias</option>
              {categorias.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {mostrarPrecos && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label htmlFor="catalogo-preco-min" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Preço mín.
                </label>
                <input
                  id="catalogo-preco-min"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={precoMinStr}
                  onChange={(e) => setPrecoMinStr(e.target.value)}
                  style={{ ...inputStyle, boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label htmlFor="catalogo-preco-max" style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Preço máx.
                </label>
                <input
                  id="catalogo-preco-max"
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={precoMaxStr}
                  onChange={(e) => setPrecoMaxStr(e.target.value)}
                  style={{ ...inputStyle, boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {n === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#6b7280' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>Nenhuma faca com esses filtros</p>
          <p style={{ marginTop: 8, fontSize: 13 }}>
            {mostrarPrecos ? 'Ajuste a busca ou o intervalo de preço.' : 'Ajuste a busca ou a categoria.'}
          </p>
        </div>
      ) : (
        <div className="catalog-grid">
          {filtradas.map((faca, i) => {
            const abrirFoto = faca.foto_url
              ? () => setLightbox({ src: faca.foto_url!, alt: faca.nome })
              : undefined
            return (
            <div
              key={faca.id}
              className={`card fade-in${faca.foto_url ? ' card--clickable' : ''}`}
              style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
              role={faca.foto_url ? 'button' : undefined}
              tabIndex={faca.foto_url ? 0 : undefined}
              aria-label={faca.foto_url ? `Ver foto ampliada: ${faca.nome}` : undefined}
              onClick={abrirFoto}
              onKeyDown={
                faca.foto_url
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        abrirFoto?.()
                      }
                    }
                  : undefined
              }
            >
              <div className="card-img-wrap">
                {faca.foto_url ? (
                  <img
                    src={faca.foto_url}
                    alt=""
                    className="card-img"
                    loading="lazy"
                    decoding="async"
                    aria-hidden
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: '#f9fafb',
                    }}
                  >
                    <KnifeIcon />
                  </div>
                )}
              </div>

              <div style={{ padding: '14px 16px 16px' }}>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#111827',
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    marginBottom: 8,
                  }}
                >
                  {faca.nome}
                </p>

                <p
                  style={{
                    fontSize: 12,
                    color: '#6b7280',
                    marginBottom: 8,
                    lineHeight: 1.35,
                  }}
                >
                  {faca.categoria}
                </p>

                {mostrarPrecos && faca.preco_venda != null && (
                  <p
                    style={{
                      fontSize: 17,
                      fontWeight: 800,
                      color: '#15803d',
                      letterSpacing: '-0.01em',
                      marginBottom: 8,
                    }}
                  >
                    {formatPreco(faca.preco_venda)}
                  </p>
                )}

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '8px 10px',
                    fontSize: 12,
                    color: '#4b5563',
                  }}
                >
                  <span style={{ fontWeight: 600, color: '#374151' }}>
                    Estoque:{' '}
                    <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {faca.estoque_atual}
                    </span>
                  </span>
                  {tagEstoquePublico(faca)}
                </div>
              </div>
            </div>
            )
          })}
        </div>
      )}

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.82)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
            cursor: 'zoom-out',
          }}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Fechar"
            style={{
              position: 'absolute', top: 16, right: 16,
              background: 'rgba(255,255,255,0.12)', border: 'none',
              borderRadius: '50%', width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: '#fff',
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ width: 20, height: 20 }}>
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <img
            src={lightbox.src}
            alt={lightbox.alt}
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '90vw', maxHeight: '88vh',
              borderRadius: 14, objectFit: 'contain',
              boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
              cursor: 'default',
            }}
          />
        </div>
      )}
    </>
  )
}
