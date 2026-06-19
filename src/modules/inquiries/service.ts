import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email/send'
import { parseISO, differenceInDays } from 'date-fns'
import type { CreateInquiryInput } from './validation'
import { calcStayPrice } from './pricing'

export { calcStayPrice }

// ── Create inquiry ────────────────────────────────────────────────────────────

export async function createInquiry(guestId: string, input: CreateInquiryInput) {
  const checkin = parseISO(input.checkinDate)
  const checkout = parseISO(input.checkoutDate)

  const listing = await db.listing.findUnique({
    where: { id: input.listingId },
    include: { host: { select: { email: true, name: true } } },
  })
  if (!listing) throw Object.assign(new Error('Listing not found'), { status: 404 })

  const nights = differenceInDays(checkout, checkin)
  if (nights < 1) throw new Error('Check-out must be after check-in')
  if (nights < listing.minStay) throw new Error(`Minimum stay is ${listing.minStay} night(s)`)
  if (listing.maxStay && nights > listing.maxStay) throw new Error(`Maximum stay is ${listing.maxStay} night(s)`)
  if (input.numGuests > listing.maxGuests) throw new Error(`This listing accommodates up to ${listing.maxGuests} guests`)

  const guest = await db.user.findUnique({ where: { id: guestId }, select: { name: true, email: true } })
  const guestName = guest?.name ?? 'Guest'

  const inquiry = await db.inquiry.create({
    data: {
      listingId: input.listingId,
      guestId,
      checkinDate: checkin,
      checkoutDate: checkout,
      numGuests: input.numGuests,
      comments: input.message,
      status: 'OPEN',
    },
  })

  const thread = await db.thread.create({ data: { inquiryId: inquiry.id } })

  await db.message.create({
    data: { threadId: thread.id, senderId: guestId, body: input.message },
  })

  const { total, discountPct } = calcStayPrice(listing.basePrice, nights)
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000'

  await db.notification.create({
    data: {
      userId: listing.hostId,
      type: 'INQUIRY_RECEIVED',
      title: `New inquiry for ${listing.title}`,
      body: `${guestName} wants to stay ${input.checkinDate} → ${input.checkoutDate}`,
      link: `/host/inquiries/${inquiry.id}`,
    },
  })

  sendEmail({
    to: listing.host.email,
    subject: `New inquiry for ${listing.title}`,
    template: 'inquiry-new',
    data: {
      hostName: listing.host.name, guestName, listingTitle: listing.title,
      checkinDate: input.checkinDate, checkoutDate: input.checkoutDate,
      nights, numGuests: input.numGuests, total: total.toFixed(2),
      currency: listing.currency, discountPct, message: input.message,
    },
    html: buildInquiryEmail({
      hostName: listing.host.name, guestName, listingTitle: listing.title,
      checkinDate: input.checkinDate, checkoutDate: input.checkoutDate,
      nights, numGuests: input.numGuests, total, currency: listing.currency,
      discountPct, message: input.message,
      threadLink: `${appUrl}/host/inquiries/${inquiry.id}`,
    }),
  }).catch((err) => console.error('[inquiry email]', err))

  return { inquiry, threadId: thread.id }
}

// ── List inquiries ────────────────────────────────────────────────────────────

export async function getGuestInquiries(guestId: string) {
  return db.inquiry.findMany({
    where: { guestId },
    orderBy: { createdAt: 'desc' },
    include: {
      listing: {
        select: {
          id: true, title: true, currency: true,
          photos: { where: { isCover: true }, take: 1, select: { url: true } },
        },
      },
      thread: {
        include: {
          messages: {
            orderBy: { createdAt: 'desc' }, take: 1,
            select: { id: true, body: true, createdAt: true, senderId: true },
          },
        },
      },
    },
  })
}

export async function getHostInquiries(hostId: string, listingId?: string, status?: string) {
  return db.inquiry.findMany({
    where: {
      listing: { hostId },
      ...(listingId ? { listingId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      listing: { select: { id: true, title: true, currency: true } },
      guest: { select: { name: true, email: true } },
      thread: {
        include: {
          messages: {
            orderBy: { createdAt: 'desc' }, take: 1,
            select: { id: true, body: true, createdAt: true, senderId: true },
          },
        },
      },
    },
  })
}

// ── Thread & messages ─────────────────────────────────────────────────────────

export async function getThread(threadId: string, userId: string) {
  const thread = await db.thread.findUnique({
    where: { id: threadId },
    include: {
      inquiry: {
        include: {
          listing: {
            select: {
              id: true, title: true, hostId: true, currency: true,
              checkInTime: true, checkOutTime: true,
              photos: { where: { isCover: true }, take: 1, select: { url: true } },
            },
          },
          guest: { select: { id: true, name: true, email: true } },
        },
      },
      messages: {
        orderBy: { createdAt: 'asc' },
        include: { sender: { select: { id: true, name: true } } },
      },
    },
  })

  if (!thread) throw Object.assign(new Error('Thread not found'), { status: 404 })
  const isParticipant =
    thread.inquiry.guestId === userId || thread.inquiry.listing.hostId === userId
  if (!isParticipant) throw Object.assign(new Error('Not authorized'), { status: 403 })

  return thread
}

export async function getThreadByInquiry(inquiryId: string, userId: string) {
  const inquiry = await db.inquiry.findUnique({
    where: { id: inquiryId },
    include: { thread: true, listing: { select: { hostId: true } } },
  })
  if (!inquiry) throw Object.assign(new Error('Inquiry not found'), { status: 404 })
  if (inquiry.listing.hostId !== userId && inquiry.guestId !== userId)
    throw Object.assign(new Error('Not authorized'), { status: 403 })
  if (!inquiry.thread) throw Object.assign(new Error('Thread not found'), { status: 404 })
  return getThread(inquiry.thread.id, userId)
}

export async function postThreadMessage(threadId: string, senderId: string, body: string) {
  const thread = await db.thread.findUnique({
    where: { id: threadId },
    include: {
      inquiry: {
        include: {
          listing: { select: { id: true, title: true, hostId: true } },
          guest: { select: { id: true, name: true, email: true } },
        },
      },
    },
  })

  if (!thread) throw Object.assign(new Error('Thread not found'), { status: 404 })
  const { inquiry } = thread
  const isGuest = inquiry.guestId === senderId
  const isHost = inquiry.listing.hostId === senderId
  if (!isGuest && !isHost) throw Object.assign(new Error('Not authorized'), { status: 403 })

  const message = await db.message.create({
    data: { threadId, senderId, body },
    include: { sender: { select: { id: true, name: true } } },
  })

  if (isHost && inquiry.status === 'OPEN') {
    await db.inquiry.update({ where: { id: inquiry.id }, data: { status: 'ANSWERED' } })
  }

  const recipientId = isHost ? inquiry.guestId : inquiry.listing.hostId
  const senderName = isHost ? 'Your host' : inquiry.guest.name
  const appUrl = process.env.APP_URL ?? 'http://localhost:3000'
  const threadLink = isHost
    ? `${appUrl}/inquiries/${threadId}`
    : `${appUrl}/host/inquiries/${inquiry.id}`

  const recipient = await db.user.findUnique({
    where: { id: recipientId },
    select: { email: true, name: true },
  })

  if (recipient) {
    await db.notification.create({
      data: {
        userId: recipientId,
        type: 'THREAD_MESSAGE',
        title: `New message about ${inquiry.listing.title}`,
        body: body.slice(0, 100),
        link: isHost ? `/inquiries/${threadId}` : `/host/inquiries/${inquiry.id}`,
      },
    })

    sendEmail({
      to: recipient.email,
      subject: `New message about ${inquiry.listing.title}`,
      template: 'inquiry-reply',
      data: {
        recipientName: recipient.name, senderName,
        listingTitle: inquiry.listing.title,
        messagePreview: body.slice(0, 200), threadLink,
      },
      html: buildReplyEmail({
        recipientName: recipient.name, senderName,
        listingTitle: inquiry.listing.title,
        messagePreview: body.slice(0, 200), threadLink,
      }),
    }).catch((err) => console.error('[reply email]', err))
  }

  return message
}

export async function markThreadRead(threadId: string, userId: string) {
  await db.message.updateMany({
    where: { threadId, senderId: { not: userId }, readAt: null },
    data: { readAt: new Date() },
  })
}

// ── Status update ─────────────────────────────────────────────────────────────

export async function updateInquiryStatus(inquiryId: string, status: string, userId: string) {
  const inquiry = await db.inquiry.findUnique({
    where: { id: inquiryId },
    include: { listing: { select: { hostId: true } } },
  })
  if (!inquiry) throw Object.assign(new Error('Inquiry not found'), { status: 404 })
  if (inquiry.listing.hostId !== userId)
    throw Object.assign(new Error('Not authorized'), { status: 403 })

  return db.inquiry.update({ where: { id: inquiryId }, data: { status } })
}

// ── Email templates ───────────────────────────────────────────────────────────

function buildInquiryEmail(d: {
  hostName: string; guestName: string; listingTitle: string
  checkinDate: string; checkoutDate: string; nights: number; numGuests: number
  total: number; currency: string; discountPct: number; message: string; threadLink: string
}): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#222">
      <h2 style="color:#1d7464">New inquiry — ${d.listingTitle}</h2>
      <p>Hi ${d.hostName},</p>
      <p><strong>${d.guestName}</strong> has sent an inquiry for your listing.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:6px 0;color:#666">Check-in</td><td><strong>${d.checkinDate}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666">Check-out</td><td><strong>${d.checkoutDate}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666">Nights</td><td><strong>${d.nights}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666">Guests</td><td><strong>${d.numGuests}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#666">Estimated total</td>
            <td><strong>${d.currency} ${d.total.toFixed(2)}</strong>${d.discountPct ? ` (${d.discountPct}% long-stay discount)` : ''}</td></tr>
      </table>
      <p style="background:#f5f5f5;padding:12px;border-radius:4px;white-space:pre-wrap">${d.message}</p>
      <p><a href="${d.threadLink}" style="background:#1d7464;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px">Reply in StayBase</a></p>
    </div>
  `
}

function buildReplyEmail(d: {
  recipientName: string; senderName: string; listingTitle: string
  messagePreview: string; threadLink: string
}): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#222">
      <h2 style="color:#1d7464">New message — ${d.listingTitle}</h2>
      <p>Hi ${d.recipientName},</p>
      <p><strong>${d.senderName}</strong> sent you a message:</p>
      <p style="background:#f5f5f5;padding:12px;border-radius:4px;white-space:pre-wrap">${d.messagePreview}${d.messagePreview.length >= 200 ? '…' : ''}</p>
      <p><a href="${d.threadLink}" style="background:#1d7464;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px">Open conversation</a></p>
    </div>
  `
}
