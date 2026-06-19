import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { requireAuth, authErrorResponse } from '@/lib/auth/guards'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const session = await requireAuth()
    const user = await db.user.findUnique({
      where: { id: session.id },
      select: { id: true, name: true, email: true, phone: true, isHost: true, createdAt: true },
    })
    if (!user) return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, { status: 404 })
    return NextResponse.json({ data: user })
  } catch (err) {
    return authErrorResponse(err)
  }
}
