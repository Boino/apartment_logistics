export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createListingSchema } from '@/modules/listings/validation'
import { createListing, getPublishedListings } from '@/modules/listings/service'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const search = searchParams.get('search') ?? undefined
  const minPrice = searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined
  const maxPrice = searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined
  const take = searchParams.get('take') ? Number(searchParams.get('take')) : 24
  const skip = searchParams.get('skip') ? Number(searchParams.get('skip')) : 0

  try {
    const result = await getPublishedListings({ search, minPrice, maxPrice, take, skip })
    return NextResponse.json({ data: result })
  } catch {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Database unavailable' } }, { status: 503 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, { status: 401 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } }, { status: 400 })
  }

  const parsed = createListingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid input', fields: parsed.error.flatten().fieldErrors } },
      { status: 422 }
    )
  }

  try {
    const listing = await createListing(session.user.id, parsed.data)
    return NextResponse.json({ data: listing }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/listings]', msg)
    return NextResponse.json({ error: { code: 'DB_ERROR', message: msg } }, { status: 503 })
  }
}
