export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth/guards'
import { updateInquiryStatusSchema } from '@/modules/inquiries/validation'
import { updateInquiryStatus } from '@/modules/inquiries/service'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth()
    let body: unknown
    try { body = await req.json() } catch {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } }, { status: 400 })
    }
    const parsed = updateInquiryStatusSchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid status', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      )
    const data = await updateInquiryStatus(params.id, parsed.data.status, user.id)
    return NextResponse.json({ data })
  } catch (err) {
    return authErrorResponse(err)
  }
}
