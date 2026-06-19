import Link from 'next/link'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getHostListings } from '@/modules/listings/service'
import { ListingCard } from '@/components/listings/listing-card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'My Listings' }

export default async function HostListingsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  let listings: Awaited<ReturnType<typeof getHostListings>> = []
  try {
    listings = await getHostListings(session.user.id)
  } catch {
    // DB unavailable — show empty state
  }

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Listings</h1>
        <Button asChild>
          <Link href="/host/listings/new">
            <Plus className="mr-2 h-4 w-4" />
            New listing
          </Link>
        </Button>
      </div>

      {listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <p className="text-muted-foreground mb-4">You have no listings yet.</p>
          <Button asChild>
            <Link href="/host/listings/new">Create your first listing</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((listing) => (
            <ListingCard
              key={listing.id}
              listing={{
                ...listing,
                basePrice: Number(listing.basePrice),
                bedrooms: listing.bedrooms,
              }}
              href={`/host/listings/${listing.id}`}
              showStatus
            />
          ))}
        </div>
      )}
    </div>
  )
}
