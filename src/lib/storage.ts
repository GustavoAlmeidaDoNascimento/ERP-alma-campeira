import fs from 'fs/promises'
import path from 'path'
import { resolveUploadsBase } from '@/lib/uploads-path'

const UPLOADS_BASE = resolveUploadsBase()
const PUBLIC_BASE = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

function bucketPath(bucket: string): string {
  return path.join(UPLOADS_BASE, bucket)
}

function filePath(bucket: string, filePath: string): string {
  return path.join(UPLOADS_BASE, bucket, filePath)
}

export interface UploadResult {
  data: { path: string } | null
  error: { message: string } | null
}

export interface RemoveResult {
  data: unknown[] | null
  error: { message: string } | null
}

export interface BucketResult {
  data: { name: string }[] | null
  error: { message: string } | null
}

function localStorageBucket(bucket: string) {
  return {
    upload: async (
      filePath_: string,
      file: File | Blob | Buffer | ArrayBuffer | Uint8Array,
      _opts?: unknown
    ): Promise<UploadResult> => {
      try {
        const dest = filePath(bucket, filePath_)
        await fs.mkdir(path.dirname(dest), { recursive: true })

        let buffer: Buffer
        if (Buffer.isBuffer(file)) {
          buffer = file
        } else if (file instanceof Uint8Array) {
          buffer = Buffer.from(file)
        } else if (file instanceof ArrayBuffer) {
          buffer = Buffer.from(new Uint8Array(file))
        } else if (file instanceof Blob) {
          buffer = Buffer.from(await file.arrayBuffer())
        } else {
          buffer = Buffer.from(file as ArrayBuffer)
        }

        await fs.writeFile(dest, buffer)
        return { data: { path: filePath_ }, error: null }
      } catch (err) {
        return { data: null, error: { message: String(err) } }
      }
    },

    getPublicUrl: (filePath_: string): { data: { publicUrl: string } } => {
      const url = `${PUBLIC_BASE}/uploads/${bucket}/${filePath_}`
      return { data: { publicUrl: url } }
    },

    remove: async (paths: string[]): Promise<RemoveResult> => {
      try {
        await Promise.all(
          paths.map((p) => fs.unlink(filePath(bucket, p)).catch(() => null))
        )
        return { data: paths.map((p) => ({ name: p })), error: null }
      } catch (err) {
        return { data: null, error: { message: String(err) } }
      }
    },

    list: async (prefix?: string): Promise<{ data: { name: string }[] | null; error: null }> => {
      try {
        const dir = prefix ? filePath(bucket, prefix) : bucketPath(bucket)
        const entries = await fs.readdir(dir, { withFileTypes: true })
        const files = entries.filter((e) => e.isFile()).map((e) => ({ name: e.name }))
        return { data: files, error: null }
      } catch {
        return { data: [], error: null }
      }
    },
  }
}

export function createLocalStorage() {
  return {
    listBuckets: async (): Promise<BucketResult> => {
      try {
        await fs.mkdir(UPLOADS_BASE, { recursive: true })
        const entries = await fs.readdir(UPLOADS_BASE, { withFileTypes: true })
        const buckets = entries.filter((e) => e.isDirectory()).map((e) => ({ name: e.name }))
        return { data: buckets, error: null }
      } catch (err) {
        return { data: null, error: { message: String(err) } }
      }
    },

    createBucket: async (name: string): Promise<{ data: unknown; error: null }> => {
      await fs.mkdir(bucketPath(name), { recursive: true })
      return { data: { name }, error: null }
    },

    getBucket: async (name: string): Promise<{ data: { name: string } | null; error: null }> => {
      try {
        await fs.access(bucketPath(name))
        return { data: { name }, error: null }
      } catch {
        return { data: null, error: null }
      }
    },

    from: (bucket: string) => localStorageBucket(bucket),
  }
}
