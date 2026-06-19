export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth/guards'
import { createDamageReport } from '@/modules/logistics/service'
import { createDamageReportSchema } from '@/modules/logistics/validation'
import { z } from 'zod'

const schema = createDamageReportSchema.extend({ prepSlotId: z.string().optional() })

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth()
    const body = await req.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      const fields = Object.fromEntries(parsed.error.errors.map((e) => [e.path.join('.'), e.message]))
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', fields } }, { status: 422 })
    }
    const { prepSlotId, ...input } = parsed.data
    const report = await createDamageReport(params.id, user.id, input, prepSlotId)
    return NextResponse.json({ data: report }, { status: 201 })
  } catch (err) {
    const e = err as { status?: number; code?: string; message?: string }
    if (e.status) return NextResponse.json({ error: { code: e.code ?? 'ERROR', message: e.message } }, { status: e.status })
    return authErrorResponse(err)
  }
}
