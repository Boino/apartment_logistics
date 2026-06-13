import { z } from 'zod'

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password too long')

export const emailSchema = z.string().email('Invalid email address').toLowerCase()

export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{6,14}$/, 'Phone must be in E.164 format (e.g. +34612345678)')
  .optional()

export const cuidSchema = z.string().cuid()

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .transform((s) => new Date(s))

export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: emailSchema,
  password: passwordSchema,
  phone: phoneSchema,
  isHost: z.boolean().optional().default(false),
  consent: z.literal(true, { errorMap: () => ({ message: 'You must accept the privacy policy' }) }),
})

export type RegisterInput = z.infer<typeof registerSchema>
