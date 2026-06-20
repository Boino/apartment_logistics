import { z } from 'zod'

// ── Linen sets ────────────────────────────────────────────────────────────────

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

// ── Consumables ───────────────────────────────────────────────────────────────

export const createConsumableSchema = z.object({
  name: z.string().min(1).max(100),
  unit: z.string().max(50).optional(),
  mode: z.enum(['quantity', 'level']),
  quantity: z.number().int().min(0).optional(),
  level: z.enum(['FULL', 'OK', 'LOW', 'EMPTY']).optional(),
  parTarget: z.number().int().min(0).optional(),
  reorderThreshold: z.number().int().min(0).optional(),
})

export const updateConsumableSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  unit: z.string().max(50).optional(),
  quantity: z.number().int().min(0).optional(),
  level: z.enum(['FULL', 'OK', 'LOW', 'EMPTY']).optional(),
  parTarget: z.number().int().min(0).nullable().optional(),
  reorderThreshold: z.number().int().min(0).nullable().optional(),
})

// ── Damage reports ────────────────────────────────────────────────────────────

export const createDamageReportSchema = z.object({
  description: z.string().min(5).max(2000),
  photoUrl: z.string().url().optional(),
})

export const updateDamageReportSchema = z.object({
  status: z.enum(['ACKNOWLEDGED', 'RESOLVED']),
})

// ── Bundle component definition ───────────────────────────────────────────────

const bundleComponentSchema = z.object({
  itemType: z.string().min(1).max(50),
  quantity: z.number().int().min(1),
})

// ── Linen bundle templates ────────────────────────────────────────────────────

export const createBundleTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  parTarget: z.number().int().min(1).max(20).default(3),
  components: z.array(bundleComponentSchema).min(1),
})

export const updateBundleTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  parTarget: z.number().int().min(1).max(20).optional(),
  components: z.array(bundleComponentSchema).min(1).optional(),
})

// ── Linen bundle instances ────────────────────────────────────────────────────

export const createBundleInstanceSchema = z.object({
  label: z.string().min(1).max(100),
  state: z.enum(['STORED_CLEAN', 'IN_USE', 'STORED_DIRTY', 'AT_LAUNDRY']).optional(),
})

export const updateBundleInstanceStateSchema = z.object({
  state: z.enum(['STORED_CLEAN', 'IN_USE', 'STORED_DIRTY', 'AT_LAUNDRY']),
})

export const bulkBundleInstanceStateSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  state: z.enum(['STORED_CLEAN', 'IN_USE', 'STORED_DIRTY', 'AT_LAUNDRY']),
  listingId: z.string().min(1),
})

// ── Convert pieces to bundle ──────────────────────────────────────────────────

export const convertPiecesToBundleSchema = z.object({
  pieceIds: z.array(z.string().min(1)).min(1),
  templateId: z.string().min(1),
  label: z.string().min(1).max(100),
})

// ── Inferred types ────────────────────────────────────────────────────────────

export type CreateLinenSetInput = z.infer<typeof createLinenSetSchema>
export type UpdateLinenStateInput = z.infer<typeof updateLinenStateSchema>
export type BulkLinenStateInput = z.infer<typeof bulkLinenStateSchema>
export type CreateConsumableInput = z.infer<typeof createConsumableSchema>
export type UpdateConsumableInput = z.infer<typeof updateConsumableSchema>
export type CreateDamageReportInput = z.infer<typeof createDamageReportSchema>
export type UpdateDamageReportInput = z.infer<typeof updateDamageReportSchema>
export type CreateBundleTemplateInput = z.infer<typeof createBundleTemplateSchema>
export type UpdateBundleTemplateInput = z.infer<typeof updateBundleTemplateSchema>
export type CreateBundleInstanceInput = z.infer<typeof createBundleInstanceSchema>
export type UpdateBundleInstanceStateInput = z.infer<typeof updateBundleInstanceStateSchema>
export type BulkBundleInstanceStateInput = z.infer<typeof bulkBundleInstanceStateSchema>
export type ConvertPiecesToBundleInput = z.infer<typeof convertPiecesToBundleSchema>
