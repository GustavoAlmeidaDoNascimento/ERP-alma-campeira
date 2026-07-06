import path from 'path'

const PROJECT_ROOT = /* turbopackIgnore: true */ process.cwd()
const DEFAULT_UPLOADS_DIR = path.join(PROJECT_ROOT, '.uploads-local')

export function resolveUploadsBase(): string {
  const configured = process.env.UPLOADS_DIR?.trim()
  if (!configured) return DEFAULT_UPLOADS_DIR
  if (path.isAbsolute(configured)) return configured
  return path.resolve(PROJECT_ROOT, configured)
}
