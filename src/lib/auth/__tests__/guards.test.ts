import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuthError } from '../guards'

vi.mock('next-auth', () => ({
  getServerSession: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    listing: { findUnique: vi.fn() },
    staffAssignment: { findFirst: vi.fn() },
    thread: { findUnique: vi.fn() },
  },
}))

import { getServerSession } from 'next-auth'
import { requireAuth, requireListingOwner, requireListingStaff } from '../guards'
import { db } from '@/lib/db'

const mockSession = (overrides = {}) => ({
  user: { id: 'user1', name: 'Test User', email: 'test@test.com', isHost: false, ...overrides },
  expires: new Date(Date.now() + 86400000).toISOString(),
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('requireAuth', () => {
  it('returns session user when authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession())
    const user = await requireAuth()
    expect(user.id).toBe('user1')
    expect(user.email).toBe('test@test.com')
  })

  it('throws AuthError 401 when no session', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    await expect(requireAuth()).rejects.toThrow(AuthError)
    await expect(requireAuth()).rejects.toMatchObject({ status: 401, code: 'UNAUTHORIZED' })
  })

  it('throws AuthError 401 when session has no user id', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {}, expires: '' })
    await expect(requireAuth()).rejects.toMatchObject({ status: 401 })
  })
})

describe('requireListingOwner', () => {
  it('returns user when user is the listing host', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession({ id: 'host1' }))
    vi.mocked(db.listing.findUnique).mockResolvedValue({ hostId: 'host1' } as never)
    const user = await requireListingOwner('listing1')
    expect(user.id).toBe('host1')
  })

  it('throws 403 when user is not the listing host', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession({ id: 'other' }))
    vi.mocked(db.listing.findUnique).mockResolvedValue({ hostId: 'host1' } as never)
    await expect(requireListingOwner('listing1')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
  })

  it('throws 404 when listing not found', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession())
    vi.mocked(db.listing.findUnique).mockResolvedValue(null)
    await expect(requireListingOwner('bad-id')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' })
  })

  it('throws 401 when not authenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    await expect(requireListingOwner('listing1')).rejects.toMatchObject({ status: 401 })
  })
})

describe('requireListingStaff', () => {
  it('allows listing owner', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession({ id: 'host1' }))
    vi.mocked(db.listing.findUnique).mockResolvedValue({ hostId: 'host1' } as never)
    const user = await requireListingStaff('listing1')
    expect(user.id).toBe('host1')
  })

  it('allows active staff member', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession({ id: 'staff1' }))
    vi.mocked(db.listing.findUnique).mockResolvedValue({ hostId: 'host1' } as never)
    vi.mocked(db.staffAssignment.findFirst).mockResolvedValue({ id: 'assign1' } as never)
    const user = await requireListingStaff('listing1')
    expect(user.id).toBe('staff1')
  })

  it('throws 403 for non-staff user', async () => {
    vi.mocked(getServerSession).mockResolvedValue(mockSession({ id: 'rando' }))
    vi.mocked(db.listing.findUnique).mockResolvedValue({ hostId: 'host1' } as never)
    vi.mocked(db.staffAssignment.findFirst).mockResolvedValue(null)
    await expect(requireListingStaff('listing1')).rejects.toMatchObject({ status: 403 })
  })
})

describe('AuthError', () => {
  it('is an instance of Error', () => {
    const err = new AuthError(401, 'TEST', 'test message')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(AuthError)
    expect(err.status).toBe(401)
    expect(err.code).toBe('TEST')
    expect(err.message).toBe('test message')
  })
})
