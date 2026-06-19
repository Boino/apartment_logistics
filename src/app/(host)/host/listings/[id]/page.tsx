import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { getAmenityCatalog } from '@/modules/listings/service'
import { EditListingTabs } from './edit-tabs'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Edit listing' }

type Props = { params: { id: string } }

export default async function EditListingPage({ params }: Props) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) redirect('/login')

  try {
    const [listing, amenities] = await Promise.all([
      db.listing.findUnique({
        where: { id: params.id },
        include: {
          photos: { orderBy: { sortOrder: 'asc' } },
          listingAmenities: { select: { amenityId: true } },
        },
      }),
      getAmenityCatalog(),
    ])

    if (!listing || listing.hostId !== session.user.id) notFound()

    return <EditListingTabs listing={listing} amenities={amenities} />
  } catch {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-8">
        <p className="text-muted-foreground">Database unavailable — cannot load listing.</p>
      </div>
    )
  }
}
