export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createInquirySchema } from '@/modules/inquiries/validation'
import { createInquiry } from '@/modules/inquiries/service'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Sign in to send an inquiry' } },
      { status: 401 }
    )
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } }, { status: 400 })
  }

  const parsed = createInquirySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid input', fields: parsed.error.flatten().fieldErrors } },
      { status: 422 }
    )
  }

  try {
    const result = await createInquiry(session.user.id, parsed.data)
    return NextResponse.json({ data: result }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    const status = (err as { status?: number }).status ?? 422
    return NextResponse.json({ error: { code: 'ERROR', message } }, { status })
  }
}
