export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth/guards'
import { getLogistics } from '@/modules/logistics/service'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth()
    const data = await getLogistics(params.id, user.id)
    return NextResponse.json({ data })
  } catch (err) {
    const e = err as { status?: number; code?: string; message?: string }
    if (e.status) return NextResponse.json({ error: { code: e.code ?? 'ERROR', message: e.message } }, { status: e.status })
    return authErrorResponse(err)
  }
}
