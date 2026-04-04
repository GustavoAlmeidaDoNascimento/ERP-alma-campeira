import { createAdminClient } from '@/lib/supabase/admin'
import type { Metadata } from 'next'
import Image from 'next/image'
import type { CSSProperties } from 'react'
import { CatalogoClient, type FacaCatalogoItem } from './catalogo-client'

export const metadata: Metadata = {
  title: 'Catálogo de Facas — Alma Campeira',
  description:
    'Conheça nossa linha de facas artesanais, forjadas com tradição e qualidade em cada lâmina.',
}

async function getFacasCatalogo(): Promise<FacaCatalogoItem[]> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('facas')
      .select('id, nome, categoria, foto_url, preco_venda')
      .order('nome')
    return (data ?? []) as FacaCatalogoItem[]
  } catch {
    return []
  }
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

export default async function CatalogoPage() {
  const facas = await getFacasCatalogo()

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: #ffffff;
          color: #111827;
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }

        .card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          overflow: hidden;
          transition: border-color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
          cursor: default;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
        }

        .card:hover {
          border-color: rgba(202, 138, 4, 0.45);
          box-shadow: 0 0 24px rgba(202, 138, 4, 0.12), 0 8px 24px rgba(0, 0, 0, 0.06);
          transform: translateY(-3px);
        }

        .card--clickable {
          cursor: pointer;
        }

        .card--clickable:focus-visible {
          outline: 2px solid #ca8a04;
          outline-offset: 3px;
        }

        .card-img-wrap {
          aspect-ratio: 1 / 1;
          background: #f3f4f6;
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
          background: linear-gradient(to right, transparent, rgba(202,138,4,0.45), transparent);
          margin: 8px 0 12px;
        }
      `}</style>

      <div style={{ minHeight: '100vh', background: '#ffffff', color: '#111827' }}>

        <header style={{
          position: 'sticky', top: 0, zIndex: 50,
          background: 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid #e5e7eb',
          padding: '12px 20px',
        }}>
          <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ ...logoMask, width: 36, height: 36, flexShrink: 0 }} aria-hidden />
            <div>
              <p style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.2, color: '#111827' }}>
                Alma Campeira
              </p>
              <p style={{ fontSize: 11, color: '#6b7280', letterSpacing: '0.05em' }}>
                CUTELARIA ARTESANAL
              </p>
            </div>
          </div>
        </header>

        <section style={{ maxWidth: 1280, margin: '0 auto', padding: '18px 20px 4px', textAlign: 'center' }}>
          <h1
            style={{
              margin: 0,
              marginBottom: 6,
              display: 'flex',
              justifyContent: 'center',
            }}
          >
            <Image
              src="/images/letreiro.png"
              alt="Alma Campeira Cutelaria"
              width={340}
              height={155}
              priority
              style={{
                width: 'min(380px, 88vw)',
                height: 'auto',
                objectFit: 'contain',
              }}
            />
          </h1>

          <div className="hero-rule" />
        </section>

        <main style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px 60px' }}>
          <CatalogoClient facas={facas} />
        </main>

        <footer style={{
          borderTop: '1px solid #e5e7eb',
          padding: '32px 20px',
          textAlign: 'center',
          background: '#fafafa',
        }}>
          <div style={{ ...logoMask, width: 32, height: 32, margin: '0 auto 12px' }} aria-hidden />
          <p style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Alma Campeira</p>
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            Cutelaria Artesanal — Tradição e qualidade em cada lâmina
          </p>
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 16 }}>
            © {new Date().getFullYear()} Alma Campeira. Todos os direitos reservados.
          </p>
        </footer>

      </div>
    </>
  )
}
