export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { photoOrderSchema } from '@/modules/listings/validation'

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, { status: 401 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } }, { status: 400 })
  }

  const parsed = photoOrderSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid input', fields: parsed.error.flatten().fieldErrors } },
      { status: 422 }
    )
  }

  try {
    await db.$transaction(
      parsed.data.photos.map(({ id, sortOrder }) =>
        db.listingPhoto.update({ where: { id }, data: { sortOrder } })
      )
    )
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Database unavailable' } }, { status: 503 })
  }
}
