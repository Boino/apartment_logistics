export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth/guards'
import { convertInquiryToStay } from '@/modules/stays/service'
import { convertToStaySchema } from '@/modules/stays/validation'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth()
    const body = await req.json().catch(() => ({}))
    const parsed = convertToStaySchema.safeParse(body)
    if (!parsed.success) {
      const fields = Object.fromEntries(
        parsed.error.errors.map((e) => [e.path.join('.'), e.message])
      )
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', fields } }, { status: 422 })
    }
    const stay = await convertInquiryToStay(params.id, user.id, parsed.data)
    return NextResponse.json({ data: stay }, { status: 201 })
  } catch (err) {
    const e = err as { status?: number; code?: string; message?: string }
    if (e.status) return NextResponse.json({ error: { code: e.code ?? 'ERROR', message: e.message } }, { status: e.status })
    return authErrorResponse(err)
  }
}
