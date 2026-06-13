import { z } from 'zod'
import { LocationPrecision } from '@/lib/enums'

export const createListingSchema = z.object({
  title: z.string().min(1, 'Title is required').max(120),
  description: z.string().max(4000).optional(),
  addressText: z.string().min(1, 'Address is required').max(300),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  locationPrecision: z.nativeEnum(LocationPrecision).optional(),
  basePrice: z.number().positive('Price must be positive'),
  currency: z.string().length(3).default('EUR'),
  bedrooms: z.number().int().min(0).max(50).default(1),
  bathrooms: z.number().int().min(0).max(50).default(1),
  maxGuests: z.number().int().min(1).max(100).default(2),
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/).default('14:00'),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/).default('11:00'),
  minStay: z.number().int().min(1).default(1),
  maxStay: z.number().int().min(1).max(365).optional(),
})

export const updateListingSchema = createListingSchema.partial()

export const amenitiesSchema = z.object({
  amenityIds: z.array(z.string()).min(0),
})

export const photoOrderSchema = z.object({
  photos: z.array(z.object({ id: z.string(), sortOrder: z.number().int().min(0) })),
})

export type CreateListingInput = z.infer<typeof createListingSchema>
export type UpdateListingInput = z.infer<typeof updateListingSchema>
