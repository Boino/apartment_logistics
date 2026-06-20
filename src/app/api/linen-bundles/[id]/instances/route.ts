export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth/guards'
import { getBundleInstances, createBundleInstance } from '@/modules/logistics/service'
import { createBundleInstanceSchema } from '@/modules/logistics/validation'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth()
    const data = await getBundleInstances(params.id, user.id)
    return NextResponse.json({ data })
  } catch (err) {
    const e = err as { status?: number; code?: string; message?: string }
    if (e.status) return NextResponse.json({ error: { code: e.code ?? 'ERROR', message: e.message } }, { status: e.status })
    return authErrorResponse(err)
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth()
    const body = await req.json().catch(() => ({}))
    const parsed = createBundleInstanceSchema.safeParse(body)
    if (!parsed.success) {
      const fields = Object.fromEntries(parsed.error.errors.map((e) => [e.path.join('.'), e.message]))
      return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Invalid input', fields } }, { status: 422 })
    }
    const instance = await createBundleInstance(params.id, user.id, parsed.data)
    return NextResponse.json({ data: instance }, { status: 201 })
  } catch (err) {
    const e = err as { status?: number; code?: string; message?: string }
    if (e.status) return NextResponse.json({ error: { code: e.code ?? 'ERROR', message: e.message } }, { status: e.status })
    return authErrorResponse(err)
  }
}
