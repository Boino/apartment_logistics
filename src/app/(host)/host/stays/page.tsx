import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { db } from '@/lib/db'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Stays' }

const STATUS_LABELS: Record<string, string> = {
  UPCOMING: 'Upcoming', IN_HOUSE: 'In house', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
}
const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  UPCOMING: 'default', IN_HOUSE: 'secondary', COMPLETED: 'outline', CANCELLED: 'destructive',
}

type Props = { searchParams: { listingId?: string; status?: string } }

export default async function HostStaysPage({ searchParams }: Props) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  const hostListings = await db.listing.findMany({
    where: { hostId: session.user.id, status: { not: 'ARCHIVED' } },
    select: { id: true, title: true },
    orderBy: { title: 'asc' },
  })

  const stays = await db.stay.findMany({
    where: {
      listing: { hostId: session.user.id },
      ...(searchParams.listingId ? { listingId: searchParams.listingId } : {}),
      ...(searchParams.status ? { status: searchParams.status } : {}),
    },
    include: { listing: { select: { id: true, title: true } } },
    orderBy: { checkinAt: 'asc' },
  })

  const activeStatuses = ['UPCOMING', 'IN_HOUSE', 'COMPLETED', 'CANCELLED']

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Stays</h1>
        <Button asChild>
          <Link href="/host/stays/new"><Plus className="mr-1.5 h-4 w-4" />New stay</Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {hostListings.length > 1 && (
          <div className="flex gap-1 flex-wrap">
            <Link
              href={{ pathname: '/host/stays', query: { ...(searchParams.status ? { status: searchParams.status } : {}) } }}
              className={`rounded-full px-3 py-1 text-xs border transition-colors ${!searchParams.listingId ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
            >
              All listings
            </Link>
            {hostListings.map((l) => (
              <Link
                key={l.id}
                href={{ pathname: '/host/stays', query: { listingId: l.id, ...(searchParams.status ? { status: searchParams.status } : {}) } }}
                className={`rounded-full px-3 py-1 text-xs border transition-colors ${searchParams.listingId === l.id ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
              >
                {l.title}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        <Link
          href={{ pathname: '/host/stays', query: searchParams.listingId ? { listingId: searchParams.listingId } : {} }}
          className={`rounded-full px-3 py-1 text-sm border transition-colors ${!searchParams.status ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
        >
          All
        </Link>
        {activeStatuses.map((s) => (
          <Link
            key={s}
            href={{ pathname: '/host/stays', query: { ...(searchParams.listingId ? { listingId: searchParams.listingId } : {}), status: s } }}
            className={`rounded-full px-3 py-1 text-sm border transition-colors ${searchParams.status === s ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
          >
            {STATUS_LABELS[s]}
          </Link>
        ))}
      </div>

      {stays.length === 0 ? (
        <div className="flex flex-col items-center py-24 text-center text-muted-foreground gap-3">
          <p className="text-lg font-medium">No stays found</p>
          <p className="text-sm">Record a confirmed stay manually or convert a confirmed inquiry.</p>
          <Button asChild variant="outline">
            <Link href="/host/stays/new">Create stay</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {stays.map((stay) => (
            <div key={stay.id} className="flex gap-4 rounded-xl border p-4 items-start">
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-semibold">{stay.guestName}</p>
                    <p className="text-xs text-muted-foreground">{stay.listing.title}</p>
                  </div>
                  <Badge variant={STATUS_VARIANTS[stay.status] ?? 'outline'}>
                    {STATUS_LABELS[stay.status] ?? stay.status}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {format(new Date(stay.checkinAt), 'dd MMM yyyy HH:mm')} →{' '}
                  {format(new Date(stay.checkoutAt), 'dd MMM yyyy HH:mm')}
                  {' '}· {stay.numGuests} guest{stay.numGuests !== 1 ? 's' : ''}
                </p>
                {stay.notes && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{stay.notes}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                {stay.status !== 'CANCELLED' && stay.status !== 'COMPLETED' && (
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/host/stays/new?edit=${stay.id}`}>Edit</Link>
                  </Button>
                )}
                {(stay.status === 'UPCOMING' || stay.status === 'COMPLETED') && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/host/staff?outgoingStayId=${stay.id}`}>
                      + Prep slot
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
