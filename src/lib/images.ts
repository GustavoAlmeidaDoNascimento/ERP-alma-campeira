type ImageThumbOptions = {
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

  if (raw.includes('/uploads/')) {
    try {
      const u = new URL(raw.startsWith('http') ? raw : `http://x${raw}`)
      const match = u.pathname.match(/\/uploads\/([^/]+)\/(.+)$/)
      if (match) return { bucket: match[1], path: match[2] }
    } catch {
      // cai no fallback abaixo
    }
  }

  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const u = new URL(raw)
      const match = u.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
      if (match) return { bucket: match[1], path: match[2] }
    } catch {
      // ignora e tenta formatos relativos
    }
  }

  const cleaned = raw.replace(/^\/+/, '')
  const relMatch = cleaned.match(/^storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
  if (relMatch) return { bucket: relMatch[1], path: relMatch[2] }

  const withoutPublicPrefix = cleaned.startsWith('public/') ? cleaned.slice('public/'.length) : cleaned
  const firstSlash = withoutPublicPrefix.indexOf('/')
  if (firstSlash <= 0) return null

  return {
    bucket: withoutPublicPrefix.slice(0, firstSlash),
    path: withoutPublicPrefix.slice(firstSlash + 1),
  }
}

export function getOptimizedImageUrl(
  fotoUrl: string | null | undefined,
  options: ImageThumbOptions,
): string {
  const fallbackUrl = options.fallbackUrl ?? ''
  if (!fotoUrl) return fallbackUrl

  if (fotoUrl.includes('/uploads/')) return fotoUrl

  const parsed = parseStorageUrl(fotoUrl)
  if (!parsed) {
    if (fotoUrl.startsWith('http://') || fotoUrl.startsWith('https://')) return fotoUrl
    return fallbackUrl
  }

  return `${PUBLIC_BASE}/uploads/${parsed.bucket}/${parsed.path}`
}
