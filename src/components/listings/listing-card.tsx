'use client'

import Link from 'next/link'
import Image from 'next/image'
import { cn } from '@/lib/utils'

type Photo = { url: string; thumbUrl?: string | null }
type Listing = {
  id: string
  title: string
  addressText: string
  basePrice: number | string
  currency: string
  status: string
  bedrooms: number
  maxGuests: number
  photos: Photo[]
}

interface ListingCardProps {
  listing: Listing
  href: string
  showStatus?: boolean
}

export function ListingCard({ listing, href, showStatus = false }: ListingCardProps) {
  const cover = listing.photos[0]
  const price = Number(listing.basePrice)

  return (
    <Link href={href} className="group block overflow-hidden rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow">
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {cover ? (
          <Image
            src={cover.thumbUrl ?? cover.url}
            alt={listing.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">No photo</div>
        )}
        {showStatus && (
          <div className="absolute top-2 right-2">
            <StatusBadge status={listing.status} />
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="font-semibold line-clamp-1">{listing.title}</p>
        <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{listing.addressText}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {listing.bedrooms} bed · {listing.maxGuests} guests
          </span>
          <span className="font-semibold">
            {listing.currency} {price.toFixed(0)}<span className="text-xs font-normal text-muted-foreground">/night</span>
          </span>
        </div>
      </div>
    </Link>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: 'bg-yellow-100 text-yellow-800',
    PUBLISHED: 'bg-green-100 text-green-800',
    ARCHIVED: 'bg-gray-100 text-gray-700',
  }
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', map[status] ?? 'bg-muted text-muted-foreground')}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  )
}
