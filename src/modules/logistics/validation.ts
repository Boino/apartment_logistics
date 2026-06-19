import { z } from 'zod'

export const createLinenSetSchema = z.object({
  type: z.enum(['SHEETS', 'TOWELS']),
  label: z.string().min(1).max(100),
})

export const updateLinenStateSchema = z.object({
  state: z.enum(['STORED_CLEAN', 'IN_USE', 'STORED_DIRTY', 'AT_LAUNDRY']),
})

export const bulkLinenStateSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  state: z.enum(['STORED_CLEAN', 'IN_USE', 'STORED_DIRTY', 'AT_LAUNDRY']),
})

export const createConsumableSchema = z.object({
  name: z.string().min(1).max(100),
  unit: z.string().max(50).optional(),
  mode: z.enum(['quantity', 'level']),
  quantity: z.number().int().min(0).optional(),
  level: z.enum(['FULL', 'OK', 'LOW', 'EMPTY']).optional(),
})

export const updateConsumableSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  unit: z.string().max(50).optional(),
  quantity: z.number().int().min(0).optional(),
  level: z.enum(['FULL', 'OK', 'LOW', 'EMPTY']).optional(),
})

export const createDamageReportSchema = z.object({
  description: z.string().min(5).max(2000),
  photoUrl: z.string().url().optional(),
})

export const updateDamageReportSchema = z.object({
  status: z.enum(['ACKNOWLEDGED', 'RESOLVED']),
})

export type CreateLinenSetInput = z.infer<typeof createLinenSetSchema>
export type UpdateLinenStateInput = z.infer<typeof updateLinenStateSchema>
export type BulkLinenStateInput = z.infer<typeof bulkLinenStateSchema>
export type CreateConsumableInput = z.infer<typeof createConsumableSchema>
export type UpdateConsumableInput = z.infer<typeof updateConsumableSchema>
export type CreateDamageReportInput = z.infer<typeof createDamageReportSchema>
export type UpdateDamageReportInput = z.infer<typeof updateDamageReportSchema>
