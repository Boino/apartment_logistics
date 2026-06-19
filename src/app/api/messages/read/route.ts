export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth/guards'
import { markThreadRead } from '@/modules/inquiries/service'
import { z } from 'zod'

const schema = z.object({ threadId: z.string().min(1) })

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'threadId required' } }, { status: 422 })
    await markThreadRead(parsed.data.threadId, user.id)
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    return authErrorResponse(err)
  }
}
