import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({
  db: {
    listing: { findUnique: vi.fn() },
    staffAssignment: { findFirst: vi.fn() },
    linenSet: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    consumable: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
    },
    damageReport: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    linenBundleTemplate: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    linenBundleInstance: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    user: { findUnique: vi.fn() },
  },
}))

vi.mock('@/lib/notify', () => ({
  notify: vi.fn(),
}))

import { db } from '@/lib/db'
import {
  createBundleTemplate,
  updateBundleTemplate,
  deleteBundleTemplate,
  createBundleInstance,
  updateBundleInstanceState,
  bulkUpdateBundleInstanceState,
  deleteBundleInstance,
  convertPiecesToBundle,
  lastUpdatedAt,
  getLogistics,
} from '../service'

// ── Shared helpers ────────────────────────────────────────────────────────────

const HOST_ID = 'host1'
const STAFF_ID = 'staff1'
const LISTING_ID = 'listing1'
const TEMPLATE_ID = 'tmpl1'
const INSTANCE_ID = 'inst1'

function mockHost() {
  vi.mocked(db.listing.findUnique).mockResolvedValue({ hostId: HOST_ID } as never)
  vi.mocked(db.staffAssignment.findFirst).mockResolvedValue(null)
}

function mockStaff() {
  vi.mocked(db.listing.findUnique).mockResolvedValue({ hostId: HOST_ID } as never)
  vi.mocked(db.staffAssignment.findFirst).mockResolvedValue({ id: 'assign1' } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Bundle template CRUD ──────────────────────────────────────────────────────

describe('createBundleTemplate', () => {
  it('creates a template when called by host', async () => {
    mockHost()
    vi.mocked(db.linenBundleTemplate.create).mockResolvedValue({
      id: TEMPLATE_ID, listingId: LISTING_ID, name: 'Queen kit', parTarget: 3,
      components: '[{"itemType":"fitted_sheet","quantity":1}]',
      description: null, createdAt: new Date(), updatedAt: new Date(),
    } as never)

    const result = await createBundleTemplate(LISTING_ID, HOST_ID, {
      name: 'Queen kit',
      parTarget: 3,
      components: [{ itemType: 'fitted_sheet', quantity: 1 }],
    })

    expect(db.linenBundleTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          listingId: LISTING_ID,
          name: 'Queen kit',
          parTarget: 3,
          components: JSON.stringify([{ itemType: 'fitted_sheet', quantity: 1 }]),
        }),
      }),
    )
    expect(result.id).toBe(TEMPLATE_ID)
  })

  it('throws 403 when staff tries to create template', async () => {
    mockStaff()
    await expect(
      createBundleTemplate(LISTING_ID, STAFF_ID, {
        name: 'Kit', parTarget: 3, components: [{ itemType: 'sheet', quantity: 1 }],
      }),
    ).rejects.toMatchObject({ status: 403 })
    expect(db.linenBundleTemplate.create).not.toHaveBeenCalled()
  })
})

describe('updateBundleTemplate', () => {
  it('updates parTarget and components', async () => {
    vi.mocked(db.linenBundleTemplate.findUnique).mockResolvedValue({
      id: TEMPLATE_ID, listingId: LISTING_ID,
    } as never)
    mockHost()
    vi.mocked(db.linenBundleTemplate.update).mockResolvedValue({ id: TEMPLATE_ID } as never)

    await updateBundleTemplate(TEMPLATE_ID, HOST_ID, { parTarget: 5 })

    expect(db.linenBundleTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEMPLATE_ID },
        data: expect.objectContaining({ parTarget: 5 }),
      }),
    )
  })

  it('throws 404 when template does not exist', async () => {
    vi.mocked(db.linenBundleTemplate.findUnique).mockResolvedValue(null)
    await expect(updateBundleTemplate('bad-id', HOST_ID, { parTarget: 2 })).rejects.toMatchObject({ status: 404 })
  })
})

describe('deleteBundleTemplate', () => {
  it('deletes template when no instances exist', async () => {
    vi.mocked(db.linenBundleTemplate.findUnique).mockResolvedValue({
      id: TEMPLATE_ID, listingId: LISTING_ID,
    } as never)
    mockHost()
    vi.mocked(db.linenBundleInstance.count).mockResolvedValue(0)
    vi.mocked(db.linenBundleTemplate.delete).mockResolvedValue({ id: TEMPLATE_ID } as never)

    await deleteBundleTemplate(TEMPLATE_ID, HOST_ID)
    expect(db.linenBundleTemplate.delete).toHaveBeenCalledWith({ where: { id: TEMPLATE_ID } })
  })

  it('throws BUNDLE_TEMPLATE_IN_USE when instances exist', async () => {
    vi.mocked(db.linenBundleTemplate.findUnique).mockResolvedValue({
      id: TEMPLATE_ID, listingId: LISTING_ID,
    } as never)
    mockHost()
    vi.mocked(db.linenBundleInstance.count).mockResolvedValue(2)

    await expect(deleteBundleTemplate(TEMPLATE_ID, HOST_ID)).rejects.toMatchObject({
      status: 409,
      code: 'BUNDLE_TEMPLATE_IN_USE',
    })
    expect(db.linenBundleTemplate.delete).not.toHaveBeenCalled()
  })
})

// ── Bundle instance create / delete ──────────────────────────────────────────

describe('createBundleInstance', () => {
  it('creates an instance under a template', async () => {
    vi.mocked(db.linenBundleTemplate.findUnique).mockResolvedValue({
      id: TEMPLATE_ID, listingId: LISTING_ID,
    } as never)
    mockHost()
    vi.mocked(db.linenBundleInstance.create).mockResolvedValue({
      id: INSTANCE_ID, templateId: TEMPLATE_ID, label: 'Kit #1', state: 'STORED_CLEAN',
    } as never)

    const result = await createBundleInstance(TEMPLATE_ID, HOST_ID, { label: 'Kit #1' })
    expect(result.id).toBe(INSTANCE_ID)
    expect(db.linenBundleInstance.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ label: 'Kit #1', state: 'STORED_CLEAN', templateId: TEMPLATE_ID }),
      }),
    )
  })

  it('throws 404 when template does not exist', async () => {
    vi.mocked(db.linenBundleTemplate.findUnique).mockResolvedValue(null)
    await expect(createBundleInstance('bad-id', HOST_ID, { label: 'Kit #1' })).rejects.toMatchObject({ status: 404 })
  })
})

describe('deleteBundleInstance', () => {
  it('unlinks linen pieces and deletes the instance', async () => {
    vi.mocked(db.linenBundleInstance.findUnique).mockResolvedValue({
      id: INSTANCE_ID, listingId: LISTING_ID,
    } as never)
    mockHost()
    vi.mocked(db.linenSet.updateMany).mockResolvedValue({ count: 1 } as never)
    vi.mocked(db.linenBundleInstance.delete).mockResolvedValue({ id: INSTANCE_ID } as never)

    await deleteBundleInstance(INSTANCE_ID, HOST_ID)
    expect(db.linenSet.updateMany).toHaveBeenCalledWith({
      where: { bundleInstanceId: INSTANCE_ID },
      data: { bundleInstanceId: null },
    })
    expect(db.linenBundleInstance.delete).toHaveBeenCalledWith({ where: { id: INSTANCE_ID } })
  })

  it('throws 404 when instance does not exist', async () => {
    vi.mocked(db.linenBundleInstance.findUnique).mockResolvedValue(null)
    await expect(deleteBundleInstance('bad-id', HOST_ID)).rejects.toMatchObject({ status: 404 })
  })
})

// ── Bundle instance state transitions ─────────────────────────────────────────

describe('updateBundleInstanceState', () => {
  it('updates instance state (host)', async () => {
    vi.mocked(db.linenBundleInstance.findUnique).mockResolvedValue({
      id: INSTANCE_ID, listingId: LISTING_ID, state: 'STORED_CLEAN',
    } as never)
    mockHost()
    vi.mocked(db.linenBundleInstance.update).mockResolvedValue({
      id: INSTANCE_ID, state: 'AT_LAUNDRY',
    } as never)

    const result = await updateBundleInstanceState(INSTANCE_ID, HOST_ID, { state: 'AT_LAUNDRY' })
    expect(result.state).toBe('AT_LAUNDRY')
    expect(db.linenBundleInstance.update).toHaveBeenCalledWith({
      where: { id: INSTANCE_ID },
      data: { state: 'AT_LAUNDRY', updatedById: HOST_ID },
    })
  })

  it('allows staff to update instance state', async () => {
    vi.mocked(db.linenBundleInstance.findUnique).mockResolvedValue({
      id: INSTANCE_ID, listingId: LISTING_ID, state: 'IN_USE',
    } as never)
    mockStaff()
    vi.mocked(db.linenBundleInstance.update).mockResolvedValue({
      id: INSTANCE_ID, state: 'STORED_DIRTY',
    } as never)

    await updateBundleInstanceState(INSTANCE_ID, STAFF_ID, { state: 'STORED_DIRTY' })
    expect(db.linenBundleInstance.update).toHaveBeenCalled()
  })

  it('throws 404 when instance does not exist', async () => {
    vi.mocked(db.linenBundleInstance.findUnique).mockResolvedValue(null)
    await expect(
      updateBundleInstanceState('bad-id', HOST_ID, { state: 'IN_USE' }),
    ).rejects.toMatchObject({ status: 404 })
  })
})

describe('bulkUpdateBundleInstanceState', () => {
  it('bulk-moves instances and returns count', async () => {
    mockHost()
    vi.mocked(db.linenBundleInstance.updateMany).mockResolvedValue({ count: 3 } as never)

    const result = await bulkUpdateBundleInstanceState(LISTING_ID, HOST_ID, {
      ids: ['i1', 'i2', 'i3'],
      state: 'AT_LAUNDRY',
      listingId: LISTING_ID,
    })

    expect(result).toEqual({ updated: 3 })
    expect(db.linenBundleInstance.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['i1', 'i2', 'i3'] }, listingId: LISTING_ID },
        data: expect.objectContaining({ state: 'AT_LAUNDRY', updatedById: HOST_ID }),
      }),
    )
  })

  it('throws 403 for unauthorized user', async () => {
    vi.mocked(db.listing.findUnique).mockResolvedValue({ hostId: HOST_ID } as never)
    vi.mocked(db.staffAssignment.findFirst).mockResolvedValue(null)

    await expect(
      bulkUpdateBundleInstanceState(LISTING_ID, 'random-user', {
        ids: ['i1'], state: 'IN_USE', listingId: LISTING_ID,
      }),
    ).rejects.toMatchObject({ status: 403 })
  })
})

// ── belowPar computation ──────────────────────────────────────────────────────

describe('getLogistics — belowPar computation', () => {
  it('sets belowPar=true when clean count < parTarget', async () => {
    mockHost()
    vi.mocked(db.linenSet.findMany).mockResolvedValue([])
    vi.mocked(db.consumable.findMany).mockResolvedValue([])
    vi.mocked(db.damageReport.findMany).mockResolvedValue([])
    vi.mocked(db.linenBundleTemplate.findMany).mockResolvedValue([
      { id: TEMPLATE_ID, listingId: LISTING_ID, name: 'Queen kit', parTarget: 3,
        components: '[]', description: null, createdAt: new Date(), updatedAt: new Date() },
    ] as never)
    vi.mocked(db.linenBundleInstance.findMany).mockResolvedValue([
      // Only 1 STORED_CLEAN, parTarget=3 → belowPar
      { id: 'i1', templateId: TEMPLATE_ID, listingId: LISTING_ID, state: 'STORED_CLEAN',
        label: 'Kit #1', updatedAt: new Date(), updatedById: null, updatedBy: null },
      { id: 'i2', templateId: TEMPLATE_ID, listingId: LISTING_ID, state: 'AT_LAUNDRY',
        label: 'Kit #2', updatedAt: new Date(), updatedById: null, updatedBy: null },
    ] as never)

    const { linenBundles, alerts } = await getLogistics(LISTING_ID, HOST_ID)

    expect(linenBundles[0].belowPar).toBe(true)
    expect(linenBundles[0].counts.STORED_CLEAN).toBe(1)
    expect(alerts.some((a) => a.type === 'BELOW_PAR' && a.name === 'Queen kit')).toBe(true)
  })

  it('sets belowPar=false when clean count >= parTarget', async () => {
    mockHost()
    vi.mocked(db.linenSet.findMany).mockResolvedValue([])
    vi.mocked(db.consumable.findMany).mockResolvedValue([])
    vi.mocked(db.damageReport.findMany).mockResolvedValue([])
    vi.mocked(db.linenBundleTemplate.findMany).mockResolvedValue([
      { id: TEMPLATE_ID, listingId: LISTING_ID, name: 'Queen kit', parTarget: 2,
        components: '[]', description: null, createdAt: new Date(), updatedAt: new Date() },
    ] as never)
    vi.mocked(db.linenBundleInstance.findMany).mockResolvedValue([
      { id: 'i1', templateId: TEMPLATE_ID, listingId: LISTING_ID, state: 'STORED_CLEAN',
        label: 'Kit #1', updatedAt: new Date(), updatedById: null, updatedBy: null },
      { id: 'i2', templateId: TEMPLATE_ID, listingId: LISTING_ID, state: 'STORED_CLEAN',
        label: 'Kit #2', updatedAt: new Date(), updatedById: null, updatedBy: null },
    ] as never)

    const { linenBundles } = await getLogistics(LISTING_ID, HOST_ID)
    expect(linenBundles[0].belowPar).toBe(false)
  })
})

// ── needsRestock computation ──────────────────────────────────────────────────

describe('getLogistics — needsRestock computation', () => {
  beforeEach(() => {
    mockHost()
    vi.mocked(db.linenSet.findMany).mockResolvedValue([])
    vi.mocked(db.damageReport.findMany).mockResolvedValue([])
    vi.mocked(db.linenBundleTemplate.findMany).mockResolvedValue([])
    vi.mocked(db.linenBundleInstance.findMany).mockResolvedValue([])
  })

  it('flags quantity consumable when quantity <= reorderThreshold', async () => {
    vi.mocked(db.consumable.findMany).mockResolvedValue([
      { id: 'c1', listingId: LISTING_ID, name: 'Toilet paper', unit: 'rolls',
        quantity: 2, level: null, parTarget: null, reorderThreshold: 3,
        updatedAt: new Date(), updatedById: null, updatedBy: null },
    ] as never)

    const { consumables, alerts } = await getLogistics(LISTING_ID, HOST_ID)
    expect(consumables[0].needsRestock).toBe(true)
    expect(alerts.some((a) => a.type === 'NEEDS_RESTOCK' && a.name === 'Toilet paper')).toBe(true)
  })

  it('does NOT flag quantity consumable when no threshold set', async () => {
    vi.mocked(db.consumable.findMany).mockResolvedValue([
      { id: 'c1', listingId: LISTING_ID, name: 'Toilet paper', unit: 'rolls',
        quantity: 0, level: null, parTarget: null, reorderThreshold: null,
        updatedAt: new Date(), updatedById: null, updatedBy: null },
    ] as never)

    const { consumables } = await getLogistics(LISTING_ID, HOST_ID)
    expect(consumables[0].needsRestock).toBe(false)
  })

  it('flags level consumable at LOW or EMPTY', async () => {
    vi.mocked(db.consumable.findMany).mockResolvedValue([
      { id: 'c1', listingId: LISTING_ID, name: 'Hand soap', unit: null,
        quantity: null, level: 'LOW', parTarget: null, reorderThreshold: null,
        updatedAt: new Date(), updatedById: null, updatedBy: null },
      { id: 'c2', listingId: LISTING_ID, name: 'Dish soap', unit: null,
        quantity: null, level: 'EMPTY', parTarget: null, reorderThreshold: null,
        updatedAt: new Date(), updatedById: null, updatedBy: null },
    ] as never)

    const { consumables } = await getLogistics(LISTING_ID, HOST_ID)
    expect(consumables[0].needsRestock).toBe(true)
    expect(consumables[1].needsRestock).toBe(true)
  })

  it('does NOT flag level consumable at FULL or OK', async () => {
    vi.mocked(db.consumable.findMany).mockResolvedValue([
      { id: 'c1', listingId: LISTING_ID, name: 'Hand soap', unit: null,
        quantity: null, level: 'FULL', parTarget: null, reorderThreshold: null,
        updatedAt: new Date(), updatedById: null, updatedBy: null },
      { id: 'c2', listingId: LISTING_ID, name: 'Dish soap', unit: null,
        quantity: null, level: 'OK', parTarget: null, reorderThreshold: null,
        updatedAt: new Date(), updatedById: null, updatedBy: null },
    ] as never)

    const { consumables } = await getLogistics(LISTING_ID, HOST_ID)
    expect(consumables[0].needsRestock).toBe(false)
    expect(consumables[1].needsRestock).toBe(false)
  })
})

// ── convertPiecesToBundle ─────────────────────────────────────────────────────

describe('convertPiecesToBundle', () => {
  it('creates instance and links piece rows', async () => {
    vi.mocked(db.linenBundleTemplate.findFirst).mockResolvedValue({
      id: TEMPLATE_ID, listingId: LISTING_ID, name: 'Queen kit', parTarget: 3,
      components: '[]',
    } as never)
    vi.mocked(db.linenBundleInstance.create).mockResolvedValue({
      id: INSTANCE_ID, listingId: LISTING_ID, templateId: TEMPLATE_ID, label: 'Kit #1', state: 'STORED_CLEAN',
    } as never)
    vi.mocked(db.linenSet.updateMany).mockResolvedValue({ count: 2 } as never)

    const result = await convertPiecesToBundle(LISTING_ID, ['p1', 'p2'], TEMPLATE_ID, 'Kit #1')

    expect(result.id).toBe(INSTANCE_ID)
    expect(db.linenSet.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['p1', 'p2'] }, listingId: LISTING_ID },
      data: { bundleInstanceId: INSTANCE_ID },
    })
  })

  it('throws 404 when template does not belong to listing', async () => {
    vi.mocked(db.linenBundleTemplate.findFirst).mockResolvedValue(null)
    await expect(
      convertPiecesToBundle(LISTING_ID, ['p1'], 'wrong-template', 'Kit #1'),
    ).rejects.toMatchObject({ status: 404 })
  })
})

// ── lastUpdatedAt reflects bundle instance updates ────────────────────────────

describe('lastUpdatedAt', () => {
  it('returns linen set date when no bundle instances exist', async () => {
    const setDate = new Date('2026-06-15T10:00:00Z')
    vi.mocked(db.linenSet.findFirst).mockResolvedValue({ updatedAt: setDate } as never)
    vi.mocked(db.consumable.findFirst).mockResolvedValue(null)
    vi.mocked(db.linenBundleInstance.findFirst).mockResolvedValue(null)

    const result = await lastUpdatedAt(LISTING_ID)
    expect(result.linenAt).toEqual(setDate)
    expect(result.consumablesAt).toBeNull()
  })

  it('returns bundle instance date when it is more recent than linen set', async () => {
    const setDate = new Date('2026-06-15T08:00:00Z')
    const bundleDate = new Date('2026-06-15T14:00:00Z')
    vi.mocked(db.linenSet.findFirst).mockResolvedValue({ updatedAt: setDate } as never)
    vi.mocked(db.consumable.findFirst).mockResolvedValue(null)
    vi.mocked(db.linenBundleInstance.findFirst).mockResolvedValue({ updatedAt: bundleDate } as never)

    const result = await lastUpdatedAt(LISTING_ID)
    expect(result.linenAt).toEqual(bundleDate)
  })

  it('returns linen set date when it is more recent than bundle instance', async () => {
    const setDate = new Date('2026-06-15T16:00:00Z')
    const bundleDate = new Date('2026-06-15T09:00:00Z')
    vi.mocked(db.linenSet.findFirst).mockResolvedValue({ updatedAt: setDate } as never)
    vi.mocked(db.consumable.findFirst).mockResolvedValue(null)
    vi.mocked(db.linenBundleInstance.findFirst).mockResolvedValue({ updatedAt: bundleDate } as never)

    const result = await lastUpdatedAt(LISTING_ID)
    expect(result.linenAt).toEqual(setDate)
  })

  // Regression guard: updating a bundle instance unblocks the prep-slot Done check.
  it('(prep-slot integration) bundle instance update after windowStart satisfies Done check', async () => {
    const windowStart = new Date('2026-06-20T11:00:00Z')
    const bundleUpdatedAt = new Date('2026-06-20T13:00:00Z') // after window start

    vi.mocked(db.linenSet.findFirst).mockResolvedValue(null)
    vi.mocked(db.consumable.findFirst).mockResolvedValue({ updatedAt: bundleUpdatedAt } as never)
    vi.mocked(db.linenBundleInstance.findFirst).mockResolvedValue({ updatedAt: bundleUpdatedAt } as never)

    const { linenAt, consumablesAt } = await lastUpdatedAt(LISTING_ID)

    // Both must be after windowStart for Done to be allowed
    expect(linenAt).not.toBeNull()
    expect(consumablesAt).not.toBeNull()
    expect(linenAt!.getTime()).toBeGreaterThan(windowStart.getTime())
    expect(consumablesAt!.getTime()).toBeGreaterThan(windowStart.getTime())
  })
})
