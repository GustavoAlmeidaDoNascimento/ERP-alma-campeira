import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import type { CSSProperties } from 'react'

export const metadata: Metadata = {
  title: 'Catálogo de Facas — Alma Campeira',
  description:
    'Conheça nossa linha de facas artesanais, forjadas com tradição e qualidade em cada lâmina.',
}

type FacaCatalogo = {
  id: string
  nome: string
  foto_url: string | null
  preco_venda: number
  estoque_atual: number
}

async function getFacasCatalogo(): Promise<FacaCatalogo[]> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('facas')
      .select('id, nome, foto_url, preco_venda, estoque_atual')
      .order('nome')
    return (data ?? []) as FacaCatalogo[]
  } catch {
    return []
  }
}

function formatPreco(preco: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(preco)
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

function KnifeIcon() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-14 h-14 opacity-20"
    >
      <path
        d="M10 54L28 12C30 8 34 6 38 7L54 10L32 38L22 48L10 54Z"
        stroke="#EAB308"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M22 48L18 52L14 54L10 54L12 50L16 46L22 48Z"
        fill="#EAB308"
        stroke="#EAB308"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.6"
      />
      <path d="M28 12L54 10L32 38" stroke="#EAB308" strokeWidth="1.5" strokeLinejoin="round" opacity="0.4" />
    </svg>
  )
}

export default async function CatalogoPage() {
  const facas = await getFacasCatalogo()
  const disponiveis = facas.filter((f) => f.estoque_atual > 0).length

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #0a0a0a;
          color: #f5f5f5;
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2d2d2d; border-radius: 3px; }

        .card {
          background: #111;
          border: 1px solid #222;
          border-radius: 14px;
          overflow: hidden;
          transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
          cursor: default;
        }

        .card:hover {
          border-color: rgba(234, 179, 8, 0.35);
          box-shadow: 0 0 28px rgba(234, 179, 8, 0.08), 0 8px 32px rgba(0, 0, 0, 0.5);
          transform: translateY(-3px);
        }

        .card-img-wrap {
          aspect-ratio: 1 / 1;
          background: #181818;
          overflow: hidden;
          position: relative;
        }

        .card-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transition: transform 0.5s ease;
          display: block;
        }

        .card:hover .card-img {
          transform: scale(1.06);
        }

        .card-img-gradient {
          position: absolute;
          inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 50%);
          pointer-events: none;
        }

        .catalog-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px;
        }

        @media (min-width: 600px) {
          .catalog-grid { grid-template-columns: repeat(3, 1fr); gap: 18px; }
        }

        @media (min-width: 900px) {
          .catalog-grid { grid-template-columns: repeat(4, 1fr); gap: 20px; }
        }

        @media (min-width: 1280px) {
          .catalog-grid { grid-template-columns: repeat(5, 1fr); gap: 22px; }
        }

        .fade-in {
          animation: fadeUp 0.5s ease both;
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .hero-rule {
          height: 1px;
          background: linear-gradient(to right, transparent, rgba(234,179,8,0.5), transparent);
          margin: 24px 0;
        }

        .badge-encomenda {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: #9ca3af;
          background: #1e1e1e;
          border: 1px solid #2d2d2d;
          padding: 3px 8px;
          border-radius: 999px;
          margin-top: 8px;
        }

        .badge-disponivel {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: #4ade80;
          background: rgba(74, 222, 128, 0.07);
          border: 1px solid rgba(74, 222, 128, 0.18);
          padding: 3px 8px;
          border-radius: 999px;
          margin-top: 8px;
        }

        .stat-card {
          background: #111;
          border: 1px solid #222;
          border-radius: 12px;
          padding: 16px 20px;
          text-align: center;
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#f5f5f5' }}>

        {/* ── HEADER ── */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'rgba(10,10,10,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid #1e1e1e',
          padding: '12px 20px',
        }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ ...logoMask, width: 36, height: 36, flexShrink: 0 }} aria-hidden />
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2, color: '#f5f5f5' }}>
                Alma Campeira
              </p>
              <p style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.05em' }}>
                CUTELARIA ARTESANAL
              </p>
            </div>
          </div>
        </header>

        {/* ── HERO ── */}
        <section style={{ maxWidth: 1280, margin: '0 auto', padding: '52px 20px 20px', textAlign: 'center' }}>
          <p style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.2em',
            color: '#EAB308',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}>
            ✦ &nbsp; Catálogo Oficial &nbsp; ✦
          </p>
          <h1 style={{
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
            color: '#f5f5f5',
            marginBottom: 14,
          }}>
            Nossas Facas
          </h1>
          <p style={{ fontSize: 15, color: '#9ca3af', maxWidth: 440, margin: '0 auto', lineHeight: 1.7 }}>
            Cada peça produzida artesanalmente com os melhores aços, unindo tradição gaúcha e qualidade em cada lâmina.
          </p>

          <div className="hero-rule" />

          {/* Stats */}
          {facas.length > 0 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 8,
            }}>
              <div className="stat-card">
                <p style={{ fontSize: 22, fontWeight: 800, color: '#EAB308' }}>{facas.length}</p>
                <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Modelos
                </p>
              </div>
              <div className="stat-card">
                <p style={{ fontSize: 22, fontWeight: 800, color: '#4ade80' }}>{disponiveis}</p>
                <p style={{ fontSize: 11, color: '#6b7280', marginTop: 2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Disponíveis
                </p>
              </div>
            </div>
          )}
        </section>

        {/* ── GRID ── */}
        <main style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 20px 60px' }}>
          {facas.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '80px 20px',
              color: '#4b5563',
            }}>
              <KnifeIcon />
              <p style={{ marginTop: 16, fontSize: 16, fontWeight: 600 }}>
                Nenhuma faca cadastrada ainda
              </p>
              <p style={{ marginTop: 6, fontSize: 13 }}>Volte em breve.</p>
            </div>
          ) : (
            <div className="catalog-grid">
              {facas.map((faca, i) => (
                <div
                  key={faca.id}
                  className="card fade-in"
                  style={{ animationDelay: `${Math.min(i * 40, 400)}ms` }}
                >
                  {/* Image */}
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
                        <div className="card-img-gradient" />
                      </>
                    ) : (
                      <div style={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'radial-gradient(circle at 50% 60%, #1a1a1a, #111)',
                      }}>
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

                  {/* Info */}
                  <div style={{ padding: '14px 16px 16px' }}>
                    <p style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#e5e7eb',
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      marginBottom: 8,
                    }}>
                      {faca.nome}
                    </p>

                    <p style={{
                      fontSize: 17,
                      fontWeight: 800,
                      color: '#EAB308',
                      letterSpacing: '-0.01em',
                    }}>
                      {formatPreco(faca.preco_venda)}
                    </p>

                    {faca.estoque_atual > 0 ? (
                      <span className="badge-disponivel">
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', flexShrink: 0 }} />
                        Disponível
                      </span>
                    ) : (
                      <span className="badge-encomenda">
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6b7280', flexShrink: 0 }} />
                        Sob encomenda
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* ── FOOTER ── */}
        <footer style={{
          borderTop: '1px solid #1a1a1a',
          padding: '32px 20px',
          textAlign: 'center',
        }}>
          <div style={{ ...logoMask, width: 32, height: 32, margin: '0 auto 12px' }} aria-hidden />
          <p style={{ fontSize: 13, fontWeight: 700, color: '#e5e7eb' }}>Alma Campeira</p>
          <p style={{ fontSize: 12, color: '#4b5563', marginTop: 4 }}>
            Cutelaria Artesanal — Tradição e qualidade em cada lâmina
          </p>
          <p style={{ fontSize: 11, color: '#374151', marginTop: 16 }}>
            © {new Date().getFullYear()} Alma Campeira. Todos os direitos reservados.
          </p>
        </footer>

      </div>
    </>
  )
}
