import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
}

export async function savePhoto(
  buffer: Buffer,
  mimeType: string
): Promise<{ url: string; key: string }> {
  await ensureUploadDir()
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
  const key = `${crypto.randomUUID()}.${ext}`
  await fs.writeFile(path.join(UPLOAD_DIR, key), buffer)
  return { url: `/uploads/${key}`, key }
}

export async function deletePhoto(key: string): Promise<void> {
  try {
    await fs.unlink(path.join(UPLOAD_DIR, key))
  } catch {
    // file may already be gone — not an error
  }
}

export function keyFromUrl(url: string): string {
  return url.replace(/^\/uploads\//, '')
}
