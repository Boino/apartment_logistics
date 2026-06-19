import { z } from 'zod'

export const createStaySchema = z.object({
  listingId: z.string().min(1),
  guestName: z.string().min(1).max(200),
  numGuests: z.number().int().min(1),
  checkinAt: z.string().datetime(),
  checkoutAt: z.string().datetime(),
  notes: z.string().max(2000).optional(),
}).refine((d) => new Date(d.checkinAt) < new Date(d.checkoutAt), {
  message: 'Check-out must be after check-in',
  path: ['checkoutAt'],
})

export const updateStaySchema = z.object({
  guestName: z.string().min(1).max(200).optional(),
  numGuests: z.number().int().min(1).optional(),
  checkinAt: z.string().datetime().optional(),
  checkoutAt: z.string().datetime().optional(),
  status: z.enum(['UPCOMING', 'IN_HOUSE', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().max(2000).optional(),
})

export const convertToStaySchema = z.object({
  checkinAt: z.string().datetime(),
  checkoutAt: z.string().datetime(),
  notes: z.string().max(2000).optional(),
}).refine((d) => new Date(d.checkinAt) < new Date(d.checkoutAt), {
  message: 'Check-out must be after check-in',
  path: ['checkoutAt'],
})

export type CreateStayInput = z.infer<typeof createStaySchema>
export type UpdateStayInput = z.infer<typeof updateStaySchema>
export type ConvertToStayInput = z.infer<typeof convertToStaySchema>
