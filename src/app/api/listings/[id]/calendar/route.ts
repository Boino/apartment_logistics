export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { z } from 'zod'
import { getCalendar, updateCalendar } from '@/modules/availability/service'
import { BlockStatus } from '@/lib/enums'
import { addMonths } from 'date-fns'

type Params = { params: { id: string } }

const calendarUpdateSchema = z.object({
  updates: z.array(
    z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      status: z.nativeEnum(BlockStatus),
      price: z.number().positive().optional(),
    })
  ),
})

export async function GET(req: NextRequest, { params }: Params) {
  const { searchParams } = req.nextUrl
  const fromStr = searchParams.get('from') ?? new Date().toISOString().slice(0, 10)
  const toStr =
    searchParams.get('to') ?? addMonths(new Date(), 3).toISOString().slice(0, 10)

  try {
    const days = await getCalendar(params.id, new Date(fromStr), new Date(toStr))
    return NextResponse.json({ data: days })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg === 'Listing not found')
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: msg } }, { status: 404 })
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Database unavailable' } },
      { status: 503 }
    )
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Sign in required' } },
      { status: 401 }
    )
  }

  try {
    const listing = await db.listing.findUnique({ where: { id: params.id } })
    if (!listing)
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Listing not found' } },
        { status: 404 }
      )
    if (listing.hostId !== session.user.id)
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Not your listing' } },
        { status: 403 }
      )
  } catch {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Database unavailable' } },
      { status: 503 }
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } },
      { status: 400 }
    )
  }

  const parsed = calendarUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          fields: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 422 }
    )
  }

  try {
    await updateCalendar(params.id, parsed.data.updates)
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Database unavailable' } },
      { status: 503 }
    )
  }
}
