import { createClient } from '@/lib/supabase/client'

type SupabaseImageThumbOptions = {
  width: number
  height: number
  quality: number
  resize?: 'cover' | 'contain' | 'fill'
  fallbackUrl?: string
}

let supabaseSingleton: ReturnType<typeof createClient> | null = null

function getSupabase() {
  if (!supabaseSingleton) supabaseSingleton = createClient()
  return supabaseSingleton
}

function parseSupabasePublicStorageUrl(
  fotoUrl: string
): { bucket: string; path: string } | null {
  const raw = fotoUrl.trim()
  if (!raw) return null

  // Caso `foto_url` esteja como URL completa do storage público
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const u = new URL(raw)
      const match = u.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
      if (!match) return null
      return { bucket: match[1], path: match[2] }
    } catch {
      return null
    }
  }

  // Caso `foto_url` venha como caminho relativo do storage (sem http/https)
  const rawNoQuery = raw.split('#')[0]?.split('?')[0] ?? raw
  const cleanedNoQuery = rawNoQuery.replace(/^\/+/, '')
  const relativeMatch = cleanedNoQuery.match(/^storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
  if (relativeMatch) return { bucket: relativeMatch[1], path: relativeMatch[2] }

  // Formatos de fallback:
  // - "bucket/path/to/file.jpg"
  // - "public/bucket/path/to/file.jpg"
  const cleaned = raw.replace(/^\/+/, '')
  const withoutPublicPrefix = cleaned.startsWith('public/') ? cleaned.slice('public/'.length) : cleaned

  const firstSlash = withoutPublicPrefix.indexOf('/')
  if (firstSlash <= 0) return null

  const bucket = withoutPublicPrefix.slice(0, firstSlash)
  const path = withoutPublicPrefix.slice(firstSlash + 1)
  return { bucket, path }
}

export function getOptimizedSupabaseImageUrl(
  fotoUrl: string | null | undefined,
  options: SupabaseImageThumbOptions
): string {
  // Deixamos o fallback padrão como vazio, para que a UI decida o placeholder.
  const fallbackUrl = options.fallbackUrl ?? ''
  if (!fotoUrl) return fallbackUrl

  // Se não der para parsear, ainda tentamos retornar o próprio `foto_url` se for uma URL direta.
  const parsed = parseSupabasePublicStorageUrl(fotoUrl)
  if (!parsed) {
    if (fotoUrl.startsWith('http://') || fotoUrl.startsWith('https://')) return fotoUrl
    if (fotoUrl.startsWith('/storage/v1/object/public/')) return fotoUrl
    return fallbackUrl
  }

  const quality = Math.max(20, Math.min(100, options.quality))

  try {
    const supabase = getSupabase()

    // 1) Tenta a URL otimizada (compactador/transformações).
    const { data: optimized } = supabase.storage
      .from(parsed.bucket)
      .getPublicUrl(parsed.path, {
        transform: {
          width: options.width,
          height: options.height,
          resize: options.resize ?? 'cover',
          quality,
        },
      })

    if (optimized.publicUrl) return optimized.publicUrl

    // 2) Se não gerou (ex.: origem não suportada), tentamos sem transformações.
    const { data: noTransform } = supabase.storage
      .from(parsed.bucket)
      .getPublicUrl(parsed.path)

    return noTransform.publicUrl ?? fallbackUrl
  } catch {
    if (fotoUrl.startsWith('http://') || fotoUrl.startsWith('https://')) return fotoUrl
    if (fotoUrl.startsWith('/storage/v1/object/public/')) return fotoUrl
    return fallbackUrl
  }
}

