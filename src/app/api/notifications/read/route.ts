export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth/guards'
import { db } from '@/lib/db'
import { z } from 'zod'

const schema = z.object({ ids: z.array(z.string()).optional() })

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input' } }, { status: 422 })
    }
    // if ids provided, mark only those; otherwise mark all unread
    const where = parsed.data.ids?.length
      ? { userId: user.id, id: { in: parsed.data.ids }, readAt: null }
      : { userId: user.id, readAt: null }

    const { count } = await db.notification.updateMany({ where, data: { readAt: new Date() } })
    return NextResponse.json({ data: { markedRead: count } })
  } catch (err) {
    return authErrorResponse(err)
  }
}
