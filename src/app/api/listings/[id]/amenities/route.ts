export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { amenitiesSchema } from '@/modules/listings/validation'
import { setAmenities } from '@/modules/listings/service'

type Params = { params: { id: string } }

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, { status: 401 })
  }

  try {
    const listing = await db.listing.findUnique({ where: { id: params.id } })
    if (!listing) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Listing not found' } }, { status: 404 })
    if (listing.hostId !== session.user.id) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Not your listing' } }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Database unavailable' } }, { status: 503 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } }, { status: 400 })
  }

  const parsed = amenitiesSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } },
      { status: 422 }
    )
  }

  try {
    await setAmenities(params.id, parsed.data.amenityIds)
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Database unavailable' } }, { status: 503 })
  }
}
