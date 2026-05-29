/**
 * Retorna a URL pública de uma imagem do storage local.
 *
 * Anteriormente usava as transformações de imagem do Supabase (resize, quality).
 * Agora que o storage é local (servido pelo Nginx), as transformações não estão
 * disponíveis — a URL pública é retornada diretamente.
 *
 * Formato das URLs:
 *   - Antigas (Supabase): https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
 *   - Novas (local):       https://<domínio>/uploads/<bucket>/<path>
 */

type SupabaseImageThumbOptions = {
  width?: number
  height?: number
  quality?: number
  resize?: 'cover' | 'contain' | 'fill'
  fallbackUrl?: string
}

const PUBLIC_BASE = process.env.NEXT_PUBLIC_BASE_URL ?? ''

function parseStorageUrl(fotoUrl: string): { bucket: string; path: string } | null {
  const raw = fotoUrl.trim()
  if (!raw) return null

  // URL nova: https://dominio/uploads/<bucket>/<path>
  if (raw.includes('/uploads/')) {
    try {
      const u = new URL(raw.startsWith('http') ? raw : `http://x${raw}`)
      const match = u.pathname.match(/\/uploads\/([^/]+)\/(.+)$/)
      if (match) return { bucket: match[1], path: match[2] }
    } catch { /* cai no fallback */ }
  }

  // URL antiga do Supabase: /storage/v1/object/public/<bucket>/<path>
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const u = new URL(raw)
      const match = u.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
      if (match) return { bucket: match[1], path: match[2] }
    } catch { /* ignora */ }
  }

  const cleaned = raw.replace(/^\/+/, '')
  const relMatch = cleaned.match(/^storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
  if (relMatch) return { bucket: relMatch[1], path: relMatch[2] }

  // Formato "bucket/path/to/file.jpg" ou "public/bucket/path"
  const withoutPublicPrefix = cleaned.startsWith('public/') ? cleaned.slice('public/'.length) : cleaned
  const firstSlash = withoutPublicPrefix.indexOf('/')
  if (firstSlash <= 0) return null

  return {
    bucket: withoutPublicPrefix.slice(0, firstSlash),
    path: withoutPublicPrefix.slice(firstSlash + 1),
  }
}

export function getOptimizedSupabaseImageUrl(
  fotoUrl: string | null | undefined,
  options: SupabaseImageThumbOptions
): string {
  const fallbackUrl = options.fallbackUrl ?? ''
  if (!fotoUrl) return fallbackUrl

  // Se já é URL local de uploads, retorna direto
  if (fotoUrl.includes('/uploads/')) return fotoUrl

  const parsed = parseStorageUrl(fotoUrl)
  if (!parsed) {
    if (fotoUrl.startsWith('http://') || fotoUrl.startsWith('https://')) return fotoUrl
    return fallbackUrl
  }

  return `${PUBLIC_BASE}/uploads/${parsed.bucket}/${parsed.path}`
}
