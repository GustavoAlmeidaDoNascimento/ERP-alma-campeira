'use client'

import { useMemo, useState, type CSSProperties } from 'react'

export type FacaCatalogoItem = {
  id: string
  nome: string
  categoria: string
  foto_url: string | null
  preco_venda: number
}

const logoMask: CSSProperties = {
  backgroundColor: '#EAB308',
  maskImage: 'url(/images/logo.png)',
  maskSize: 'contain',
  maskRepeat: 'no-repeat',
  maskPosition: 'center',
  WebkitMaskImage: 'url(/images/logo.png)',
  WebkitMaskSize: 'contain',
  WebkitMaskRepeat: 'no-repeat',
  WebkitMaskPosition: 'center',
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
}

export function CatalogoClient({ facas }: Props) {
  const [buscaNome, setBuscaNome] = useState('')
  const [categoriaSelecionada, setCategoriaSelecionada] = useState('')
  const [precoMinStr, setPrecoMinStr] = useState('')
  const [precoMaxStr, setPrecoMaxStr] = useState('')

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
      if (minP !== null && f.preco_venda < minP) return false
      if (maxP !== null && f.preco_venda > maxP) return false
      return true
    })
  }, [facas, buscaNome, categoriaSelecionada, precoMinStr, precoMaxStr])

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
          margin: '0 auto 28px',
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
        </div>
      </div>

      {n === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: '#6b7280' }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>Nenhuma faca com esses filtros</p>
          <p style={{ marginTop: 8, fontSize: 13 }}>Ajuste a busca ou o intervalo de preço.</p>
        </div>
      ) : (
        <div className="catalog-grid">
          {filtradas.map((faca, i) => (
            <div
              key={faca.id}
              className="card fade-in"
              style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
            >
              <div className="card-img-wrap">
                {faca.foto_url ? (
                  <>
                    <img
                      src={faca.foto_url}
                      alt={faca.nome}
                      className="card-img"
                      loading="lazy"
                      decoding="async"
                    />
                  </>
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                        background: '#ffffff',
                    }}
                  >
                    <div
                      aria-hidden
                      style={{
                        ...logoMask,
                        width: 'min(42%, 140px)',
                        height: 'min(42%, 140px)',
                      }}
                    />
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

                <p
                  style={{
                    fontSize: 17,
                    fontWeight: 800,
                    color: '#15803d',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {formatPreco(faca.preco_venda)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
