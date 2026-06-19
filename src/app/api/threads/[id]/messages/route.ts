export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireParticipant, authErrorResponse } from '@/lib/auth/guards'
import { postMessageSchema } from '@/modules/inquiries/validation'
import { getThread, postThreadMessage, markThreadRead } from '@/modules/inquiries/service'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireParticipant(params.id)
    const thread = await getThread(params.id, user.id)
    await markThreadRead(params.id, user.id)
    return NextResponse.json({ data: thread.messages })
  } catch (err) {
    return authErrorResponse(err)
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireParticipant(params.id)
    let body: unknown
    try { body = await req.json() } catch {
      return NextResponse.json({ error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } }, { status: 400 })
    }
    const parsed = postMessageSchema.safeParse(body)
    if (!parsed.success)
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid input', fields: parsed.error.flatten().fieldErrors } },
        { status: 422 }
      )
    const message = await postThreadMessage(params.id, user.id, parsed.data.body)
    return NextResponse.json({ data: message }, { status: 201 })
  } catch (err) {
    return authErrorResponse(err)
  }
}
