export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth/guards'
import { createLinenSet } from '@/modules/logistics/service'
import { createLinenSetSchema } from '@/modules/logistics/validation'
import { z } from 'zod'

const createWithListingSchema = createLinenSetSchema.extend({ listingId: z.string().min(1) })

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json().catch(() => ({}))
    const parsed = createWithListingSchema.safeParse(body)
    if (!parsed.success) {
      const fields = Object.fromEntries(parsed.error.errors.map((e) => [e.path.join('.'), e.message]))
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', fields } }, { status: 422 })
    }
    const { listingId, ...input } = parsed.data
    const set = await createLinenSet(listingId, user.id, input)
    return NextResponse.json({ data: set }, { status: 201 })
  } catch (err) {
    const e = err as { status?: number; code?: string; message?: string }
    if (e.status) return NextResponse.json({ error: { code: e.code ?? 'ERROR', message: e.message } }, { status: e.status })
    return authErrorResponse(err)
  }
}
