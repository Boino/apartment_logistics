import { db } from '@/lib/db'
import { sendEmail } from '@/lib/email/send'
import { parseISO, differenceInDays } from 'date-fns'
import type { CreateInquiryInput } from './validation'
import { calcStayPrice } from './pricing'

export { calcStayPrice }

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
  if (nights < listing.minStay)
    throw new Error(`Minimum stay is ${listing.minStay} night(s)`)
  if (listing.maxStay && nights > listing.maxStay)
    throw new Error(`Maximum stay is ${listing.maxStay} night(s)`)
  if (input.numGuests > listing.maxGuests)
    throw new Error(`This listing accommodates up to ${listing.maxGuests} guests`)

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
    data: {
      threadId: thread.id,
      senderId: guestId,
      body: input.message,
    },
  })

  const { total, discountPct } = calcStayPrice(listing.basePrice, nights)

  // notify host by email (fire-and-forget, don't fail the request)
  sendEmail({
    to: listing.host.email,
    subject: `New inquiry for ${listing.title}`,
    template: 'inquiry-new',
    data: {
      hostName: listing.host.name,
      guestName,
      listingTitle: listing.title,
      checkinDate: input.checkinDate,
      checkoutDate: input.checkoutDate,
      nights,
      numGuests: input.numGuests,
      total: total.toFixed(2),
      currency: listing.currency,
      discountPct,
      message: input.message,
    },
    html: buildInquiryEmail({
      hostName: listing.host.name,
      guestName,
      listingTitle: listing.title,
      checkinDate: input.checkinDate,
      checkoutDate: input.checkoutDate,
      nights,
      numGuests: input.numGuests,
      total,
      currency: listing.currency,
      discountPct,
      message: input.message,
    }),
  }).catch((err) => console.error('[inquiry email]', err))

  return { inquiry, threadId: thread.id }
}

function buildInquiryEmail(d: {
  hostName: string; guestName: string; listingTitle: string
  checkinDate: string; checkoutDate: string; nights: number; numGuests: number
  total: number; currency: string; discountPct: number; message: string
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
      <p style="margin-top:24px">Log in to StayBase to reply.</p>
    </div>
  `
}
