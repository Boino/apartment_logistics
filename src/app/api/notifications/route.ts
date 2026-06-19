export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { requireAuth, authErrorResponse } from '@/lib/auth/guards'
import { db } from '@/lib/db'

export async function GET() {
  try {
    const user = await requireAuth()
    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      db.notification.count({ where: { userId: user.id, readAt: null } }),
    ])
    return NextResponse.json({ data: { notifications, unreadCount } })
  } catch (err) {
    return authErrorResponse(err)
  }
}
