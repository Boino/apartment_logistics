import { db } from '@/lib/db'
import { notify } from '@/lib/notify'
import { setBooked, releaseBooked } from '@/modules/availability/service'
import { addHours, startOfDay, format } from 'date-fns'
import type { CreateStayInput, UpdateStayInput, ConvertToStayInput } from './validation'

const appUrl = () => process.env.APP_URL ?? 'http://localhost:3000'

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getListingStays(listingId: string, userId: string) {
  const listing = await db.listing.findUnique({ where: { id: listingId }, select: { hostId: true } })
  if (!listing) throw Object.assign(new Error('Listing not found'), { status: 404 })
  if (listing.hostId !== userId) throw Object.assign(new Error('Not authorized'), { status: 403 })

  return db.stay.findMany({
    where: { listingId },
    orderBy: { checkinAt: 'asc' },
  })
}

export async function getStay(stayId: string, userId: string) {
  const stay = await db.stay.findUnique({
    where: { id: stayId },
    include: { listing: { select: { hostId: true, title: true } } },
  })
  if (!stay) throw Object.assign(new Error('Stay not found'), { status: 404 })
  if (stay.listing.hostId !== userId) throw Object.assign(new Error('Not authorized'), { status: 403 })
  return stay
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createStay(userId: string, input: CreateStayInput) {
  const listing = await db.listing.findUnique({
    where: { id: input.listingId },
    select: { hostId: true, title: true },
  })
  if (!listing) throw Object.assign(new Error('Listing not found'), { status: 404 })
  if (listing.hostId !== userId) throw Object.assign(new Error('Not authorized'), { status: 403 })

  const checkin = new Date(input.checkinAt)
  const checkout = new Date(input.checkoutAt)

  await assertNoOverlap(input.listingId, checkin, checkout)

  const stay = await db.$transaction(async (tx) => {
    const created = await tx.stay.create({
      data: {
        listingId: input.listingId,
        guestName: input.guestName,
        numGuests: input.numGuests,
        checkinAt: checkin,
        checkoutAt: checkout,
        notes: input.notes,
        status: 'UPCOMING',
      },
    })
    await tx.availabilityBlock.create({
      data: {
        listingId: input.listingId,
        startDate: startOfDay(checkin),
        endDate: startOfDay(checkout),
        status: 'BOOKED',
      },
    })
    return created
  })

  return stay
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateStay(stayId: string, userId: string, input: UpdateStayInput) {
  const stay = await getStay(stayId, userId)

  if ((input.checkinAt || input.checkoutAt) && stay.status !== 'CANCELLED') {
    const newCheckin = input.checkinAt ? new Date(input.checkinAt) : stay.checkinAt
    const newCheckout = input.checkoutAt ? new Date(input.checkoutAt) : stay.checkoutAt
    await releaseBooked(stay.listingId, stay.checkinAt, stay.checkoutAt)
    await assertNoOverlap(stay.listingId, newCheckin, newCheckout, stayId)
    await setBooked(stay.listingId, startOfDay(newCheckin), startOfDay(newCheckout))
  }

  return db.stay.update({
    where: { id: stayId },
    data: {
      ...(input.guestName && { guestName: input.guestName }),
      ...(input.numGuests !== undefined && { numGuests: input.numGuests }),
      ...(input.checkinAt && { checkinAt: new Date(input.checkinAt) }),
      ...(input.checkoutAt && { checkoutAt: new Date(input.checkoutAt) }),
      ...(input.status && { status: input.status }),
      ...(input.notes !== undefined && { notes: input.notes }),
    },
  })
}

// ── Cancel ────────────────────────────────────────────────────────────────────

export async function cancelStay(stayId: string, userId: string) {
  const stay = await getStay(stayId, userId)
  if (stay.status === 'CANCELLED') throw Object.assign(new Error('Already cancelled'), { status: 400 })
  if (stay.status === 'COMPLETED') throw Object.assign(new Error('Cannot cancel a completed stay'), { status: 400 })

  await releaseBooked(stay.listingId, stay.checkinAt, stay.checkoutAt)
  return db.stay.update({ where: { id: stayId }, data: { status: 'CANCELLED' } })
}

// ── Convert inquiry → stay ────────────────────────────────────────────────────

export async function convertInquiryToStay(
  inquiryId: string,
  userId: string,
  input: ConvertToStayInput,
) {
  const inquiry = await db.inquiry.findUnique({
    where: { id: inquiryId },
    include: {
      listing: { select: { hostId: true, title: true } },
      guest: { select: { name: true } },
    },
  })
  if (!inquiry) throw Object.assign(new Error('Inquiry not found'), { status: 404 })
  if (inquiry.listing.hostId !== userId) throw Object.assign(new Error('Not authorized'), { status: 403 })
  if (inquiry.status === 'DECLINED') throw Object.assign(new Error('Cannot convert a declined inquiry'), { status: 400 })

  const checkin = new Date(input.checkinAt)
  const checkout = new Date(input.checkoutAt)

  await assertNoOverlap(inquiry.listingId, checkin, checkout)

  const stay = await db.$transaction(async (tx) => {
    await tx.inquiry.update({ where: { id: inquiryId }, data: { status: 'CONFIRMED' } })
    const created = await tx.stay.create({
      data: {
        listingId: inquiry.listingId,
        inquiryId,
        guestName: inquiry.guest.name,
        numGuests: inquiry.numGuests,
        checkinAt: checkin,
        checkoutAt: checkout,
        notes: input.notes,
        status: 'UPCOMING',
      },
    })
    await tx.availabilityBlock.create({
      data: {
        listingId: inquiry.listingId,
        startDate: startOfDay(checkin),
        endDate: startOfDay(checkout),
        status: 'BOOKED',
      },
    })
    return created
  })

  await notify(inquiry.guestId, 'STAY_CONFIRMED', {
    title: `Your stay at ${inquiry.listing.title} is confirmed`,
    body: `Check-in: ${format(checkin, 'dd MMM yyyy HH:mm')} · Check-out: ${format(checkout, 'dd MMM yyyy HH:mm')}`,
    link: `/inquiries`,
  })

  return stay
}

// ── Cron: hourly status flip ──────────────────────────────────────────────────

export async function runHourlyCron() {
  const now = new Date()

  const [toInHouse, toCompleted] = await Promise.all([
    db.stay.findMany({
      where: { status: 'UPCOMING', checkinAt: { lte: now } },
      select: { id: true },
    }),
    db.stay.findMany({
      where: { status: 'IN_HOUSE', checkoutAt: { lte: now } },
      select: { id: true },
    }),
  ])

  await db.$transaction([
    db.stay.updateMany({
      where: { id: { in: toInHouse.map((s) => s.id) } },
      data: { status: 'IN_HOUSE' },
    }),
    db.stay.updateMany({
      where: { id: { in: toCompleted.map((s) => s.id) } },
      data: { status: 'COMPLETED' },
    }),
  ])

  return { flippedToInHouse: toInHouse.length, flippedToCompleted: toCompleted.length }
}

// ── Cron: daily arrival/departure notifications ───────────────────────────────

export async function runDailyCron() {
  const now = new Date()
  const in24h = addHours(now, 24)
  const todayKey = format(now, 'yyyy-MM-dd')

  const arriving = await db.stay.findMany({
    where: {
      status: 'UPCOMING',
      checkinAt: { gte: now, lte: in24h },
    },
    include: {
      listing: {
        select: {
          id: true, title: true, hostId: true,
          host: { select: { email: true, name: true } },
        },
      },
    },
  })

  const departing = await db.stay.findMany({
    where: {
      status: 'IN_HOUSE',
      checkoutAt: { gte: now, lte: in24h },
    },
    include: {
      listing: {
        select: {
          id: true, title: true, hostId: true,
          host: { select: { email: true, name: true } },
        },
      },
    },
  })

  let arrivingNotified = 0
  let departingNotified = 0

  for (const stay of arriving) {
    const alreadyNotified = await db.notification.count({
      where: {
        userId: stay.listing.hostId,
        type: 'GUEST_ARRIVING',
        link: `/host/stays`,
        createdAt: { gte: startOfDay(now) },
      },
    }) > 0
    if (alreadyNotified) continue

    const checkinTime = format(stay.checkinAt, 'dd MMM HH:mm')
    const msg = `${stay.guestName} arrives at ${checkinTime} (${stay.numGuests} guest${stay.numGuests !== 1 ? 's' : ''})`

    await notify(stay.listing.hostId, 'GUEST_ARRIVING', {
      title: `Guest arriving today at ${stay.listing.title}`,
      body: msg,
      link: `/host/stays`,
      email: {
        to: stay.listing.host.email,
        subject: `Guest arriving today — ${stay.listing.title}`,
        html: buildArrivalEmail({ hostName: stay.listing.host.name, guestName: stay.guestName, checkinTime, listingTitle: stay.listing.title, stayLink: `${appUrl()}/host/stays` }),
      },
    })

    const acceptedStaff = await db.prepSlot.findMany({
      where: {
        listingId: stay.listingId,
        status: 'ACCEPTED',
        incomingStayId: stay.id,
      },
      include: { staffUser: { select: { id: true, email: true, name: true } } },
    })

    for (const slot of acceptedStaff) {
      await notify(slot.staffUserId, 'GUEST_ARRIVING', {
        title: `Guest arriving at ${stay.listing.title}`,
        body: msg,
        link: `/staff`,
        email: {
          to: slot.staffUser.email,
          subject: `Guest arriving today — ${stay.listing.title}`,
          html: buildArrivalEmail({ hostName: slot.staffUser.name, guestName: stay.guestName, checkinTime, listingTitle: stay.listing.title, stayLink: `${appUrl()}/staff` }),
        },
      })
    }

    arrivingNotified++
  }

  for (const stay of departing) {
    const alreadyNotified = await db.notification.count({
      where: {
        userId: stay.listing.hostId,
        type: 'GUEST_LEAVING',
        link: `/host/stays`,
        createdAt: { gte: startOfDay(now) },
      },
    }) > 0
    if (alreadyNotified) continue

    const checkoutTime = format(stay.checkoutAt, 'dd MMM HH:mm')
    const msg = `${stay.guestName} checks out at ${checkoutTime}`

    await notify(stay.listing.hostId, 'GUEST_LEAVING', {
      title: `Guest checking out today from ${stay.listing.title}`,
      body: msg,
      link: `/host/stays`,
      email: {
        to: stay.listing.host.email,
        subject: `Guest checking out today — ${stay.listing.title}`,
        html: buildDepartureEmail({ hostName: stay.listing.host.name, guestName: stay.guestName, checkoutTime, listingTitle: stay.listing.title, stayLink: `${appUrl()}/host/stays` }),
      },
    })

    const acceptedStaff = await db.prepSlot.findMany({
      where: {
        listingId: stay.listingId,
        status: 'ACCEPTED',
        outgoingStayId: stay.id,
      },
      include: { staffUser: { select: { id: true, email: true, name: true } } },
    })

    for (const slot of acceptedStaff) {
      await notify(slot.staffUserId, 'GUEST_LEAVING', {
        title: `Guest checking out at ${stay.listing.title}`,
        body: msg,
        link: `/staff`,
        email: {
          to: slot.staffUser.email,
          subject: `Guest checking out today — ${stay.listing.title}`,
          html: buildDepartureEmail({ hostName: slot.staffUser.name, guestName: stay.guestName, checkoutTime, listingTitle: stay.listing.title, stayLink: `${appUrl()}/staff` }),
        },
      })
    }

    departingNotified++
  }

  return { arrivingNotified, departingNotified, todayKey }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function assertNoOverlap(
  listingId: string,
  checkin: Date,
  checkout: Date,
  excludeStayId?: string,
) {
  const overlap = await db.stay.findFirst({
    where: {
      listingId,
      status: { in: ['UPCOMING', 'IN_HOUSE'] },
      id: excludeStayId ? { not: excludeStayId } : undefined,
      checkinAt: { lt: checkout },
      checkoutAt: { gt: checkin },
    },
  })
  if (overlap) throw Object.assign(new Error('This date range overlaps an existing stay'), { status: 409, code: 'STAY_OVERLAP' })
}

function buildArrivalEmail(d: { hostName: string; guestName: string; checkinTime: string; listingTitle: string; stayLink: string }) {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#222">
      <h2 style="color:#1d7464">Guest arriving today — ${d.listingTitle}</h2>
      <p>Hi ${d.hostName},</p>
      <p><strong>${d.guestName}</strong> is scheduled to arrive at <strong>${d.checkinTime}</strong>.</p>
      <p><a href="${d.stayLink}" style="background:#1d7464;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px">View stay details</a></p>
    </div>
  `
}

function buildDepartureEmail(d: { hostName: string; guestName: string; checkoutTime: string; listingTitle: string; stayLink: string }) {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#222">
      <h2 style="color:#1d7464">Guest checking out today — ${d.listingTitle}</h2>
      <p>Hi ${d.hostName},</p>
      <p><strong>${d.guestName}</strong> is scheduled to check out at <strong>${d.checkoutTime}</strong>.</p>
      <p><a href="${d.stayLink}" style="background:#1d7464;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px">View stay details</a></p>
    </div>
  `
}
