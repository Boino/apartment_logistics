export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { savePhoto } from '@/lib/storage'
import sharp from 'sharp'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 10 * 1024 * 1024 // 10 MB

type Params = { params: { id: string } }

export async function POST(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, { status: 401 })
  }

  // verify ownership
  try {
    const listing = await db.listing.findUnique({ where: { id: params.id } })
    if (!listing) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Listing not found' } }, { status: 404 })
    if (listing.hostId !== session.user.id) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Not your listing' } }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Database unavailable' } }, { status: 503 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Expected multipart/form-data' } }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Field "file" is required' } }, { status: 400 })
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: { code: 'UNSUPPORTED_TYPE', message: 'Only JPEG, PNG, and WebP are accepted' } }, { status: 415 })
  }

  const arrayBuffer = await file.arrayBuffer()
  if (arrayBuffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: { code: 'FILE_TOO_LARGE', message: 'File must be ≤ 10 MB' } }, { status: 413 })
  }

  const inputBuffer = Buffer.from(arrayBuffer)

  // resize to 1600px and generate 400px thumbnail
  const [fullBuffer, thumbBuffer] = await Promise.all([
    sharp(inputBuffer).resize(1600, undefined, { withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(),
    sharp(inputBuffer).resize(400, 300, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer(),
  ])

  try {
    const [{ url, key }, { url: thumbUrl, key: thumbKey }] = await Promise.all([
      savePhoto(fullBuffer, 'image/jpeg'),
      savePhoto(thumbBuffer, 'image/jpeg'),
    ])

    // determine next sort order
    const maxOrder = await db.listingPhoto.aggregate({
      where: { listingId: params.id },
      _max: { sortOrder: true },
    })
    const sortOrder = (maxOrder._max.sortOrder ?? -1) + 1

    const photo = await db.listingPhoto.create({
      data: { listingId: params.id, url, key, thumbUrl, thumbKey, sortOrder },
    })
    return NextResponse.json({ data: photo }, { status: 201 })
  } catch {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Database unavailable' } }, { status: 503 })
  }
}
