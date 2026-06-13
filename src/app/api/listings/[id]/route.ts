export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { updateListingSchema } from '@/modules/listings/validation'
import {
  getListingById,
  updateListing,
  publishListing,
  archiveListing,
} from '@/modules/listings/service'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  try {
    const listing = await getListingById(params.id, session?.user?.id)
    if (!listing) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Listing not found' } }, { status: 404 })
    return NextResponse.json({ data: listing })
  } catch {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Database unavailable' } }, { status: 503 })
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, { status: 401 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } }, { status: 400 })
  }

  // handle action=publish / action=archive
  if (body && typeof body === 'object' && 'action' in body) {
    const action = (body as { action: string }).action
    try {
      if (action === 'publish') {
        const listing = await publishListing(params.id)
        return NextResponse.json({ data: listing })
      }
      if (action === 'archive') {
        const listing = await archiveListing(params.id)
        return NextResponse.json({ data: listing })
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      const fields = (err as { fields?: string[] }).fields
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message, ...(fields && { fields }) } }, { status: 422 })
    }
  }

  const parsed = updateListingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid input', fields: parsed.error.flatten().fieldErrors } },
      { status: 422 }
    )
  }

  try {
    const listing = await updateListing(params.id, parsed.data)
    return NextResponse.json({ data: listing })
  } catch {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Database unavailable' } }, { status: 503 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, { status: 401 })
  }

  try {
    const listing = await archiveListing(params.id)
    return NextResponse.json({ data: listing })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: { code: 'CONFLICT', message } }, { status: 409 })
  }
}
