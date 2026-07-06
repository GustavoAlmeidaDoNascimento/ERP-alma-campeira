import type { Metadata } from 'next'
import { prisma } from '@/lib/prisma'
import { CatalogoClient, type FacaCatalogoItem } from './catalogo-client'

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ sem_precos?: string }>
}): Promise<Metadata> {
  const { sem_precos: semPrecos } = await searchParams
  const sem = semPrecos === '1'
  return {
    title: sem ? 'Catálogo (sem preços) — Facas' : 'Catálogo de Facas',
    description: sem
      ? 'Visualização pública do catálogo, sem exibir valores.'
      : 'Catálogo de facas artesanais.',
  }
}

async function getFacasCatalogo(mostrarPrecos: boolean): Promise<FacaCatalogoItem[]> {
  try {
    const facas = await prisma.faca.findMany({
      orderBy: { nome: 'asc' },
      select: {
        id: true,
        nome: true,
        categoria: true,
        fotoUrl: true,
        precoVenda: mostrarPrecos,
        estoqueAtual: true,
        estoqueMinimo: true,
      },
    })
    return facas.map((f) => ({
      id: f.id,
      nome: f.nome,
      categoria: f.categoria,
      foto_url: f.fotoUrl,
      preco_venda: typeof f.precoVenda === 'object' && f.precoVenda && 'toNumber' in f.precoVenda
        ? f.precoVenda.toNumber()
        : (f.precoVenda as number | null | undefined) ?? undefined,
      estoque_atual: f.estoqueAtual,
      estoque_minimo: f.estoqueMinimo,
    })) as FacaCatalogoItem[]
  } catch {
    return []
  }
}

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<{ sem_precos?: string }>
}) {
  const { sem_precos: semPrecos } = await searchParams
  const mostrarPrecos = semPrecos !== '1'
  const facas = await getFacasCatalogo(mostrarPrecos)

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

      `}</style>

      <div style={{ minHeight: '100vh', background: '#ffffff', color: '#111827' }}>

        <section style={{ maxWidth: 1280, margin: '0 auto', padding: '32px 20px 16px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: '#111827', letterSpacing: '-0.02em' }}>
            Catálogo de Facas
          </h1>
          {!mostrarPrecos && (
            <p style={{ marginTop: 10, fontSize: 14, fontWeight: 500, color: '#6b7280' }}>
              Visualização pública sem preços
            </p>
          )}
        </section>

        <main style={{ maxWidth: 1280, margin: '0 auto', padding: '0 20px 60px' }}>
          <CatalogoClient facas={facas} mostrarPrecos={mostrarPrecos} />
        </main>

      </div>
    </>
  )
}
