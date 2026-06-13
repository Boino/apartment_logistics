import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { requireAuth, authErrorResponse } from '@/lib/auth/guards'
import { db } from '@/lib/db'

export async function DELETE() {
  try {
    const user = await requireAuth()

    await db.$transaction(async (tx) => {
      // Anonymize messages (GDPR)
      await tx.message.updateMany({
        where: { senderId: user.id },
        data: { body: '[Message removed]', senderId: null },
      })

      // Anonymize inquiry comments
      await tx.inquiry.updateMany({
        where: { guestId: user.id },
        data: { comments: null },
      })

      // Archive listings
      await tx.listing.updateMany({
        where: { hostId: user.id },
        data: { status: 'ARCHIVED' },
      })

      // Anonymize damage reports
      await tx.damageReport.updateMany({
        where: { reporterId: user.id },
        data: { reporterId: null },
      })

      // Notifications cascade via DB; delete manually in transaction
      await tx.notification.deleteMany({ where: { userId: user.id } })

      // Delete the user (remaining FK refs are nullable)
      await tx.user.delete({ where: { id: user.id } })
    })

    return NextResponse.json({ data: { message: 'Account deleted' } })
  } catch (err) {
    return authErrorResponse(err)
  }
}
