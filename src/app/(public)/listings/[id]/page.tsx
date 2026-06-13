import { notFound } from 'next/navigation'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getListingById } from '@/modules/listings/service'
import Image from 'next/image'
import { MapPin, Users, BedDouble, Bath, Clock } from 'lucide-react'
import { InquiryForm } from '@/components/listings/inquiry-form'

export const dynamic = 'force-dynamic'

type Props = { params: { id: string } }

export async function generateMetadata({ params }: Props) {
  try {
    const listing = await getListingById(params.id)
    return { title: listing?.title ?? 'Listing' }
  } catch {
    return { title: 'Listing' }
  }
}

export default async function ListingDetailPage({ params }: Props) {
  const session = await getServerSession(authOptions)

  let listing: Awaited<ReturnType<typeof getListingById>> = null
  try {
    listing = await getListingById(params.id, session?.user?.id)
  } catch {
    notFound()
  }
  if (!listing) notFound()

  const photos = listing.photos
  const cover = photos[0]
  const amenities = listing.listingAmenities.map((a) => a.amenity)
  const grouped = amenities.reduce<Record<string, typeof amenities>>((acc, a) => {
    const cat = a.category ?? 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(a)
    return acc
  }, {})

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* ── Photo gallery ── */}
      <div className="mb-6 overflow-hidden rounded-2xl">
        {cover ? (
          <div className="grid gap-2 grid-cols-1 sm:grid-cols-4 sm:grid-rows-2 max-h-[420px]">
            {/* main photo */}
            <div className="relative sm:col-span-2 sm:row-span-2 aspect-[4/3] sm:aspect-auto">
              <Image
                src={cover.url}
                alt={listing.title}
                fill
                className="object-cover"
                priority
                sizes="(max-width:640px) 100vw, 50vw"
              />
            </div>
            {/* thumbnails */}
            {photos.slice(1, 5).map((p) => (
              <div key={p.id} className="relative hidden sm:block aspect-[4/3]">
                <Image
                  src={p.thumbUrl ?? p.url}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="25vw"
                />
              </div>
            ))}
            {photos.length === 0 && (
              <div className="col-span-4 row-span-2 flex h-64 items-center justify-center bg-muted text-muted-foreground">
                No photos yet
              </div>
            )}
          </div>
        ) : (
          <div className="flex h-64 items-center justify-center rounded-xl bg-muted text-muted-foreground">
            No photos yet
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-3">
        {/* ── Left: listing info ── */}
        <div className="lg:col-span-2 space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-3xl font-bold">{listing.title}</h1>
            <div className="mt-2 flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-4 w-4 shrink-0" />
              <span className="text-sm">{listing.addressText}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><BedDouble className="h-4 w-4" />{listing.bedrooms} bedroom{listing.bedrooms !== 1 ? 's' : ''}</span>
              <span className="flex items-center gap-1.5"><Bath className="h-4 w-4" />{listing.bathrooms} bathroom{listing.bathrooms !== 1 ? 's' : ''}</span>
              <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />Up to {listing.maxGuests} guests</span>
              <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />Check-in {listing.checkInTime} · Check-out {listing.checkOutTime}</span>
            </div>
          </div>

          {/* Description */}
          {listing.description && (
            <div>
              <h2 className="mb-3 text-xl font-semibold">About this place</h2>
              <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{listing.description}</p>
            </div>
          )}

          {/* Amenities */}
          {amenities.length > 0 && (
            <div>
              <h2 className="mb-3 text-xl font-semibold">Amenities</h2>
              {Object.entries(grouped).map(([cat, items]) => (
                <div key={cat} className="mb-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{cat}</p>
                  <div className="flex flex-wrap gap-2">
                    {items.map((a) => (
                      <span key={a.id} className="rounded-full border bg-muted px-3 py-1 text-sm">
                        {a.icon && <span className="mr-1">{a.icon}</span>}
                        {a.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pricing details */}
          <div className="rounded-xl border p-4 space-y-2 text-sm">
            <h2 className="font-semibold">Pricing</h2>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Base price</span>
              <span className="font-medium">{listing.currency} {Number(listing.basePrice).toFixed(0)} / night</span>
            </div>
            {listing.minStay > 1 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Minimum stay</span>
                <span>{listing.minStay} nights</span>
              </div>
            )}
            <div className="border-t pt-2 text-muted-foreground text-xs space-y-0.5">
              <p>7+ nights: 5% discount</p>
              <p>14+ nights: 10% discount</p>
              <p>28+ nights: 15% discount</p>
            </div>
          </div>

          {/* Host info */}
          <div className="flex items-center gap-3 text-sm">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
              {listing.host.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium">Hosted by {listing.host.name}</p>
              <p className="text-muted-foreground text-xs">
                Member since {new Date(listing.host.createdAt).getFullYear()}
              </p>
            </div>
          </div>
        </div>

        {/* ── Right: inquiry form (sticky) ── */}
        <div className="lg:sticky lg:top-20 h-fit">
          <div className="rounded-2xl border shadow-md p-6">
            <div className="mb-4 flex items-baseline justify-between">
              <span className="text-2xl font-bold">{listing.currency} {Number(listing.basePrice).toFixed(0)}</span>
              <span className="text-muted-foreground text-sm">/ night</span>
            </div>
            <InquiryForm
              listingId={listing.id}
              basePrice={Number(listing.basePrice)}
              currency={listing.currency}
              minStay={listing.minStay}
              maxStay={listing.maxStay}
              maxGuests={listing.maxGuests}
              checkInTime={listing.checkInTime}
              checkOutTime={listing.checkOutTime}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
