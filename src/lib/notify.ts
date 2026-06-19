import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email/send'

export type NotifyPayload = {
  title: string
  body: string
  link?: string
  email?: { to: string; subject: string; html: string }
}

export async function notify(userId: string, type: string, payload: NotifyPayload): Promise<void> {
  await db.notification.create({
    data: { userId, type, title: payload.title, body: payload.body, link: payload.link },
  })

  if (payload.email) {
    sendEmail({
      to: payload.email.to,
      subject: payload.email.subject,
      template: type,
      data: {},
      html: payload.email.html,
    }).catch((err) => console.error(`[notify:${type}] email error:`, err))
  }
}
