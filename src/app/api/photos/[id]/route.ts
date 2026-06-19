export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { deletePhoto } from '@/lib/storage'

type Params = { params: { id: string } }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, { status: 401 })
  }

  try {
    const photo = await db.listingPhoto.findUnique({
      where: { id: params.id },
      include: { listing: { select: { hostId: true } } },
    })
    if (!photo) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Photo not found' } }, { status: 404 })
    if (photo.listing.hostId !== session.user.id) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Not your photo' } }, { status: 403 })
    }

    await Promise.all([
      db.listingPhoto.delete({ where: { id: params.id } }),
      deletePhoto(photo.key),
      photo.thumbKey ? deletePhoto(photo.thumbKey) : Promise.resolve(),
    ])
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Database unavailable' } }, { status: 503 })
  }
}
