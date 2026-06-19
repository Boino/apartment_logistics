import { db } from '@/lib/db'
import { notify } from '@/lib/notify'
import type {
  CreateLinenSetInput, UpdateLinenStateInput, BulkLinenStateInput,
  CreateConsumableInput, UpdateConsumableInput,
  CreateDamageReportInput, UpdateDamageReportInput,
} from './validation'

const appUrl = () => process.env.APP_URL ?? 'http://localhost:3000'

// ── Access check ──────────────────────────────────────────────────────────────

async function requireListingAccess(listingId: string, userId: string) {
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: { hostId: true },
  })
  if (!listing) throw Object.assign(new Error('Listing not found'), { status: 404 })
  if (listing.hostId === userId) return { isHost: true, hostId: listing.hostId }
  const assignment = await db.staffAssignment.findFirst({
    where: { listingId, staffUserId: userId, status: 'ACTIVE' },
  })
  if (!assignment) throw Object.assign(new Error('Not authorized'), { status: 403 })
  return { isHost: false, hostId: listing.hostId }
}

// ── Full logistics snapshot ───────────────────────────────────────────────────

export async function getLogistics(listingId: string, userId: string) {
  await requireListingAccess(listingId, userId)

  const [linenSets, consumables, damageReports] = await Promise.all([
    db.linenSet.findMany({
      where: { listingId },
      include: { updatedBy: { select: { name: true } } },
      orderBy: [{ type: 'asc' }, { label: 'asc' }],
    }),
    db.consumable.findMany({
      where: { listingId },
      include: { updatedBy: { select: { name: true } } },
      orderBy: { name: 'asc' },
    }),
    db.damageReport.findMany({
      where: { listingId, status: 'OPEN' },
      include: { reporter: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  return { linenSets, consumables, damageReports }
}

// ── lastUpdatedAt (used by Agent I's Done check) ──────────────────────────────

export async function lastUpdatedAt(listingId: string): Promise<{ linenAt: Date | null; consumablesAt: Date | null }> {
  const [linen, consumable] = await Promise.all([
    db.linenSet.findFirst({ where: { listingId }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
    db.consumable.findFirst({ where: { listingId }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
  ])
  return { linenAt: linen?.updatedAt ?? null, consumablesAt: consumable?.updatedAt ?? null }
}

// ── Seed defaults on listing publish ─────────────────────────────────────────

export async function seedDefaults(listingId: string): Promise<void> {
  const existing = await db.consumable.count({ where: { listingId } })
  if (existing > 0) return // already seeded

  const defaults = [
    { name: 'Toilet paper', unit: 'rolls', mode: 'quantity', quantity: 0 },
    { name: 'Hand soap', unit: 'bottles', mode: 'level', level: 'FULL' },
    { name: 'Dish soap', unit: 'bottles', mode: 'level', level: 'FULL' },
    { name: 'Sponges', unit: 'pieces', mode: 'quantity', quantity: 0 },
    { name: 'Trash bags', unit: 'pieces', mode: 'quantity', quantity: 0 },
  ] as const

  await db.consumable.createMany({
    data: defaults.map((d) => ({
      listingId,
      name: d.name,
      unit: d.unit,
      quantity: 'quantity' in d && d.mode === 'quantity' ? d.quantity : null,
      level: 'level' in d && d.mode === 'level' ? d.level : null,
    })),
  })
}

// ── Linen sets ────────────────────────────────────────────────────────────────

export async function createLinenSet(listingId: string, userId: string, input: CreateLinenSetInput) {
  await requireListingAccess(listingId, userId)
  const count = await db.linenSet.count({ where: { listingId, type: input.type } })
  const label = input.label || `${input.type === 'SHEETS' ? 'Sheets' : 'Towels'} #${count + 1}`
  return db.linenSet.create({ data: { listingId, type: input.type, label, state: 'STORED_CLEAN' } })
}

export async function updateLinenState(setId: string, userId: string, input: UpdateLinenStateInput) {
  const set = await db.linenSet.findUnique({ where: { id: setId } })
  if (!set) throw Object.assign(new Error('Linen set not found'), { status: 404 })
  await requireListingAccess(set.listingId, userId)
  return db.linenSet.update({ where: { id: setId }, data: { state: input.state, updatedById: userId } })
}

export async function bulkUpdateLinenState(listingId: string, userId: string, input: BulkLinenStateInput) {
  await requireListingAccess(listingId, userId)
  const { count } = await db.linenSet.updateMany({
    where: { id: { in: input.ids }, listingId },
    data: { state: input.state, updatedById: userId, updatedAt: new Date() },
  })
  return { updated: count }
}

export async function deleteLinenSet(setId: string, userId: string) {
  const set = await db.linenSet.findUnique({ where: { id: setId } })
  if (!set) throw Object.assign(new Error('Linen set not found'), { status: 404 })
  await requireListingAccess(set.listingId, userId)
  await db.linenSet.delete({ where: { id: setId } })
}

// ── Consumables ───────────────────────────────────────────────────────────────

export async function createConsumable(listingId: string, userId: string, input: CreateConsumableInput) {
  await requireListingAccess(listingId, userId)
  return db.consumable.create({
    data: {
      listingId,
      name: input.name,
      unit: input.unit,
      quantity: input.mode === 'quantity' ? (input.quantity ?? 0) : null,
      level: input.mode === 'level' ? (input.level ?? 'FULL') : null,
      updatedById: userId,
    },
  })
}

export async function updateConsumable(consumableId: string, userId: string, input: UpdateConsumableInput) {
  const item = await db.consumable.findUnique({ where: { id: consumableId } })
  if (!item) throw Object.assign(new Error('Consumable not found'), { status: 404 })
  await requireListingAccess(item.listingId, userId)
  return db.consumable.update({
    where: { id: consumableId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.unit !== undefined && { unit: input.unit }),
      ...(input.quantity !== undefined && { quantity: input.quantity }),
      ...(input.level !== undefined && { level: input.level }),
      updatedById: userId,
    },
  })
}

export async function deleteConsumable(consumableId: string, userId: string) {
  const item = await db.consumable.findUnique({ where: { id: consumableId } })
  if (!item) throw Object.assign(new Error('Consumable not found'), { status: 404 })
  await requireListingAccess(item.listingId, userId)
  await db.consumable.delete({ where: { id: consumableId } })
}

// ── Damage reports ────────────────────────────────────────────────────────────

export async function createDamageReport(listingId: string, userId: string, input: CreateDamageReportInput, prepSlotId?: string) {
  const { isHost, hostId } = await requireListingAccess(listingId, userId)
  const report = await db.damageReport.create({
    data: {
      listingId,
      reporterId: userId,
      description: input.description,
      photoUrl: input.photoUrl,
      status: 'OPEN',
      ...(prepSlotId ? { prepSlotId } : {}),
    },
  })

  if (!isHost) {
    const listing = await db.listing.findUnique({ where: { id: listingId }, select: { title: true } })
    const reporter = await db.user.findUnique({ where: { id: userId }, select: { name: true } })
    const host = await db.user.findUnique({ where: { id: hostId }, select: { email: true, name: true } })
    if (host) {
      await notify(hostId, 'DAMAGE_REPORTED', {
        title: `Damage reported at ${listing?.title ?? 'your listing'}`,
        body: `${reporter?.name ?? 'Staff'}: ${input.description.slice(0, 150)}`,
        link: `/host/logistics?listingId=${listingId}`,
        email: {
          to: host.email,
          subject: `Damage reported — ${listing?.title ?? 'your listing'}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#222">
              <h2 style="color:#1d7464">Damage reported</h2>
              <p>Hi ${host.name},</p>
              <p><strong>${reporter?.name ?? 'A staff member'}</strong> filed a damage report:</p>
              <p style="background:#f5f5f5;padding:12px;border-radius:4px">${input.description}</p>
              <p><a href="${appUrl()}/host/logistics?listingId=${listingId}" style="background:#1d7464;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block">View report</a></p>
            </div>
          `,
        },
      })
    }
  }

  return report
}

export async function updateDamageReport(reportId: string, userId: string, input: UpdateDamageReportInput) {
  const report = await db.damageReport.findUnique({ where: { id: reportId } })
  if (!report) throw Object.assign(new Error('Report not found'), { status: 404 })
  const { isHost } = await requireListingAccess(report.listingId, userId)
  if (!isHost) throw Object.assign(new Error('Only the host can update damage reports'), { status: 403 })
  return db.damageReport.update({ where: { id: reportId }, data: { status: input.status } })
}
