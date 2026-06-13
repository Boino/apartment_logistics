import { db } from '@/lib/db'
import { BlockStatus } from '@/lib/enums'
import { addDays, format, isBefore, parseISO, startOfDay } from 'date-fns'

export type DayInfo = {
  date: string // YYYY-MM-DD
  status: BlockStatus
  price: number | null
}

export async function getCalendar(
  listingId: string,
  from: Date,
  to: Date
): Promise<DayInfo[]> {
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: { basePrice: true },
  })
  if (!listing) throw new Error('Listing not found')

  // fetch all blocks that overlap the requested range
  const blocks = await db.availabilityBlock.findMany({
    where: {
      listingId,
      startDate: { lte: to },
      endDate: { gte: from },
    },
    orderBy: { startDate: 'asc' },
  })

  const days: DayInfo[] = []
  let cursor = startOfDay(from)
  const end = startOfDay(to)

  while (!isBefore(end, cursor)) {
    const key = format(cursor, 'yyyy-MM-dd')
    // find the most specific block covering this day (last one wins for overlaps)
    const block = blocks.findLast(
      (b) => !isBefore(cursor, startOfDay(b.startDate)) && !isBefore(startOfDay(b.endDate), cursor)
    )
    days.push({
      date: key,
      status: (block?.status as BlockStatus) ?? BlockStatus.AVAILABLE,
      price: block?.nightlyPrice ? Number(block.nightlyPrice) : Number(listing.basePrice),
    })
    cursor = addDays(cursor, 1)
  }
  return days
}

export type CalendarUpdate = {
  from: string // YYYY-MM-DD
  to: string
  status: BlockStatus
  price?: number
}

export async function updateCalendar(
  listingId: string,
  updates: CalendarUpdate[]
): Promise<void> {
  await db.$transaction(
    updates.map((u) =>
      db.availabilityBlock.create({
        data: {
          listingId,
          startDate: parseISO(u.from),
          endDate: parseISO(u.to),
          status: u.status,
          ...(u.price !== undefined && { nightlyPrice: u.price }),
        },
      })
    )
  )
}

export async function setBooked(listingId: string, from: Date, to: Date): Promise<void> {
  await updateCalendar(listingId, [
    { from: format(from, 'yyyy-MM-dd'), to: format(to, 'yyyy-MM-dd'), status: BlockStatus.BOOKED },
  ])
}

export async function releaseBooked(listingId: string, from: Date, to: Date): Promise<void> {
  // remove BOOKED blocks in range — exposing underlying AVAILABLE/BLOCKED
  await db.availabilityBlock.deleteMany({
    where: {
      listingId,
      status: BlockStatus.BOOKED,
      startDate: { gte: from },
      endDate: { lte: to },
    },
  })
}

export async function isRangeAvailable(
  listingId: string,
  from: Date,
  to: Date
): Promise<boolean> {
  const blocked = await db.availabilityBlock.count({
    where: {
      listingId,
      status: { in: [BlockStatus.BLOCKED, BlockStatus.BOOKED] },
      startDate: { lte: to },
      endDate: { gte: from },
    },
  })
  return blocked === 0
}
