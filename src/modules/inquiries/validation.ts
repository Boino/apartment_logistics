import { z } from 'zod'

export const createInquirySchema = z.object({
  listingId: z.string().min(1),
  checkinDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  checkoutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  numGuests: z.number().int().min(1).max(100),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000),
}).refine((d) => d.checkinDate < d.checkoutDate, {
  message: 'Check-out must be after check-in',
  path: ['checkoutDate'],
})

export type CreateInquiryInput = z.infer<typeof createInquirySchema>
