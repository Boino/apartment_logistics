import { db } from '@/lib/db'
import { notify } from '@/lib/notify'
import type {
  CreateLinenSetInput, UpdateLinenStateInput, BulkLinenStateInput,
  CreateConsumableInput, UpdateConsumableInput,
  CreateDamageReportInput, UpdateDamageReportInput,
  CreateBundleTemplateInput, UpdateBundleTemplateInput,
  CreateBundleInstanceInput, UpdateBundleInstanceStateInput, BulkBundleInstanceStateInput,
} from './validation'

const appUrl = () => process.env.APP_URL ?? 'http://localhost:3000'

// ── Access helpers ────────────────────────────────────────────────────────────

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

async function requireHostAccess(listingId: string, userId: string) {
  const { isHost, hostId } = await requireListingAccess(listingId, userId)
  if (!isHost) throw Object.assign(new Error('Only the host can perform this action'), { status: 403 })
  return { hostId }
}

// ── Full logistics snapshot ───────────────────────────────────────────────────

export type LogisticsAlert = {
  type: 'BELOW_PAR' | 'NEEDS_RESTOCK'
  name: string
  detail: string
}

export async function getLogistics(listingId: string, userId: string) {
  await requireListingAccess(listingId, userId)

  const [linenSets, rawConsumables, damageReports, templates, allInstances] = await Promise.all([
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
    db.linenBundleTemplate.findMany({
      where: { listingId },
      orderBy: { name: 'asc' },
    }),
    db.linenBundleInstance.findMany({
      where: { listingId },
      include: { updatedBy: { select: { name: true } } },
      orderBy: [{ templateId: 'asc' }, { label: 'asc' }],
    }),
  ])

  // Compute needsRestock per consumable
  const consumables = rawConsumables.map((c) => {
    let needsRestock = false
    if (c.level !== null) {
      needsRestock = c.level === 'LOW' || c.level === 'EMPTY'
    } else if (c.quantity !== null && c.reorderThreshold !== null) {
      needsRestock = c.quantity <= c.reorderThreshold
    }
    return { ...c, needsRestock }
  })

  // Group instances by template + compute belowPar
  const linenBundles = templates.map((template) => {
    const instances = allInstances.filter((i) => i.templateId === template.id)
    const cleanCount = instances.filter((i) => i.state === 'STORED_CLEAN').length
    const belowPar = cleanCount < template.parTarget
    const counts = {
      STORED_CLEAN: instances.filter((i) => i.state === 'STORED_CLEAN').length,
      IN_USE: instances.filter((i) => i.state === 'IN_USE').length,
      STORED_DIRTY: instances.filter((i) => i.state === 'STORED_DIRTY').length,
      AT_LAUNDRY: instances.filter((i) => i.state === 'AT_LAUNDRY').length,
      total: instances.length,
    }
    return {
      template: { ...template, components: JSON.parse(template.components) as Array<{ itemType: string; quantity: number }> },
      instances,
      counts,
      parTarget: template.parTarget,
      belowPar,
    }
  })

  // Build top-level alerts array
  const alerts: LogisticsAlert[] = []
  for (const bundle of linenBundles) {
    if (bundle.belowPar) {
      alerts.push({
        type: 'BELOW_PAR',
        name: bundle.template.name,
        detail: `${bundle.counts.STORED_CLEAN} clean of ${bundle.parTarget} PAR target`,
      })
    }
  }
  for (const c of consumables) {
    if (c.needsRestock) {
      alerts.push({
        type: 'NEEDS_RESTOCK',
        name: c.name,
        detail: c.level
          ? `Level: ${c.level}`
          : `Qty: ${c.quantity ?? 0} (threshold: ${c.reorderThreshold})`,
      })
    }
  }

  return { linenSets, consumables, damageReports, linenBundles, alerts }
}

// ── lastUpdatedAt (used by Agent I's Done check) ──────────────────────────────
// Bundle instance updates count as linen updates for the Done check.

export async function lastUpdatedAt(listingId: string): Promise<{ linenAt: Date | null; consumablesAt: Date | null }> {
  const [linen, consumable, bundleInstance] = await Promise.all([
    db.linenSet.findFirst({ where: { listingId }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
    db.consumable.findFirst({ where: { listingId }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
    db.linenBundleInstance.findFirst({ where: { listingId }, orderBy: { updatedAt: 'desc' }, select: { updatedAt: true } }),
  ])

  const linenSetAt = linen?.updatedAt ?? null
  const bundleAt = bundleInstance?.updatedAt ?? null
  let linenAt: Date | null = null
  if (linenSetAt && bundleAt) {
    linenAt = linenSetAt > bundleAt ? linenSetAt : bundleAt
  } else {
    linenAt = linenSetAt ?? bundleAt
  }

  return { linenAt, consumablesAt: consumable?.updatedAt ?? null }
}

// ── Seed defaults on listing publish ─────────────────────────────────────────

export async function seedDefaults(listingId: string): Promise<void> {
  const existing = await db.consumable.count({ where: { listingId } })
  if (existing > 0) return

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
      parTarget: input.parTarget ?? null,
      reorderThreshold: input.reorderThreshold ?? null,
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
      ...(input.parTarget !== undefined && { parTarget: input.parTarget }),
      ...(input.reorderThreshold !== undefined && { reorderThreshold: input.reorderThreshold }),
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

// ── Bundle templates ──────────────────────────────────────────────────────────

export async function getBundleTemplates(listingId: string, userId: string) {
  await requireListingAccess(listingId, userId)
  const templates = await db.linenBundleTemplate.findMany({
    where: { listingId },
    include: { instances: true },
    orderBy: { name: 'asc' },
  })
  return templates.map((t) => ({
    ...t,
    components: JSON.parse(t.components) as Array<{ itemType: string; quantity: number }>,
    instanceCount: t.instances.length,
  }))
}

export async function createBundleTemplate(listingId: string, userId: string, input: CreateBundleTemplateInput) {
  await requireHostAccess(listingId, userId)
  return db.linenBundleTemplate.create({
    data: {
      listingId,
      name: input.name,
      description: input.description,
      parTarget: input.parTarget,
      components: JSON.stringify(input.components),
    },
  })
}

export async function updateBundleTemplate(templateId: string, userId: string, input: UpdateBundleTemplateInput) {
  const template = await db.linenBundleTemplate.findUnique({ where: { id: templateId } })
  if (!template) throw Object.assign(new Error('Bundle template not found'), { status: 404 })
  await requireHostAccess(template.listingId, userId)
  return db.linenBundleTemplate.update({
    where: { id: templateId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.parTarget !== undefined && { parTarget: input.parTarget }),
      ...(input.components !== undefined && { components: JSON.stringify(input.components) }),
    },
  })
}

export async function deleteBundleTemplate(templateId: string, userId: string) {
  const template = await db.linenBundleTemplate.findUnique({ where: { id: templateId } })
  if (!template) throw Object.assign(new Error('Bundle template not found'), { status: 404 })
  await requireHostAccess(template.listingId, userId)
  const instanceCount = await db.linenBundleInstance.count({ where: { templateId } })
  if (instanceCount > 0) {
    throw Object.assign(new Error('Cannot delete a template that has instances'), {
      status: 409,
      code: 'BUNDLE_TEMPLATE_IN_USE',
    })
  }
  await db.linenBundleTemplate.delete({ where: { id: templateId } })
}

// ── Bundle instances ──────────────────────────────────────────────────────────

export async function getBundleInstances(templateId: string, userId: string) {
  const template = await db.linenBundleTemplate.findUnique({ where: { id: templateId } })
  if (!template) throw Object.assign(new Error('Bundle template not found'), { status: 404 })
  await requireListingAccess(template.listingId, userId)
  return db.linenBundleInstance.findMany({
    where: { templateId },
    include: {
      updatedBy: { select: { name: true } },
      linenPieces: { select: { id: true, label: true, type: true } },
    },
    orderBy: { label: 'asc' },
  })
}

export async function createBundleInstance(templateId: string, userId: string, input: CreateBundleInstanceInput) {
  const template = await db.linenBundleTemplate.findUnique({ where: { id: templateId } })
  if (!template) throw Object.assign(new Error('Bundle template not found'), { status: 404 })
  await requireListingAccess(template.listingId, userId)
  return db.linenBundleInstance.create({
    data: {
      listingId: template.listingId,
      templateId,
      label: input.label,
      state: input.state ?? 'STORED_CLEAN',
      updatedById: userId,
    },
  })
}

export async function updateBundleInstanceState(instanceId: string, userId: string, input: UpdateBundleInstanceStateInput) {
  const instance = await db.linenBundleInstance.findUnique({ where: { id: instanceId } })
  if (!instance) throw Object.assign(new Error('Bundle instance not found'), { status: 404 })
  await requireListingAccess(instance.listingId, userId)
  return db.linenBundleInstance.update({
    where: { id: instanceId },
    data: { state: input.state, updatedById: userId },
  })
}

export async function bulkUpdateBundleInstanceState(listingId: string, userId: string, input: BulkBundleInstanceStateInput) {
  await requireListingAccess(listingId, userId)
  const { count } = await db.linenBundleInstance.updateMany({
    where: { id: { in: input.ids }, listingId },
    data: { state: input.state, updatedById: userId, updatedAt: new Date() },
  })
  return { updated: count }
}

export async function deleteBundleInstance(instanceId: string, userId: string) {
  const instance = await db.linenBundleInstance.findUnique({ where: { id: instanceId } })
  if (!instance) throw Object.assign(new Error('Bundle instance not found'), { status: 404 })
  await requireListingAccess(instance.listingId, userId)
  // Unlink any linen pieces before deleting
  await db.linenSet.updateMany({
    where: { bundleInstanceId: instanceId },
    data: { bundleInstanceId: null },
  })
  await db.linenBundleInstance.delete({ where: { id: instanceId } })
}

// ── Convert individual pieces to a bundle instance ────────────────────────────

export async function convertPiecesToBundle(
  listingId: string,
  pieceIds: string[],
  templateId: string,
  label: string,
) {
  const template = await db.linenBundleTemplate.findFirst({ where: { id: templateId, listingId } })
  if (!template) throw Object.assign(new Error('Bundle template not found for this listing'), { status: 404 })

  const instance = await db.linenBundleInstance.create({
    data: { listingId, templateId, label, state: 'STORED_CLEAN' },
  })

  await db.linenSet.updateMany({
    where: { id: { in: pieceIds }, listingId },
    data: { bundleInstanceId: instance.id },
  })

  return instance
}
