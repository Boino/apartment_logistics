export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, requireListingOwner, authErrorResponse } from '@/lib/auth/guards'
import { createStay, getListingStays } from '@/modules/stays/service'
import { createStaySchema } from '@/modules/stays/validation'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireListingOwner(params.id)
    const stays = await getListingStays(params.id, user.id)
    return NextResponse.json({ data: stays })
  } catch (err) {
    return authErrorResponse(err)
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth()
    const body = await req.json().catch(() => ({}))
    const parsed = createStaySchema.safeParse({ ...body, listingId: params.id })
    if (!parsed.success) {
      const fields = Object.fromEntries(
        parsed.error.errors.map((e) => [e.path.join('.'), e.message])
      )
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', fields } }, { status: 422 })
    }
    const stay = await createStay(user.id, parsed.data)
    return NextResponse.json({ data: stay }, { status: 201 })
  } catch (err) {
    const e = err as { status?: number; code?: string; message?: string }
    if (e.status) return NextResponse.json({ error: { code: e.code ?? 'ERROR', message: e.message } }, { status: e.status })
    return authErrorResponse(err)
  }
}
