import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from './index'
import { db } from '@/lib/db'

export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403 | 404,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

export type SessionUser = { id: string; name: string | null; email: string | null; isHost: boolean }

export function authErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status })
  }
  console.error('[guard] unexpected error:', err)
  return NextResponse.json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } }, { status: 500 })
}

export async function requireAuth(): Promise<SessionUser> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) throw new AuthError(401, 'UNAUTHORIZED', 'Authentication required')
  return session.user as SessionUser
}

export async function requireListingOwner(listingId: string): Promise<SessionUser> {
  const user = await requireAuth()
  const listing = await db.listing.findUnique({ where: { id: listingId }, select: { hostId: true } })
  if (!listing) throw new AuthError(404, 'NOT_FOUND', 'Listing not found')
  if (listing.hostId !== user.id) throw new AuthError(403, 'FORBIDDEN', 'Not the listing owner')
  return user
}

export async function requireListingStaff(listingId: string): Promise<SessionUser> {
  const user = await requireAuth()
  const listing = await db.listing.findUnique({ where: { id: listingId }, select: { hostId: true } })
  if (!listing) throw new AuthError(404, 'NOT_FOUND', 'Listing not found')
  if (listing.hostId === user.id) return user
  const assignment = await db.staffAssignment.findFirst({
    where: { listingId, staffUserId: user.id, status: 'ACTIVE' },
  })
  if (!assignment) throw new AuthError(403, 'FORBIDDEN', 'Not authorized for this listing')
  return user
}

export async function requireParticipant(threadId: string): Promise<SessionUser> {
  const user = await requireAuth()
  const thread = await db.thread.findUnique({
    where: { id: threadId },
    include: { inquiry: { select: { guestId: true, listingId: true } } },
  })
  if (!thread) throw new AuthError(404, 'NOT_FOUND', 'Thread not found')
  const { guestId, listingId } = thread.inquiry
  const listing = await db.listing.findUnique({ where: { id: listingId }, select: { hostId: true } })
  if (guestId !== user.id && listing?.hostId !== user.id) {
    throw new AuthError(403, 'FORBIDDEN', 'Not a participant in this thread')
  }
  return user
}
