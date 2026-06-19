import { db } from '@/lib/db'
import { ListingStatus } from '@/lib/enums'
import type { CreateListingInput, UpdateListingInput } from './validation'
import { seedDefaults } from '@/modules/logistics/service'

export async function getPublishedListings(opts?: {
  search?: string
  minPrice?: number
  maxPrice?: number
  take?: number
  skip?: number
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    status: ListingStatus.PUBLISHED,
    ...(opts?.search && {
      OR: [
        { title: { contains: opts.search } },
        { addressText: { contains: opts.search } },
      ],
    }),
    ...(opts?.minPrice && { basePrice: { gte: opts.minPrice } }),
    ...(opts?.maxPrice && { basePrice: { lte: opts.maxPrice } }),
  }

  const [listings, total] = await Promise.all([
    db.listing.findMany({
      where,
      include: { photos: { orderBy: { sortOrder: 'asc' }, take: 1 } },
      orderBy: { createdAt: 'desc' },
      take: opts?.take ?? 24,
      skip: opts?.skip ?? 0,
    }),
    db.listing.count({ where }),
  ])
  return { listings, total }
}

export async function getListingById(id: string, hostId?: string) {
  const listing = await db.listing.findUnique({
    where: { id },
    include: {
      photos: { orderBy: { sortOrder: 'asc' } },
      listingAmenities: { include: { amenity: true } },
      host: { select: { id: true, name: true, createdAt: true } },
    },
  })
  if (!listing) return null
  if (listing.status !== ListingStatus.PUBLISHED && listing.hostId !== hostId) return null
  return listing
}

export async function getHostListings(hostId: string) {
  return db.listing.findMany({
    where: { hostId },
    include: { photos: { orderBy: { sortOrder: 'asc' }, take: 1 } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createListing(hostId: string, data: CreateListingInput) {
  const [listing] = await db.$transaction([
    db.listing.create({
      data: {
        hostId,
        title: data.title,
        description: data.description,
        addressText: data.addressText,
        lat: data.lat,
        lng: data.lng,
        locationPrecision: data.locationPrecision,
        basePrice: data.basePrice,
        currency: data.currency,
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        maxGuests: data.maxGuests,
        checkInTime: data.checkInTime,
        checkOutTime: data.checkOutTime,
        minStay: data.minStay,
        maxStay: data.maxStay,
        status: ListingStatus.DRAFT,
      },
    }),
    db.user.update({ where: { id: hostId }, data: { isHost: true } }),
  ])
  return listing
}

export async function updateListing(id: string, data: UpdateListingInput) {
  return db.listing.update({ where: { id }, data })
}

export async function publishListing(id: string) {
  const listing = await db.listing.findUnique({
    where: { id },
    include: { photos: { take: 1 } },
  })
  if (!listing) throw new Error('Listing not found')

  const errors: string[] = []
  if (!listing.title) errors.push('Title is required')
  if (!listing.description || listing.description.length < 50)
    errors.push('Description must be at least 50 characters')
  if (!listing.addressText) errors.push('Address is required')
  if (!listing.basePrice || listing.basePrice <= 0) errors.push('Price must be positive')
  if (listing.photos.length === 0) errors.push('At least one photo is required')

  if (errors.length) throw Object.assign(new Error('Validation failed'), { fields: errors })

  const published = await db.listing.update({
    where: { id },
    data: { status: ListingStatus.PUBLISHED },
  })
  seedDefaults(id).catch((err) => console.error('[seedDefaults]', err))
  return published
}

export async function archiveListing(id: string) {
  const activeStays = await db.stay.count({
    where: { listingId: id, status: { in: ['IN_HOUSE', 'UPCOMING'] } },
  })
  if (activeStays > 0) throw new Error('Cannot archive: listing has active stays')

  return db.listing.update({
    where: { id },
    data: { status: ListingStatus.ARCHIVED },
  })
}

export async function setAmenities(listingId: string, amenityIds: string[]) {
  await db.$transaction([
    db.listingAmenity.deleteMany({ where: { listingId } }),
    db.listingAmenity.createMany({
      data: amenityIds.map((amenityId) => ({ listingId, amenityId })),
    }),
  ])
}

export async function getAmenityCatalog() {
  return db.amenity.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] })
}
