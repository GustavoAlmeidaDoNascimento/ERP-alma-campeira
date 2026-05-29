/**
 * Rota de uploads apenas para desenvolvimento local.
 * Em produção, o Nginx serve /var/www/erp-uploads diretamente em /uploads/*.
 */
import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const UPLOADS_BASE = process.env.UPLOADS_DIR ?? path.join(process.cwd(), '.uploads')

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: pathParts } = await params
  const filePath = path.join(UPLOADS_BASE, ...pathParts)

  // Segurança: impede path traversal
  if (!filePath.startsWith(UPLOADS_BASE)) {
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
