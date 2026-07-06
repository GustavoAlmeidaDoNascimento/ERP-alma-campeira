/**
 * Rota de uploads apenas para desenvolvimento local.
 * Em produção, o Nginx serve /var/www/erp-uploads diretamente em /uploads/*.
 */
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (process.env.NODE_ENV !== 'development') {
    return new NextResponse('Not Found', { status: 404 })
  }

  const [{ default: fs }, path, { resolveUploadsBase }] = await Promise.all([
    import('node:fs/promises'),
    import('node:path'),
    import('@/lib/uploads-path'),
  ])

  const uploadsBase = resolveUploadsBase()
  const { path: pathParts } = await params
  const filePath = path.resolve(uploadsBase, ...pathParts)
  const relativePath = path.relative(uploadsBase, filePath)

  // Segurança: impede path traversal
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  try {
    const buffer = await fs.readFile(filePath)
    const ext = path.extname(filePath).slice(1)
    const mimeMap: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      pdf: 'application/pdf',
    }
    const contentType = mimeMap[ext.toLowerCase()] ?? 'application/octet-stream'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new NextResponse('Not Found', { status: 404 })
  }
}
