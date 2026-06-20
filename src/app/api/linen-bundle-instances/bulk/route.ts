export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth/guards'
import { bulkUpdateBundleInstanceState } from '@/modules/logistics/service'
import { bulkBundleInstanceStateSchema } from '@/modules/logistics/validation'

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireAuth()
    const body = await req.json().catch(() => ({}))
    const parsed = bulkBundleInstanceStateSchema.safeParse(body)
    if (!parsed.success) {
      const fields = Object.fromEntries(parsed.error.errors.map((e) => [e.path.join('.'), e.message]))
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', fields } }, { status: 422 })
    }
    const result = await bulkUpdateBundleInstanceState(parsed.data.listingId, user.id, parsed.data)
    return NextResponse.json({ data: result })
  } catch (err) {
    const e = err as { status?: number; code?: string; message?: string }
    if (e.status) return NextResponse.json({ error: { code: e.code ?? 'ERROR', message: e.message } }, { status: e.status })
    return authErrorResponse(err)
  }
}
